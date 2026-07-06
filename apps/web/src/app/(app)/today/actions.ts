"use server";

import { revalidatePath } from "next/cache";
import {
  formatProjectLabel,
  helpUserIdsOf,
  isQueRuleError,
  latestStatusLog,
  parseTaskInput,
  QueRuleError,
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
  /** @deprecated 도움 요청 대상(첫 번째) — 하위호환. 다중 표시는 helpUserNames를 쓴다. */
  helpUserName?: string;
  /** 도움 요청 대상 전체(다중). 비어 있으면 undefined. */
  helpUserNames?: string[];
  nextCheckAt?: string;
  /** 병합된(merged) 작업일 때 — 어느 작업으로 합쳐졌는지. 프론트가 "병합됨 → OO 작업" 표시에 쓴다. */
  mergedIntoTaskId?: string;
  mergedIntoTitle?: string;
  /** 역방향 — 이 작업으로 흡수된(merged) 작업들. 살아남은 B의 시트에서 "이 작업에 병합된 작업" 표시용.
   *  merged 작업은 모든 목록에서 숨겨져 순방향 배너에 도달할 수 없으므로, 보이는 B 쪽에서 노출한다. */
  mergedFrom?: { id: string; title: string }[];
}

/**
 * 작업의 상태 상세를 시트 오픈 시 지연 조회한다.
 * - 문제발생/홀드: 최신 StatusLog의 사유·다음액션·도움 요청 대상(다중)·재확인 시각.
 * - 병합(merged): 병합 대상 작업의 id·제목(item 7 — "무엇과 병합됐는지" 표시용).
 * 해당 없으면 null. write-only였던 상세를 관리 지점에 노출한다.
 */
export async function getTaskStatusDetailAction(
  taskId: string,
): Promise<TaskStatusDetailView | null> {
  await getCurrentUser(); // 세션 강제 — 비인증 호출 시 실명·사유 노출 방지(레포 표준)
  const db = await getDb();
  const task = db.tasks.find((t) => t.id === taskId);
  if (!task) return null;

  // 역방향 — 이 작업으로 흡수된(merged) 작업들. merged 작업은 모든 목록에서 숨겨져 순방향
  // 배너(A→B)에 도달할 수 없으므로, 살아남아 보이는 B의 시트에서 이 목록으로 병합을 드러낸다.
  const mergedFromList = db.tasks
    .filter((t) => t.status === "merged" && t.mergedIntoTaskId === taskId)
    .map((t) => ({ id: t.id, title: t.title }));
  const mergedFrom = mergedFromList.length > 0 ? mergedFromList : undefined;

  // 병합된 작업: 대상 작업 제목을 파생 제공한다(프론트가 taskById 없이 바로 표시).
  if (task.status === "merged" && task.mergedIntoTaskId) {
    const target = db.tasks.find((t) => t.id === task.mergedIntoTaskId);
    return {
      mergedIntoTaskId: task.mergedIntoTaskId,
      mergedIntoTitle: target?.title,
      mergedFrom,
    };
  }

  if (task.status !== "issue" && task.status !== "on_hold") {
    // 문제/홀드 상세는 없지만 역방향 병합 목록은 있을 수 있다 — 그때만 객체를 돌려준다.
    return mergedFrom ? { mergedFrom } : null;
  }
  const latest = latestStatusLog(db.statusLogs, taskId, task.status);
  if (!latest) return mergedFrom ? { mergedFrom } : null;
  const userById = new Map(db.users.map((u) => [u.id, u]));
  const helpNames = helpUserIdsOf(latest)
    .map((id) => userById.get(id)?.name)
    .filter((n): n is string => Boolean(n));
  return {
    reason: latest.reason,
    nextAction: latest.nextAction,
    helpUserName: helpNames[0],
    helpUserNames: helpNames.length > 0 ? helpNames : undefined,
    nextCheckAt: latest.nextCheckAt,
    mergedFrom,
  };
}

/** 자연어 해석 — 저장하지 않는다. 확인 카드를 거쳐 createTaskAction으로만 등록된다. */
export async function parseTaskAction(text: string): Promise<TaskDraft> {
  // 담당자 해석 명단은 db.users(재직자만) — 새 직원은 이름으로 잡히고, 비활성은 담당자로 해석되지 않는다.
  // (db.users는 비활성을 포함하므로 여기서 active !== false로 걸러야 한다 — parseTaskInput은 필터 안 함.)
  const db = await getDb();
  const activeUsers = db.users.filter((u) => u.active !== false);
  return parseTaskInput({ text: text.slice(0, 500), users: activeUsers });
}

export async function createTaskAction(input: {
  title: string;
  assigneeId?: string;
  /** 확인 카드에서 지정한 소속 프로젝트. core가 실재를 검증한다. */
  projectId?: string;
  startAt?: string;
  endAt?: string;
  priority?: "low" | "normal" | "high";
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

/** 작업 상세 시트·빠른등록의 프로젝트 Select용 — 활성(보관 아님) 프로젝트 {id,name}. lazy 조회.
 *  name은 "클라이언트 · 프로젝트" 병기 라벨(동명 프로젝트 구분·다른 Select와 일관). */
export async function getAssignableProjectsAction(): Promise<{ id: string; name: string }[]> {
  await getCurrentUser(); // 세션 강제 — 비인증 호출 차단(레포 표준)
  const db = await getDb();
  const clientById = new Map(db.clients.map((c) => [c.id, c]));
  return db.projects
    .filter((p) => p.status !== "archived")
    .map((p) => ({
      id: p.id,
      name: formatProjectLabel(p, p.clientId ? clientById.get(p.clientId) : undefined),
    }));
}

/**
 * 작업의 시작·마감 시각과 소속 프로젝트를 함께 편집한다(작업 상세 시트의 일정/프로젝트 편집).
 * startAt/endAt/projectId는 null로 해제, undefined면 유지. core(updateTaskDetails)가
 * startAt≤endAt·프로젝트 실재·편집 권한을 강제하고 바뀐 항목만 ChangeLog(via:"web")에 남긴다.
 * 여러 운영 화면에 파급되므로 revalidateOps로 관련 경로를 함께 무효화한다.
 */
export async function updateTaskScheduleAction(input: {
  taskId: string;
  startAt?: string | null;
  endAt?: string | null;
  projectId?: string | null;
}): Promise<ActionResult> {
  const user = await getCurrentUser();
  try {
    const db = await getDb();
    db.updateTaskDetails({ actorId: user.id, via: "web" }, input);
    await db.persist();
    revalidateOps();
    return { ok: true };
  } catch (error) {
    if (isQueRuleError(error)) return { ok: false, error: error.message };
    throw error;
  }
}
