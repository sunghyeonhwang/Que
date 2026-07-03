import { canViewMeetingNote, type User } from "@que/core";
import { getDb } from "./db";

// 확인필요(회의록+Action) 화면 상단 요약. 결제요청 요약 카드와 같은 역할.
// 열람 권한(canViewMeetingNote) 있는 회의록만 집계한다 — 관리자 전용/지정 인원
// 회의록에서 나온 Action은 권한 없는 사용자의 카운트에 포함되면 안 된다.

export interface NoteSummary {
  /** 열람 가능한 회의록 수 */
  notes: number;
  /** Action 추출 대기(extractionStatus === "pending") 회의록 수 */
  pendingExtraction: number;
  /** 아직 처리되지 않은 Action 후보(확인 필요·생성 대기·보류) 수 */
  candidates: number;
  /** 확인 필요(담당자 또는 마감일 누락) Action 수 — 사이드바 뱃지와 동일 기준 */
  needsReview: number;
}

/** 처리 대기 후보로 볼 상태(생성/무시된 것은 제외) */
const OPEN_CANDIDATE = new Set(["needs_review", "candidate", "held"]);

export async function getNoteSummary(user: User): Promise<NoteSummary> {
  const db = await getDb();
  const visibleNotes = db.meetingNotes.filter((note) => canViewMeetingNote(user, note));
  const visibleIds = new Set(visibleNotes.map((note) => note.id));
  const items = db.actionItems.filter((item) => visibleIds.has(item.meetingNoteId));

  return {
    notes: visibleNotes.length,
    pendingExtraction: visibleNotes.filter((note) => note.extractionStatus === "pending").length,
    candidates: items.filter((item) => OPEN_CANDIDATE.has(item.status)).length,
    needsReview: items.filter((item) => item.status === "needs_review").length,
  };
}
