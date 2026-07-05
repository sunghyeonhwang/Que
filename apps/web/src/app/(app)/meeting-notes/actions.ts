"use server";

import { revalidatePath } from "next/cache";
import { isQueRuleError, type MeetingNote } from "@que/core";
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
  /** 다중 프로젝트(주간회의 등). 지정 시 projectId보다 우선한다. */
  projectIds?: string[];
  meetingDateTime: string; // YYYY-MM-DDTHH:mm (구 형식 YYYY-MM-DD도 방어적 허용)
  attendeeIds: string[];
  fileName: string;
  markdownBody: string;
  visibility?: MeetingNote["visibility"];
  restrictedUserIds?: string[];
}): Promise<ActionResult> {
  // 새 입력: 날짜+시간(datetime-local). 옛 형식(날짜만)은 시간 미지정 시 10:00 기본.
  const dateOnly = /^\d{4}-\d{2}-\d{2}$/.test(input.meetingDateTime);
  const dateTime = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?$/.test(input.meetingDateTime);
  if (!dateOnly && !dateTime) {
    return { ok: false, error: "유효하지 않은 회의 일시다 (YYYY-MM-DD HH:mm)" };
  }
  const meetingAt = new Date(dateOnly ? `${input.meetingDateTime}T10:00:00` : input.meetingDateTime);
  if (Number.isNaN(meetingAt.getTime())) {
    return { ok: false, error: "유효하지 않은 회의 일시다" };
  }

  const user = await getCurrentUser();
  return toResult((db) =>
    db.createMeetingNote(
      { actorId: user.id, via: "web" },
      {
        title: input.title,
        projectId: input.projectId || undefined,
        projectIds: input.projectIds?.length ? input.projectIds : undefined,
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
  return toResult((db) => db.extractActionItems({ actorId: user.id, via: "web" }, meetingNoteId));
}
