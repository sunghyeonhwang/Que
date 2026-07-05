// /projects 클라이언트 컴포넌트가 공유하는 컬럼 상수·상태색 매핑.
// projects-data.ts(서버 계층, getDb 의존)를 클라이언트에서 import하면 서버 코드가
// 번들에 딸려오므로, 런타임 상수만 여기(순수 모듈)에 둔다. 타입은 projects-data에서
// type-only로 가져와(빌드 시 소거) 단일 출처를 유지한다.

import type { TaskStatus } from "@que/core";
import type { BoardColumnKey } from "./projects-data";

/** 컬럼 표시 순서(projects-data.COLUMN_ORDER와 일치해야 한다). */
export const COLUMN_ORDER: readonly BoardColumnKey[] = [
  "scheduled",
  "in_progress",
  "blocked",
  "done",
];

/** 컬럼 표시 라벨(projects-data.COLUMN_LABEL과 일치해야 한다). */
export const COLUMN_LABEL: Record<BoardColumnKey, string> = {
  scheduled: "예정",
  in_progress: "진행중",
  blocked: "홀드·문제",
  done: "완료",
};

/**
 * blocked를 제외한 3개 컬럼이 곧바로 옮겨갈 status.
 * blocked(홀드·문제) 컬럼은 on_hold/issue 택1 + 사유가 필요해 별도 흐름으로 처리한다.
 */
export const SIMPLE_COLUMN_STATUS: Record<Exclude<BoardColumnKey, "blocked">, TaskStatus> = {
  scheduled: "scheduled",
  in_progress: "in_progress",
  done: "done",
};

// ---------- 상태색(의미 고정: green=진행/완료, blue=예정, amber=주의/홀드, red=문제) ----------

export type StatusTone = "blue" | "green" | "amber" | "red" | "neutral";

// tint는 보드 컬럼/이벤트 배경. 명도만 상향(흰색 25% 혼합)해 더 밝은 틴트로 보이게 한다.
// dot/text의 의미색(green=완료 등)은 유지 — 밝기만 조정.
export const TONE_STYLE: Record<StatusTone, { dot: string; tint: string; text: string }> = {
  blue: {
    dot: "var(--que-brand)",
    tint: "color-mix(in srgb, var(--que-brand-subtle) 75%, white)",
    text: "var(--que-brand)",
  },
  green: {
    dot: "var(--que-success)",
    tint: "color-mix(in srgb, var(--que-success-bg) 75%, white)",
    text: "var(--que-success)",
  },
  amber: {
    dot: "var(--que-warning)",
    tint: "color-mix(in srgb, var(--que-warning-bg) 75%, white)",
    text: "var(--que-warning)",
  },
  red: {
    dot: "var(--que-error)",
    tint: "color-mix(in srgb, var(--que-error-bg) 75%, white)",
    text: "var(--que-error)",
  },
  neutral: {
    dot: "var(--que-text-tertiary)",
    tint: "color-mix(in srgb, var(--que-bg-muted) 75%, white)",
    text: "var(--que-text-secondary)",
  },
};

/** 4개 컬럼 헤더/틴트용 톤. blocked는 주의색(amber)을 대표로. */
export const COLUMN_TONE: Record<BoardColumnKey, StatusTone> = {
  scheduled: "blue",
  in_progress: "green",
  blocked: "amber",
  done: "green",
};

/** 개별 status 톤(캘린더 pill·배지). on_hold=amber, issue=red로 분리. */
export const STATUS_TONE: Record<TaskStatus, StatusTone> = {
  scheduled: "blue",
  needs_reschedule: "blue",
  in_progress: "green",
  on_hold: "amber",
  issue: "red",
  done: "green",
  cancelled: "neutral",
  merged: "neutral",
};

// ---------- 마감일 date ↔ ISO 변환 ----------
// core는 endAt을 offset 포함 ISO datetime으로 강제한다. <input type="date">는 "yyyy-MM-dd"만
// 주므로, 마감 시각을 로컬 18:00로 고정해 ISO로 올려보내고, 표시용으론 로컬 날짜로 되돌린다.

/** "yyyy-MM-dd" → 로컬 18:00 기준 ISO datetime. 빈 값이면 null. */
export function dueDateToIso(dateStr: string): string | null {
  if (!dateStr) return null;
  const d = new Date(`${dateStr}T18:00:00`);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

