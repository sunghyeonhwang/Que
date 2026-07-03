"use server";

import { revalidatePath } from "next/cache";
import { isQueRuleError, type RecurrenceFrequency } from "@que/core";
import { getDb } from "@/lib/db";
import { getCurrentUser } from "@/lib/current-user";
import type { ActionResult } from "@/app/(app)/today/actions";

function toResult(fn: () => void): ActionResult {
  try {
    fn();
    revalidatePath("/projects");
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
  return toResult(() =>
    getDb().createRecurringTemplate({ actorId: user.id, via: "web" }, input),
  );
}

export async function setRecurringTemplateActiveAction(
  templateId: string,
  active: boolean,
): Promise<ActionResult> {
  const user = await getCurrentUser();
  return toResult(() =>
    getDb().setRecurringTemplateActive({ actorId: user.id, via: "web" }, templateId, active),
  );
}
