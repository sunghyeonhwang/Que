"use server";

import { revalidatePath } from "next/cache";
import {
  isQueRuleError,
  parseTaskInput,
  USERS,
  type CheckInResponse,
  type StatusDetail,
  type TaskDraft,
  type TaskStatus,
} from "@que/core";
import { getDb } from "@/lib/db";
import { getCurrentUser } from "@/lib/current-user";

export type ActionResult = { ok: true } | { ok: false; error: string };

function toResult(fn: () => void): ActionResult {
  try {
    fn();
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
}): Promise<ActionResult> {
  const user = await getCurrentUser();
  return toResult(() =>
    getDb().changeTaskStatus({ actorId: user.id, via: "web" }, input),
  );
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
  return toResult(() =>
    getDb().createTask(
      { actorId: user.id, via: "web" },
      { ...input, source: "natural_language" },
    ),
  );
}

/** 작업 댓글/도움 요청 — 타인 작업에도 가능 (수정 불가 팀원의 의사 전달 통로). */
export async function addTaskCommentAction(input: {
  taskId: string;
  body: string;
  helpUserId?: string;
}): Promise<ActionResult> {
  const user = await getCurrentUser();
  return toResult(() => getDb().addTaskComment({ actorId: user.id, via: "web" }, input));
}

/** 일정 충돌 제안 수락 — 제안된 시각으로 작업을 이동한다 (동일 규칙/로그). */
export async function acceptConflictSuggestionAction(input: {
  taskId: string;
  startAt: string;
  endAt: string;
}): Promise<ActionResult> {
  const user = await getCurrentUser();
  return toResult(() => getDb().moveTask({ actorId: user.id, via: "web" }, input));
}

/** 하루 마감 — 미완료 작업을 내일 같은 시간으로 이동한다 (드래그 이동과 동일 규칙/로그). */
export async function deferTaskToTomorrowAction(taskId: string): Promise<ActionResult> {
  const user = await getCurrentUser();
  const db = getDb();
  const task = db.tasks.find((t) => t.id === taskId);
  if (!task) return { ok: false, error: `작업 없음: ${taskId}` };
  if (!task.startAt) return { ok: false, error: "시작 시간이 없는 작업은 이동할 수 없다" };

  const start = new Date(task.startAt);
  start.setDate(start.getDate() + 1);
  const durationMs = task.endAt
    ? new Date(task.endAt).getTime() - new Date(task.startAt).getTime()
    : 60 * 60 * 1000;

  return toResult(() =>
    db.moveTask(
      { actorId: user.id, via: "web" },
      {
        taskId,
        startAt: start.toISOString(),
        endAt: new Date(start.getTime() + durationMs).toISOString(),
      },
    ),
  );
}

export async function answerCheckInAction(input: {
  checkInId: string;
  response: CheckInResponse;
  detail?: StatusDetail;
}): Promise<ActionResult> {
  const user = await getCurrentUser();
  return toResult(() => getDb().answerCheckIn({ actorId: user.id, via: "web" }, input));
}
