"use server";

import { revalidatePath } from "next/cache";
import { isQueRuleError, type Milestone } from "@que/core";
import { getDb } from "@/lib/db";
import { getCurrentUser } from "@/lib/current-user";
import type { ActionResult } from "@/app/(app)/today/actions";

type Db = Awaited<ReturnType<typeof getDb>>;

// mutation과 persist는 반드시 같은 db 인스턴스에서(cache 정체성 의존 금지 — projects/actions와 동일 패턴).
async function toResult(fn: (db: Db) => Promise<unknown> | unknown): Promise<ActionResult> {
  try {
    const db = await getDb();
    await fn(db);
    await db.persist();
    revalidatePath("/planning");
    return { ok: true };
  } catch (error) {
    if (isQueRuleError(error)) return { ok: false, error: error.message };
    throw error;
  }
}

export async function createMilestoneAction(input: {
  projectId: string;
  title: string;
  dueAt: string;
}): Promise<ActionResult> {
  const user = await getCurrentUser();
  return toResult((db) => db.createMilestone({ actorId: user.id, via: "web" }, input));
}

export async function updateMilestoneAction(input: {
  milestoneId: string;
  title?: string;
  dueAt?: string;
  riskStatus?: Milestone["riskStatus"];
}): Promise<ActionResult> {
  const user = await getCurrentUser();
  return toResult((db) => db.updateMilestone({ actorId: user.id, via: "web" }, input));
}
