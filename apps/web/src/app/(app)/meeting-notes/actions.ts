"use server";

import { revalidatePath } from "next/cache";
import { isQueRuleError, type MeetingNote } from "@que/core";
import { getDb } from "@/lib/db";
import { getCurrentUser } from "@/lib/current-user";
import type { ActionResult } from "@/app/(app)/today/actions";

function toResult(fn: () => void): ActionResult {
  try {
    fn();
    revalidatePath("/meeting-notes");
    revalidatePath("/action");
    revalidatePath("/now");
    return { ok: true };
  } catch (error) {
    if (isQueRuleError(error)) return { ok: false, error: error.message };
    throw error;
  }
}

export async function uploadMeetingNoteAction(input: {
  title: string;
  projectId?: string;
  meetingDate: string; // YYYY-MM-DD
  attendeeIds: string[];
  fileName: string;
  markdownBody: string;
  visibility?: MeetingNote["visibility"];
  restrictedUserIds?: string[];
}): Promise<ActionResult> {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.meetingDate)) {
    return { ok: false, error: "유효하지 않은 회의일이다 (YYYY-MM-DD)" };
  }
  const meetingAt = new Date(`${input.meetingDate}T10:00:00`);
  if (Number.isNaN(meetingAt.getTime())) {
    return { ok: false, error: "유효하지 않은 회의일이다" };
  }

  const user = await getCurrentUser();
  return toResult(() =>
    getDb().createMeetingNote(
      { actorId: user.id, via: "web" },
      {
        title: input.title,
        projectId: input.projectId || undefined,
        meetingAt: meetingAt.toISOString(),
        attendeeIds: input.attendeeIds,
        fileName: input.fileName,
        markdownBody: input.markdownBody,
        visibility: input.visibility,
        restrictedUserIds: input.restrictedUserIds,
      },
    ),
  );
}

export async function extractActionsAction(meetingNoteId: string): Promise<ActionResult> {
  const user = await getCurrentUser();
  return toResult(() =>
    getDb().extractActionItems({ actorId: user.id, via: "web" }, meetingNoteId),
  );
}
