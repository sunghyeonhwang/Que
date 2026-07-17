import "server-only";

import {
  canViewMeetingNote,
  type ActionItemStatus,
  type MockQueDb,
  type User,
} from "@que/core";
import { businessDaysElapsed } from "./daily-data";

// 지난 회의 팔로업(명세 B-6) — 같은 kind의 **직전 회의록**에서 아직 미처리(needs_review·candidate)로 남은
// Action을 이번 회의 시작 시 이어 본다. 순수 조합(저장 안 함). /action 페이지 조립이 재사용한다.

/** 직전 회의록의 미처리 Action 1건(팔로업 표시용). */
export interface CarryoverItem {
  id: string;
  title: string;
  status: ActionItemStatus; // needs_review | candidate
  /** 생성 기준 경과 영업일(KST, 주말 스킵) — 오래 끈 팔로업을 드러낸다. */
  ageBusinessDays: number;
}

/** 지난 회의 팔로업 묶음(계약: /action carryover). 미처리가 없거나 직전 회의록 열람 불가면 null. */
export interface NoteCarryover {
  /** 직전 회의록 제목. */
  noteTitle: string;
  /** 직전 회의록 회의 일시(ISO). */
  noteDate: string;
  items: CarryoverItem[];
}

const UNRESOLVED: ReadonlySet<ActionItemStatus> = new Set<ActionItemStatus>([
  "needs_review",
  "candidate",
]);

/**
 * 현재 선택 회의록(noteId)의 **직전 동종(kind) 회의록**에서 미처리로 남은 Action을 모은다.
 * - 직전 회의록: 같은 kind, meetingAt이 더 이른 것 중 가장 최근.
 * - ⚠️ 직전 회의록이 canViewMeetingNote 불가면 **null**(존재 자체를 노출하지 않는다 — 마스킹 우회 금지).
 * - 미처리(needs_review·candidate)가 0건이면 null(팔로업 절 생략).
 * @param now age 계산 기준 시각(KST 영업일).
 */
export function getPreviousNoteCarryover(
  db: MockQueDb,
  viewer: User,
  noteId: string,
  now: Date = new Date(),
): NoteCarryover | null {
  const current = db.meetingNotes.find((n) => n.id === noteId);
  if (!current) return null;

  // 같은 kind의 직전 회의록(meetingAt < 현재, 가장 최근). id 비교로 동시각 자기 자신 방어.
  const prev = db.meetingNotes
    .filter(
      (n) =>
        n.id !== current.id && n.kind === current.kind && n.meetingAt < current.meetingAt,
    )
    .sort((a, b) => b.meetingAt.localeCompare(a.meetingAt))[0];
  if (!prev) return null;
  // 존재 노출 금지: 직전 회의록을 볼 수 없으면 팔로업 자체를 반환하지 않는다.
  if (!canViewMeetingNote(viewer, prev)) return null;

  const items: CarryoverItem[] = db.actionItems
    .filter((a) => a.meetingNoteId === prev.id && UNRESOLVED.has(a.status))
    .map((a) => ({
      id: a.id,
      title: a.title,
      status: a.status,
      ageBusinessDays: businessDaysElapsed(a.createdAt, now),
    }))
    .sort((a, b) => b.ageBusinessDays - a.ageBusinessDays);
  if (items.length === 0) return null;

  return { noteTitle: prev.title, noteDate: prev.meetingAt, items };
}
