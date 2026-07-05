"use server";

import { revalidatePath } from "next/cache";
import {
  isQueRuleError,
  latestStatusLog,
  parseTaskInput,
  QueRuleError,
  USERS,
  type CheckInResponse,
  type StatusDetail,
  type TaskDraft,
  type TaskStatus,
} from "@que/core";
import { getDb } from "@/lib/db";
import { getCurrentUser } from "@/lib/current-user";

export type ActionResult = { ok: true } | { ok: false; error: string };

/** getDb()가 반환하는 DB 인스턴스 타입 (mock 또는 supabase 어댑터). */
type Db = Awaited<ReturnType<typeof getDb>>;

// db 인스턴스를 한 번만 획득해 mutation과 persist를 같은 인스턴스에서 수행한다.
// (getDb의 요청 캐시 정체성에 기대면 서버 액션 경계에서 다른 인스턴스가 잡혀 persist가 유실된다 —
//  글래도스 반려 회귀. 반드시 콜백에 넘어온 db로만 작업할 것.)
async function toResult(fn: (db: Db) => Promise<unknown> | unknown): Promise<ActionResult> {
  try {
    const db = await getDb();
    await fn(db);
    await db.persist();
    revalidatePath("/today");
    return { ok: true };
  } catch (error) {
    if (isQueRuleError(error)) return { ok: false, error: error.message };
    throw error;
  }
}

export async function changeTaskStatusAction(input: {
  taskId: string;
  to: TaskStatus;
  detail?: StatusDetail;
  mergedIntoTaskId?: string;
}): Promise<ActionResult> {
  const user = await getCurrentUser();
  return toResult((db) => db.changeTaskStatus({ actorId: user.id, via: "web" }, input));
}

/** 병합 대상 후보 — 자기 자신과 종료 상태 작업을 제외한 활성 작업 목록. */
export async function getMergeCandidatesAction(
  excludeTaskId: string,
): Promise<{ id: string; label: string }[]> {
  await getCurrentUser(); // 세션 강제 — 비인증 서버액션 호출 차단(레포 표준: search-actions와 동일)
  const db = await getDb();
  const userById = new Map(db.users.map((u) => [u.id, u]));
  return db.tasks
    .filter(
      (t) =>
        t.id !== excludeTaskId &&
        t.status !== "cancelled" &&
        t.status !== "merged" &&
        t.status !== "done",
    )
    .map((t) => ({
      id: t.id,
      label: `${t.title} (${userById.get(t.assigneeId)?.name ?? t.assigneeId})`,
    }));
}

export interface TaskStatusDetailView {
  reason?: string;
  nextAction?: string;
  helpUserName?: string;
  nextCheckAt?: string;
}

/**
 * 현재 문제발생/홀드 상태 작업의 최신 상태 상세(사유·다음액션·도움 요청 대상·재확인 시각).
 * 시트가 열릴 때 지연 조회한다 — issue/on_hold가 아니면 null. write-only였던 상세를 관리 지점에 노출.
 */
export async function getTaskStatusDetailAction(
  taskId: string,
): Promise<TaskStatusDetailView | null> {
  await getCurrentUser(); // 세션 강제 — 비인증 호출 시 실명·사유 노출 방지(레포 표준)
  const db = await getDb();
  const task = db.tasks.find((t) => t.id === taskId);
  if (!task || (task.status !== "issue" && task.status !== "on_hold")) return null;
  const latest = latestStatusLog(db.statusLogs, taskId, task.status);
  if (!latest) return null;
  const userById = new Map(db.users.map((u) => [u.id, u]));
  return {
    reason: latest.reason,
    nextAction: latest.nextAction,
    helpUserName: latest.helpUserId ? userById.get(latest.helpUserId)?.name : undefined,
    nextCheckAt: latest.nextCheckAt,
  };
}

/** 자연어 해석 — 저장하지 않는다. 확인 카드를 거쳐 createTaskAction으로만 등록된다. */
export async function parseTaskAction(text: string): Promise<TaskDraft> {
  return parseTaskInput({ text: text.slice(0, 500), users: USERS });
}

export async function createTaskAction(input: {
  title: string;
  assigneeId?: string;
  startAt?: string;
  endAt?: string;
}): Promise<ActionResult> {
  const user = await getCurrentUser();
  return toResult((db) =>
    db.createTask({ actorId: user.id, via: "web" }, { ...input, source: "natural_language" }),
  );
}

