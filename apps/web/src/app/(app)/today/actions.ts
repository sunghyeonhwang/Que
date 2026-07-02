"use server";

import { revalidatePath } from "next/cache";
import {
  QueRuleError,
  type CheckInResponse,
  type StatusDetail,
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
    if (error instanceof QueRuleError) return { ok: false, error: error.message };
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

export async function answerCheckInAction(input: {
  checkInId: string;
  response: CheckInResponse;
  detail?: StatusDetail;
}): Promise<ActionResult> {
  const user = await getCurrentUser();
  return toResult(() => getDb().answerCheckIn({ actorId: user.id, via: "web" }, input));
}
