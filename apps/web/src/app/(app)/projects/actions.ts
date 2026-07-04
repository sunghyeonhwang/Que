"use server";

import { revalidatePath } from "next/cache";
import { isQueRuleError, type RecurrenceFrequency } from "@que/core";
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
    revalidatePath("/projects");
    revalidatePath("/planning"); // 반복 템플릿 호스트 화면
    return { ok: true };
  } catch (error) {
    if (isQueRuleError(error)) return { ok: false, error: error.message };
    throw error;
  }
}

export async function createRecurringTemplateAction(input: {
  title: string;
  assigneeId: string;
  projectId?: string;
  frequency: RecurrenceFrequency;
  dayOfWeek?: number;
  dayOfMonth?: number;
  startTime: string;
  durationMinutes?: number;
  description?: string;
}): Promise<ActionResult> {
  const user = await getCurrentUser();
  return toResult((db) => db.createRecurringTemplate({ actorId: user.id, via: "web" }, input));
}

export async function setRecurringTemplateActiveAction(
  templateId: string,
  active: boolean,
): Promise<ActionResult> {
  const user = await getCurrentUser();
  return toResult((db) =>
    db.setRecurringTemplateActive({ actorId: user.id, via: "web" }, templateId, active),
  );
}
