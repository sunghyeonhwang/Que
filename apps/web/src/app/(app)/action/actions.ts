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

export async function confirmActionItemAction(actionItemId: string): Promise<ActionResult> {
  const user = await getCurrentUser();
  return toResult((db) => db.confirmActionItem({ actorId: user.id, via: "web" }, actionItemId));
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
  dueDate?: string; // YYYY-MM-DD
}): Promise<ActionResult> {
  let dueAt: string | undefined;
  if (input.dueDate) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(input.dueDate)) {
      return { ok: false, error: "유효하지 않은 마감일이다 (YYYY-MM-DD)" };
    }
    const parsed = new Date(`${input.dueDate}T18:00:00`);
    if (Number.isNaN(parsed.getTime())) return { ok: false, error: "유효하지 않은 마감일이다" };
    dueAt = parsed.toISOString();
  }

  const user = await getCurrentUser();
  return toResult((db) =>
    db.updateActionItem(
      { actorId: user.id, via: "web" },
      { actionItemId: input.actionItemId, assigneeId: input.assigneeId, dueAt },
    ),
  );
}
