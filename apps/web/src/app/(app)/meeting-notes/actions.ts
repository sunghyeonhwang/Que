"use server";

import { revalidatePath } from "next/cache";
import { isQueRuleError, type MeetingNote } from "@que/core";
import { getDb } from "@/lib/db";
import { getCurrentUser } from "@/lib/current-user";
import { draftMeetingMinutes } from "@/lib/meeting-minutes";
import { verifyTranscript, type TranscriptVerification } from "@/lib/minutes-verify";
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

/** 업로드 결과 — 성공 시 Plaud 전사 대조 검증 플래그를 함께 첨부한다(저장·병합 안 함, 검증 게이트). */
export type UploadNoteResult =
  | { ok: true; verification?: TranscriptVerification }
  | { ok: false; error: string };

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
  /** 회의 종류(주간/마일스톤/일반). 미지정은 general. weekly·milestone은 전사 대조 검증을 시도한다. */
  kind?: MeetingNote["kind"];
}): Promise<UploadNoteResult> {
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
  const saved = await toResult((db) =>
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
        kind: input.kind,
      },
    ),
  );
  if (!saved.ok) return saved;

  // 검증 게이트: weekly·milestone 회의록만 그날 시스템 행동과 대조(자동 병합 없음, 플래그만).
  let verification: TranscriptVerification | undefined;
  if (input.kind === "weekly" || input.kind === "milestone") {
    try {
      const db = await getDb();
      verification = await verifyTranscript(db, input.markdownBody, meetingAt);
    } catch (error) {
      console.error("[que-minutes] 업로드 후 전사 대조 실패(무시)", error);
    }
  }
  return { ok: true, verification };
}

export async function extractActionsAction(meetingNoteId: string): Promise<ActionResult> {
  const user = await getCurrentUser();
  return toResult((db) => db.extractActionItems({ actorId: user.id, via: "web" }, meetingNoteId));
}

/** 회의록 제목(회의명) 수정 — 업로더 또는 관리자만(core가 최종 강제). */
export async function updateMeetingNoteTitleAction(input: {
  meetingNoteId: string;
  title: string;
}): Promise<ActionResult> {
  const user = await getCurrentUser();
  return toResult((db) =>
    db.updateMeetingNoteTitle({ actorId: user.id, via: "web" }, input),
  );
}

/**
 * 행동 기반 회의록 초안 저장(기획 §1-f "회의 후") — **admin만**. 오늘 시스템에 남은 결정을
 * 결정적 템플릿(draftMeetingMinutes)으로 묶어 kind(weekly|milestone) 회의록으로 저장한다.
 * 기존 createMeetingNote 재사용(kind 파라미터). AI 불요 — 초안은 시간순 행동 로그의 재구성이다.
 */
export async function createMeetingMinutesAction(
  kind: "weekly" | "milestone",
): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (user.role !== "admin") {
    return { ok: false, error: "회의록 초안 저장은 관리자만 할 수 있습니다." };
  }
  const now = new Date();
  return toResult((db) => {
    const draft = draftMeetingMinutes(db, now, kind);
    return db.createMeetingNote(
      { actorId: user.id, via: "web" },
      {
        title: draft.title,
        meetingAt: now.toISOString(),
        // 참석자는 활성 전원(주간·마일스톤 회의는 전사 리듬).
        attendeeIds: db.users.filter((u) => u.active !== false).map((u) => u.id),
        fileName: draft.fileName,
        markdownBody: draft.markdownBody,
        visibility: "team",
        kind: draft.kind,
      },
    );
  });
}
