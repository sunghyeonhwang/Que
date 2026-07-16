"use server";

import { revalidatePath } from "next/cache";
import { canViewMeetingNote, isQueRuleError, type MeetingNote } from "@que/core";
import { getDb } from "@/lib/db";
import { getCurrentUser } from "@/lib/current-user";
import { draftMeetingMinutes } from "@/lib/meeting-minutes";
import { verifyTranscript, type TranscriptVerification } from "@/lib/minutes-verify";
import { fetchPlaudShare } from "@/lib/plaud-import";
import {
  generateNoteSummary,
  NOTE_SUMMARY_MODEL,
  upsertNoteSummary,
  type NoteSummary,
} from "@/lib/meeting-summary";
import type { ActionResult } from "@/app/(app)/today/actions";

type Db = Awaited<ReturnType<typeof getDb>>;

/** 프라미스에 상한 시간을 건다. 초과하면 null(원본은 백그라운드에서 계속되지만 결과는 버린다).
 *  업로드 응답이 AI 요약 지연에 붙잡히지 않게 하는 가드 — generateNoteSummary는 자체적으로도
 *  throw하지 않으므로(null 반환) reject 경로는 없다. */
function withTimeout<T>(p: Promise<T>, ms: number): Promise<T | null> {
  return Promise.race([
    p,
    new Promise<null>((resolve) => setTimeout(() => resolve(null), ms)),
  ]);
}

/**
 * 업로드/가져오기 성공(회의록 persist 완료) 직후 자동 후처리:
 *  (1) Action 자동 추출 — extractionStatus가 "pending"일 때만(중복 추출 가드는 core에도 있음).
 *  (2) AI 요약 생성 → meeting_note_summaries upsert.
 * 두 단계는 개별 try-catch로 격리한다 — 어느 쪽이 실패해도 업로드 자체는 이미 성공이다.
 * 요약은 응답을 오래 붙잡지 않도록 15초 상한을 둔다.
 */
async function postProcessUploadedNote(
  noteId: string,
  uploaderId: string,
): Promise<{ extractedCount?: number; summaryGenerated: boolean }> {
  let extractedCount: number | undefined;
  let summaryGenerated = false;
  let markdownBody = "";
  let title = "";

  // (1) Action 자동 추출 — pending일 때만. core mutation 경유 + persist(추출 버튼 경로와 동일).
  try {
    const db = await getDb();
    const note = db.meetingNotes.find((n) => n.id === noteId);
    if (note) {
      markdownBody = note.markdownBody;
      title = note.title;
      if (note.extractionStatus === "pending") {
        const created = db.extractActionItems({ actorId: uploaderId, via: "web" }, noteId);
        await db.persist();
        extractedCount = created.length;
      }
    }
  } catch (error) {
    console.error("[que-minutes] 업로드 후 Action 자동 추출 실패(무시)", error);
  }

  // (2) AI 요약 — 15초 가드. 실패·타임아웃이면 summaryGenerated=false(업로드는 그대로 성공).
  try {
    if (markdownBody) {
      const summary = await withTimeout(generateNoteSummary(markdownBody, title), 15_000);
      if (summary) {
        summaryGenerated = await upsertNoteSummary(
          noteId,
          summary,
          NOTE_SUMMARY_MODEL,
          uploaderId,
        );
      }
    }
  } catch (error) {
    console.error("[que-minutes] 업로드 후 AI 요약 생성 실패(무시)", error);
  }

  return { extractedCount, summaryGenerated };
}

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

/** 업로드 결과 — 성공 시 Plaud 전사 대조 검증 플래그(저장·병합 안 함)와 자동 후처리 결과를 첨부한다.
 *  extractedCount: 자동 추출된 Action 후보 수(추출을 건너뛰었으면 undefined),
 *  summaryGenerated: AI 요약 생성·저장 성공 여부(프론트 토스트 분기용). 기존 호출부는 무시해도 무방. */
export type UploadNoteResult =
  | {
      ok: true;
      verification?: TranscriptVerification;
      extractedCount?: number;
      summaryGenerated: boolean;
    }
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
  let createdNoteId: string | undefined;
  const saved = await toResult((db) => {
    const note = db.createMeetingNote(
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
    );
    createdNoteId = note.id;
    return note;
  });
  if (!saved.ok) return saved;

  // 업로드 성공 직후 자동 후처리(Action 추출 + AI 요약) — 실패해도 업로드는 이미 성공.
  const post = createdNoteId
    ? await postProcessUploadedNote(createdNoteId, user.id)
    : { extractedCount: undefined, summaryGenerated: false };

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
  return {
    ok: true,
    verification,
    extractedCount: post.extractedCount,
    summaryGenerated: post.summaryGenerated,
  };
}

/**
 * Plaud 공유 링크로 회의록 가져오기 — md 파일 업로드와 병행(링크만으로 업로드). 제목·회의 시각·본문은
 * Plaud 값을 쓰고, 프로젝트·참석자·공개범위·종류는 폼 값을 받는다. 자동 추출은 하지 않는다(사람이 추출 버튼).
 * SSRF 방어(shareId만 추출·plaud.ai 화이트리스트·리다이렉트 금지·타임아웃·크기 상한)는 fetchPlaudShare가 강제.
 */