/** 작업 댓글/도움 요청 — 타인 작업에도 가능 (수정 불가 팀원의 의사 전달 통로). */
export async function addTaskCommentAction(input: {
  taskId: string;
  body: string;
  helpUserId?: string;
}): Promise<ActionResult> {
  const user = await getCurrentUser();
  return toResult((db) => db.addTaskComment({ actorId: user.id, via: "web" }, input));
}

/** 일정 충돌 제안 수락 — 제안된 시각으로 작업을 이동한다 (동일 규칙/로그). */
export async function acceptConflictSuggestionAction(input: {
  taskId: string;
  startAt: string;
  endAt: string;
}): Promise<ActionResult> {
  const user = await getCurrentUser();
  return toResult((db) => db.moveTask({ actorId: user.id, via: "web" }, input));
}

/** 하루 마감 — 미완료 작업을 내일 같은 시간으로 이동한다 (드래그 이동과 동일 규칙/로그). */
export async function deferTaskToTomorrowAction(taskId: string): Promise<ActionResult> {
  const user = await getCurrentUser();
  // 사전 읽기·검증·mutation·persist를 모두 같은 db 인스턴스에서 처리한다(콜백 안).
  return toResult((db) => {
    const task = db.tasks.find((t) => t.id === taskId);
    if (!task) throw new QueRuleError("NOT_FOUND", `작업 없음: ${taskId}`);
    if (!task.startAt) throw new QueRuleError("INVALID_INPUT", "시작 시간이 없는 작업은 이동할 수 없다");

    const start = new Date(task.startAt);
    start.setDate(start.getDate() + 1);
    const durationMs = task.endAt
      ? new Date(task.endAt).getTime() - new Date(task.startAt).getTime()
      : 60 * 60 * 1000;

    db.moveTask(
      { actorId: user.id, via: "web" },
      {
        taskId,
        startAt: start.toISOString(),
        endAt: new Date(start.getTime() + durationMs).toISOString(),
      },
    );
  });
}

export async function answerCheckInAction(input: {
  checkInId: string;
  response: CheckInResponse;
  detail?: StatusDetail;
  /** response가 later일 때만 유효 — 다시 물어볼 시각(ISO 8601, now+48h 이내). */
  snoozeUntil?: string;
}): Promise<ActionResult> {
  const user = await getCurrentUser();
  return toResult((db) => db.answerCheckIn({ actorId: user.id, via: "web" }, input));
}

/** 취소·재배정처럼 여러 운영 화면에 파급되는 변경 뒤에 관련 경로를 함께 무효화한다. */
function revalidateOps(): void {
  for (const path of ["/today", "/now", "/team", "/schedule", "/home", "/heatmap", "/members"]) {
    revalidatePath(path);
  }
}

/** 작업 담당자 변경 — 기존 편집 권한(본인·소유자·프로젝트 담당·관리자)을 재사용한다. */
export async function reassignTaskAction(input: {
  taskId: string;
  assigneeId: string;
}): Promise<ActionResult> {
  const user = await getCurrentUser();
  try {
    const db = await getDb();
    db.reassignTask({ actorId: user.id, via: "web" }, input);
    await db.persist();
    revalidateOps();
    return { ok: true };
  } catch (error) {
    if (isQueRuleError(error)) return { ok: false, error: error.message };
    throw error;
  }
}

/** 작업 삭제 = 취소(cancelled) soft. 반환에 이전 status를 담아 프론트 실행취소(undo)에 쓴다.
 *  복구는 changeTaskStatusAction(cancelled → previousStatus)으로 되돌리면 된다. */
export async function cancelTaskAction(input: {
  taskId: string;
  reason?: string;
}): Promise<
  | { ok: true; previousStatus: TaskStatus; previousStatusDetail?: StatusDetail }
  | { ok: false; error: string }
> {
  const user = await getCurrentUser();
  try {
    const db = await getDb();
    const { previousStatus, previousStatusDetail } = db.cancelTask(
      { actorId: user.id, via: "web" },
      input,
    );
    await db.persist();
    revalidateOps();
    return { ok: true, previousStatus, previousStatusDetail };
  } catch (error) {
    if (isQueRuleError(error)) return { ok: false, error: error.message };
    throw error;
  }
}

/** 재배정 Select용 — 팀원 전체 {id,name}. 세션 필요, 조회 시점에 lazy 호출한다. */
export async function getAssignableUsersAction(): Promise<{ id: string; name: string }[]> {
  await getCurrentUser(); // 세션 강제 — 비인증 호출 차단(레포 표준)
  const db = await getDb();
  return db.users.map((u) => ({ id: u.id, name: u.name }));
}
