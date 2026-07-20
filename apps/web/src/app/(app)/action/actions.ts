"use server";

import { revalidatePath } from "next/cache";
import { formatProjectLabel, isQueRuleError } from "@que/core";
import { getDb } from "@/lib/db";
import { getCurrentUser } from "@/lib/current-user";
import { notifyTaskCreated } from "@/lib/notifications/dispatch";
import type { ActionResult } from "@/app/(app)/today/actions";

type Db = Awaited<ReturnType<typeof getDb>>;

// mutation과 persist를 반드시 같은 db 인스턴스에서 (글래도스 반려 회귀 — cache 정체성 의존 금지).
async function toResult<T>(
  fn: (db: Db) => Promise<T> | T,
  afterCommit?: (db: Db, result: T) => Promise<void>,
): Promise<ActionResult> {
  try {
    const db = await getDb();
    const result = await fn(db);
    await db.persist();
    revalidatePath("/action");
    revalidatePath("/now");
    revalidatePath("/today");
    if (afterCommit) await afterCommit(db, result); // 커밋 직후 알림 훅(throw 안 하는 훅만)
    return { ok: true };
  } catch (error) {
    if (isQueRuleError(error)) return { ok: false, error: error.message };
    throw error;
  }
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^\d{2}:\d{2}$/;

/** YYYY-MM-DD + HH:mm → 로컬 자정 기준 ISO. 시간 미지정 시 fallback 시각을 쓴다. */
function toIso(date: string, time: string | undefined, fallback: string): string | undefined {
  if (!DATE_RE.test(date)) return undefined;
  const hhmm = time && TIME_RE.test(time) ? time : fallback;
  const parsed = new Date(`${date}T${hhmm}:00`);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed.toISOString();
}

/** Action 확정. overrides로 담당자·프로젝트·마감일/시각·시간 블록을 함께 지정할 수 있다.
 *  dueDate가 오면 dueTime(기본 18:00)과 합쳐 마감을, startTime이 오면 그 날짜의 시작 블록을 만든다. */
export async function confirmActionItemAction(
  actionItemId: string,
  overrides?: {
    assigneeId?: string;
    projectId?: string;
    dueDate?: string; // YYYY-MM-DD
    dueTime?: string; // HH:mm (마감 시각)
    startTime?: string; // HH:mm (Task 블록 시작, 옵션)
  },
): Promise<ActionResult> {
  let coreOverrides:
    | { assigneeId?: string; projectId?: string; dueAt?: string; startAt?: string; endAt?: string }
    | undefined;
  if (overrides) {
    let dueAt: string | undefined;
    let startAt: string | undefined;
    if (overrides.dueDate) {
      // 기본 마감 17:00 — 마감 시각 허용 창 11:00~17:00(2026-07-15 사용자 확정, due-picker와 정합).
      dueAt = toIso(overrides.dueDate, overrides.dueTime, "17:00");
      if (!dueAt) return { ok: false, error: "유효하지 않은 마감 일시다 (YYYY-MM-DD HH:mm)" };
      if (overrides.startTime) {
        startAt = toIso(overrides.dueDate, overrides.startTime, "17:00");
        if (!startAt) return { ok: false, error: "유효하지 않은 시작 시각이다 (HH:mm)" };
      }
    }
    coreOverrides = {
      assigneeId: overrides.assigneeId,
      projectId: overrides.projectId,
      dueAt,
      startAt,
      endAt: startAt ? dueAt : undefined, // 블록 종료 = 마감 시각
    };
  }
  const user = await getCurrentUser();
  return toResult(
    (db) => db.confirmActionItem({ actorId: user.id, via: "web" }, actionItemId, coreOverrides),
    (db, task) => notifyTaskCreated(db, task.id), // Action→Task 확정도 생성 이벤트 — 담당자 DM
  );
}

export type CreateProjectResult =
  | { ok: true; project: { id: string; name: string } }
  | { ok: false; error: string };

/** 프로젝트 인라인 생성 — Copilot create_project와 동일한 core createProject 경로(전원 허용, 2026-07-12).
 *  성공 시 새 프로젝트의 { id, 라벨 }을 돌려줘 Select에서 즉시 선택할 수 있게 한다. ChangeLog via=web. */
export async function createProjectAction(input: {
  name: string;
  clientId?: string;
}): Promise<CreateProjectResult> {
  const user = await getCurrentUser();
  try {
    const db = await getDb();
    const project = db.createProject(
      { actorId: user.id, via: "web" },
      { name: input.name, clientId: input.clientId || undefined },
    );
    await db.persist();
    for (const path of ["/action", "/projects", "/now", "/today", "/planning"]) {
      revalidatePath(path);
    }
    const client = project.clientId
      ? db.clients.find((c) => c.id === project.clientId)
      : undefined;
    return {
      ok: true,
      project: { id: project.id, name: formatProjectLabel(project, client) },
    };
  } catch (error) {
    if (isQueRuleError(error)) return { ok: false, error: error.message };
    throw error;
  }
}

export async function setActionItemStatusAction(input: {
  actionItemId: string;
  to: "held" | "ignored";
}): Promise<ActionResult> {
  const user = await getCurrentUser();
  return toResult((db) => db.setActionItemStatus({ actorId: user.id, via: "web" }, input));
}

/**
 * 선택한 후보 일괄 보류/무시(2026-07-21 사용자 — 회의록 단위로 한 번에 처리).
 * 항목별 권한(담당자·업로더·관리자)은 core setActionItemStatus가 개별 판정한다 —
 * 권한 없는 항목만 건너뛰고 나머지는 처리하는 부분 성공 시맨틱(전부 실패 시에만 ok:false).
 * mutation은 같은 db 인스턴스에서 모두 수행 후 persist 1회(개별 액션 N번 왕복 방지).
 */
export async function setActionItemStatusBulkAction(input: {
  actionItemIds: string[];
  to: "held" | "ignored";
}): Promise<{ ok: true; done: number; skipped: number } | { ok: false; error: string }> {
  const user = await getCurrentUser();
  // 방어: 중복 제거 + 상한(화면 목록 규모를 한참 넘는 요청은 비정상).
  const ids = [...new Set(input.actionItemIds)].slice(0, 200);
  if (ids.length === 0) return { ok: false, error: "선택된 항목이 없습니다." };
  try {
    const db = await getDb();
    let done = 0;
    let skipped = 0;
    let firstError: string | null = null;
    for (const actionItemId of ids) {
      try {
        db.setActionItemStatus({ actorId: user.id, via: "web" }, { actionItemId, to: input.to });
        done += 1;
      } catch (error) {
        // 규칙 위반(권한 없음·이미 처리 등)은 그 항목만 건너뛴다. 예상 밖 예외는 전파.
        if (isQueRuleError(error)) {
          skipped += 1;
          firstError ??= error.message;
          continue;
        }
        throw error;
      }
    }
    if (done === 0) return { ok: false, error: firstError ?? "처리할 수 있는 항목이 없습니다." };
    await db.persist();
    revalidatePath("/action");
    revalidatePath("/now");
    revalidatePath("/today");
    return { ok: true, done, skipped };
  } catch (error) {
    if (isQueRuleError(error)) return { ok: false, error: error.message };
    throw error;
  }
}

/** Action 후보 나누기 — 한 후보를 N건으로 분할(원본은 ignored, 신규는 담당·프로젝트·원문 상속).
 *  각 part의 dueDate(+dueTime, 기본 17:00)는 toIso로 ISO 마감일로 변환한다. Task 자동 생성 없음. */
export async function splitActionItemAction(input: {
  actionItemId: string;
  parts: { title: string; dueDate?: string; dueTime?: string }[];
}): Promise<ActionResult> {
  const coreParts: { title: string; dueAt?: string }[] = [];
  for (const part of input.parts) {
    let dueAt: string | undefined;
    if (part.dueDate) {
      dueAt = toIso(part.dueDate, part.dueTime, "17:00");
      if (!dueAt) return { ok: false, error: "유효하지 않은 마감 일시다 (YYYY-MM-DD HH:mm)" };
    }
    coreParts.push({ title: part.title, dueAt });
  }

  const user = await getCurrentUser();
  return toResult((db) =>
    db.splitActionItem(
      { actorId: user.id, via: "web" },
      { actionItemId: input.actionItemId, parts: coreParts },
    ),
  );
}

export async function updateActionItemAction(input: {
  actionItemId: string;
  title?: string;
  assigneeId?: string;
  projectId?: string;
  dueDate?: string; // YYYY-MM-DD
  dueTime?: string; // HH:mm (옵션, 기본 17:00 — 마감 허용 창 11:00~17:00)
}): Promise<ActionResult> {
  let dueAt: string | undefined;
  if (input.dueDate) {
    dueAt = toIso(input.dueDate, input.dueTime, "17:00");
    if (!dueAt) return { ok: false, error: "유효하지 않은 마감 일시다 (YYYY-MM-DD HH:mm)" };
  }

  const user = await getCurrentUser();
  return toResult((db) =>
    db.updateActionItem(
      { actorId: user.id, via: "web" },
      {
        actionItemId: input.actionItemId,
        title: input.title,
        assigneeId: input.assigneeId,
        projectId: input.projectId,
        dueAt,
      },
    ),
  );
}