export async function importPlaudShareAction(input: {
  url: string;
  projectIds?: string[];
  attendeeIds?: string[];
  visibility?: MeetingNote["visibility"];
  restrictedUserIds?: string[];
  kind?: MeetingNote["kind"];
}): Promise<UploadNoteResult> {
  // 인증 우선 — 미인증 POST가 우리 서버의 외부(plaud.ai) fetch를 트리거하지 못하게(글래도스 게이트).
  const user = await getCurrentUser();
  const fetched = await fetchPlaudShare(input.url);
  if (!fetched.ok) return { ok: false, error: fetched.error };
  const { title, markdownBody, fileName } = fetched.note;
  // 회의 시각: Plaud start_time(ISO). 없으면 지금 시각으로 폴백.
  const meetingAtIso = fetched.note.meetingAt ?? new Date().toISOString();

  let createdNoteId: string | undefined;
  const saved = await toResult((db) => {
    const note = db.createMeetingNote(
      { actorId: user.id, via: "web" },
      {
        title,
        projectIds: input.projectIds?.length ? input.projectIds : undefined,
        meetingAt: meetingAtIso,
        attendeeIds: input.attendeeIds ?? [],
        fileName,
        markdownBody,
        visibility: input.visibility,
        restrictedUserIds:
          input.visibility === "restricted" ? input.restrictedUserIds : undefined,
        kind: input.kind,
      },
    );
    createdNoteId = note.id;
    return note;
  });
  if (!saved.ok) return saved;

  // 업로드 경로와 동일한 자동 후처리(Action 추출 + AI 요약). Plaud 인증·SSRF 로직은 무접촉.
  const post = createdNoteId
    ? await postProcessUploadedNote(createdNoteId, user.id)
    : { extractedCount: undefined, summaryGenerated: false };

  // 업로드 경로와 동일한 검증 게이트(weekly·milestone만 전사 대조 — 자동 병합 없음, 플래그만).
  let verification: TranscriptVerification | undefined;
  if (input.kind === "weekly" || input.kind === "milestone") {
    try {
      const db = await getDb();
      verification = await verifyTranscript(db, markdownBody, new Date(meetingAtIso));
    } catch (error) {
      console.error("[que-minutes] Plaud 가져오기 후 전사 대조 실패(무시)", error);
    }
  }
  return {
    ok: true,
    verification,
    extractedCount: post.extractedCount,
    summaryGenerated: post.summaryGenerated,
  };
}

export async function extractActionsAction(meetingNoteId: string): Promise<ActionResult> {
  const user = await getCurrentUser();
  return toResult((db) => db.extractActionItems({ actorId: user.id, via: "web" }, meetingNoteId));
}

/** 회의록 AI 요약 재생성 결과 — 성공 시 새 요약을 반환한다. */
export type RegenerateSummaryResult =
  | { ok: true; summary: NoteSummary }
  | { ok: false; error: string };

/**
 * 회의록 AI 요약을 다시 생성한다. **업로더 또는 관리자만**(DB 현재값 검증) + 열람 권한 필수.
 * 요약은 원문 파생물이라 원문과 동일 등급으로 다룬다 — 열람 불가면 원문이 요약으로 새지 않게 거부한다.
 */
export async function regenerateNoteSummaryAction(
  noteId: string,
): Promise<RegenerateSummaryResult> {
  const user = await getCurrentUser();
  const db = await getDb();
  const note = db.meetingNotes.find((n) => n.id === noteId);
  if (!note) return { ok: false, error: "회의록을 찾을 수 없습니다." };
  // 열람 권한(원문 파생물 보호) — 비공개 회의록 요약이 권한 없는 사용자에게 새지 않게.
  if (!canViewMeetingNote(user, note)) {
    return { ok: false, error: "열람 권한이 없는 회의록입니다." };
  }
  // 재생성은 업로더·관리자만(제목 편집 권한과 동일 축).
  if (note.uploaderId !== user.id && user.role !== "admin") {
    return { ok: false, error: "요약 재생성은 업로더 또는 관리자만 할 수 있습니다." };
  }

  const content = await generateNoteSummary(note.markdownBody, note.title);
  if (!content) {
    return { ok: false, error: "AI 요약 생성에 실패했습니다. 잠시 후 다시 시도하세요." };
  }
  const saved = await upsertNoteSummary(noteId, content, NOTE_SUMMARY_MODEL, user.id);
  if (!saved) {
    return { ok: false, error: "요약 저장에 실패했습니다 (이 환경에서 비활성일 수 있습니다)." };
  }
  return {
    ok: true,
    summary: { content, model: NOTE_SUMMARY_MODEL, generatedAt: new Date().toISOString() },
  };
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
 *
 * 자동 후처리(postProcessUploadedNote)는 의도적으로 적용하지 않는다: 이 초안은 이미 시스템에
 * 추적 중인 Task·결정의 재구성이라 (a) Action 재추출은 이미 존재하는 작업의 중복 후보를 만들고,
 * (b) 결정적 템플릿의 AI 요약은 원문 대비 부가가치가 낮다. 업로드/Plaud 경로(자유형 전사)만 후처리한다.
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
