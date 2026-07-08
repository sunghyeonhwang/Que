"use server";

import { revalidatePath } from "next/cache";
import {
  isQueRuleError,
  type StatusDetail,
  type Task,
  type TaskStatus,
} from "@que/core";
import { getDb } from "@/lib/db";
import { getCurrentUser } from "@/lib/current-user";
import { notifyTaskCreated, notifyTaskStatusChanged } from "@/lib/notifications/dispatch";
import type { ActionResult } from "@/app/(app)/today/actions";

// /projects PM 도구 서버 액션 — core mutation 경유. 카드 = core Task.
// 권한은 core(canEditTask)가 카드 단위로 강제하고, 규칙 위반은 { ok:false, error }로 변환된다.
// 모든 업무 영향 변경은 core가 ChangeLog(via:"web")로 기록한다.
// 상태 detail(사유)이 필요한 홀드·문제 전환은 changeTaskStatusAction(today/actions)이 담당하고,
// 여기 moveTask도 detail을 그대로 전달해 core assertStatusDetail이 강제하게 한다.
// (recurring-template 액션은 projects/actions.ts — 별개 파일.)

/** getDb()가 반환하는 DB 인스턴스 타입(mock 또는 supabase 어댑터). */
type Db = Awaited<ReturnType<typeof getDb>>;

/**
 * db 인스턴스를 한 번만 획득해 mutation과 persist를 같은 인스턴스에서 수행한다.
 * (today/actions.ts toResult와 동일 규율 — getDb 요청 캐시 정체성에 기대면 persist가 유실된다.)
 * QueRuleError만 { ok:false }로 변환하고, NEXT_REDIRECT(미인증) 등은 전파한다.
 */
async function toResult<T>(
  fn: (db: Db) => Promise<T> | T,
  afterCommit?: (db: Db, result: T) => Promise<void>,
): Promise<ActionResult> {
  try {
    const db = await getDb();
    const result = await fn(db);
    await db.persist();
    revalidatePath("/projects");
    if (afterCommit) await afterCommit(db, result); // 커밋 직후 알림 훅(throw 안 하는 훅만)
    return { ok: true };
  } catch (error) {
    if (isQueRuleError(error)) return { ok: false, error: error.message };
    throw error; // NEXT_REDIRECT · 예상 밖 예외는 삼키지 않는다
  }
}

/** 카드 생성 — 예정(scheduled) 상태로 생성된다. 담당자 미지정 시 core가 본인으로 배정. */
export async function createTaskAction(input: {
  projectId: string;
  title: string;
  description?: string;
  assigneeId?: string;
  endAt?: string;
  priority?: Task["priority"];
}): Promise<ActionResult> {
  const user = await getCurrentUser();
  return toResult(
    (db) =>
      db.createTask(
        { actorId: user.id, via: "web" },
        {
          title: input.title,
          projectId: input.projectId,
          assigneeId: input.assigneeId,
          endAt: input.endAt,
          description: input.description,
          priority: input.priority,
          source: "manual",
        },
      ),
    (db, task) => notifyTaskCreated(db, task.id), // 생성 즉시 담당자 DM(억제 조건은 훅이 판정)
  );
}

/** 카드 상세 편집(제목·설명·우선순위·시작·마감·프로젝트). 담당자·상태 변경은 별도 액션.
 *  startAt/endAt/projectId는 null로 해제, 미지정(undefined)이면 유지. core가 startAt≤endAt·
 *  프로젝트 실재를 강제하고 바뀐 항목만 ChangeLog(via:"web")에 남긴다. */
export async function updateTaskDetailsAction(input: {
  taskId: string;
  title?: string;
  description?: string | null;
  priority?: Task["priority"];
  startAt?: string | null;
  endAt?: string | null;
  projectId?: string | null;
}): Promise<ActionResult> {
  const user = await getCurrentUser();
  return toResult((db) => db.updateTaskDetails({ actorId: user.id, via: "web" }, input));
}

/** 카드 담당자 변경. */
export async function reassignTaskAction(input: {
  taskId: string;
  assigneeId: string;
}): Promise<ActionResult> {
  const user = await getCurrentUser();
  return toResult((db) => db.reassignTask({ actorId: user.id, via: "web" }, input));
}

/** 카드 삭제 = 취소(soft). reason은 선택. */
export async function deleteTaskAction(input: {
  taskId: string;
  reason?: string;
}): Promise<ActionResult> {
  const user = await getCurrentUser();
  return toResult((db) => db.cancelTask({ actorId: user.id, via: "web" }, input));
}

/** 완료 토글 — done ↔ in_progress. done 해제 시 진행중으로 되돌린다. */
export async function toggleTaskDoneAction(input: {
  taskId: string;
  done: boolean;
}): Promise<ActionResult> {
  const user = await getCurrentUser();
  return toResult((db) =>
    db.changeTaskStatus(
      { actorId: user.id, via: "web" },
      { taskId: input.taskId, to: input.done ? "done" : "in_progress" },
    ),
  );
}

/**
 * 열 이동 = 상태 변경. 대상 열의 status로 changeTaskStatus.
 * 홀드·문제 열(on_hold/issue)로 이동하면 detail(사유)이 필수 — 없으면 core가 STATUS_DETAIL_REQUIRED로
 * 거부하고, 프론트가 상태 사유 시트(status-detail-form)로 사유를 받아 detail과 함께 다시 호출한다.
 * merged/cancelled로는 이 액션으로 이동하지 않는다(삭제=cancelTask, 병합은 today 흐름).
 */
export async function moveTaskAction(input: {
  taskId: string;
  to: TaskStatus;
  detail?: StatusDetail;
}): Promise<ActionResult> {
  const user = await getCurrentUser();
  try {
    const db = await getDb();
    const from = db.tasks.find((t) => t.id === input.taskId)?.status; // 변경 전 status(알림 훅용)
    db.changeTaskStatus(
      { actorId: user.id, via: "web" },
      { taskId: input.taskId, to: input.to, detail: input.detail },
    );
    await db.persist();
    revalidatePath("/projects");
    // 홀드·문제 열로 이동하면 알림 발송(core 규칙). 발송 실패해도 이동은 유지된다.
    if (from) await notifyTaskStatusChanged(db, input.taskId, from, input.detail);
    return { ok: true };
  } catch (error) {
    if (isQueRuleError(error)) return { ok: false, error: error.message };
    throw error;
  }
}
