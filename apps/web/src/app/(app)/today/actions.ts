"use server";

import { revalidatePath } from "next/cache";
import {
  isQueRuleError,
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
}): Promise<ActionResult> {
  const user = await getCurrentUser();
  return toResult((db) => db.answerCheckIn({ actorId: user.id, via: "web" }, input));
}
