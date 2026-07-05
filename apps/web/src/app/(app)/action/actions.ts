"use server";

import { revalidatePath } from "next/cache";
import { isQueRuleError } from "@que/core";
import { getDb } from "@/lib/db";
import { getCurrentUser } from "@/lib/current-user";
import type { ActionResult } from "@/app/(app)/today/actions";

type Db = Awaited<ReturnType<typeof getDb>>;

// mutation과 persist를 반드시 같은 db 인스턴스에서 (글래도스 반려 회귀 — cache 정체성 의존 금지).
async function toResult(fn: (db: Db) => Promise<unknown> | unknown): Promise<ActionResult> {
  try {
    const db = await getDb();
    await fn(db);
    await db.persist();
    revalidatePath("/action");
    revalidatePath("/now");
    revalidatePath("/today");
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
      dueAt = toIso(overrides.dueDate, overrides.dueTime, "18:00");
      if (!dueAt) return { ok: false, error: "유효하지 않은 마감 일시다 (YYYY-MM-DD HH:mm)" };
      if (overrides.startTime) {
        startAt = toIso(overrides.dueDate, overrides.startTime, "18:00");
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
  return toResult((db) =>
    db.confirmActionItem({ actorId: user.id, via: "web" }, actionItemId, coreOverrides),
  );
}

export async function setActionItemStatusAction(input: {
  actionItemId: string;
  to: "held" | "ignored";
}): Promise<ActionResult> {
  const user = await getCurrentUser();
  return toResult((db) => db.setActionItemStatus({ actorId: user.id, via: "web" }, input));
}

export async function updateActionItemAction(input: {
  actionItemId: string;
  assigneeId?: string;
  projectId?: string;
  dueDate?: string; // YYYY-MM-DD
  dueTime?: string; // HH:mm (옵션, 기본 18:00)
}): Promise<ActionResult> {
  let dueAt: string | undefined;
  if (input.dueDate) {
    dueAt = toIso(input.dueDate, input.dueTime, "18:00");
    if (!dueAt) return { ok: false, error: "유효하지 않은 마감 일시다 (YYYY-MM-DD HH:mm)" };
  }

  const user = await getCurrentUser();
  return toResult((db) =>
    db.updateActionItem(
      { actorId: user.id, via: "web" },
      {
        actionItemId: input.actionItemId,
        assigneeId: input.assigneeId,
        projectId: input.projectId,
        dueAt,
      },
    ),
  );
}
