// 타임라인 뷰(가로/세로 × day/hour)가 공유하는 순수 계산 헬퍼.
// "use client" 없이 순수 함수만 두어 서버(page.tsx)와 클라이언트 컴포넌트가 함께 쓴다.

import {
  differenceInCalendarDays,
  endOfDay,
  format,
  isSameDay,
  isToday,
  setHours,
  startOfDay,
} from "date-fns";
import { ko } from "date-fns/locale";

/** 축 단위: 날짜(day) 또는 시간(hour) */
export type TimelineMode = "day" | "hour";
/** 방향: 가로(h) / 세로(v) */
export type TimelineOrientation = "h" | "v";
/** 타임라인 범위: 시간별 / 1주간 / 2주간 */
export type TimelineRange = "hourly" | "week" | "biweek";

// 시간 기반 뷰의 노출 시간대 (기본형 시간축과 동일: 08:00–19:00, 12칸)
export const TIMELINE_HOUR_START = 8;
export const TIMELINE_HOUR_END = 19;
const HOUR_COUNT = TIMELINE_HOUR_END - TIMELINE_HOUR_START + 1;

/** 시간 기반 축의 units — anchor 하루의 08..19시를 Date로. */
export function buildHourUnits(anchor: Date): Date[] {
  const base = startOfDay(anchor);
  return Array.from({ length: HOUR_COUNT }, (_, i) => setHours(base, TIMELINE_HOUR_START + i));
}

export interface Placement {
  startIdx: number;
  span: number;
}

function clamp(value: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, value));
}

/**
 * 항목(startAt~endAt)을 축(units) 위 위치로 변환. 범위 밖이면 null.
 * - day 모드: 캘린더 일수 기준으로 시작~끝 날짜 열을 span (기존 가로 동작과 동일한 계산).
 * - hour 모드: anchor 하루에 걸치는 항목만, 08–20시로 클램프해 시간 칸을 span.
 */
export function placeItem(
  startAt: string,
  endAt: string,
  mode: TimelineMode,
  units: Date[],
): Placement | null {
  const start = new Date(startAt);
  const end = new Date(endAt);

  if (mode === "day") {
    const rangeStart = units[0];
    const rangeEnd = units[units.length - 1];
    if (end < rangeStart || start > rangeEnd) return null;
    const startIdx = Math.max(0, differenceInCalendarDays(start, rangeStart));
    const endIdx = Math.min(units.length - 1, differenceInCalendarDays(end, rangeStart));
    return { startIdx, span: Math.max(1, endIdx - startIdx + 1) };
  }

  const day = units[0];
  const dayStart = startOfDay(day);
  const dayEnd = endOfDay(day);
  if (start > dayEnd || end < dayStart) return null;

  const startH =
    start < dayStart ? TIMELINE_HOUR_START : clamp(start.getHours(), TIMELINE_HOUR_START, TIMELINE_HOUR_END);
  // 종료는 배타적(exclusive) 인덱스로 계산 — 분 단위가 남으면 다음 칸까지 포함.
  const endExclusive =
    end > dayEnd
      ? TIMELINE_HOUR_END + 1
      : clamp(end.getHours() + (end.getMinutes() > 0 ? 1 : 0), startH + 1, TIMELINE_HOUR_END + 1);
  const startIdx = startH - TIMELINE_HOUR_START;
  const endIdx = endExclusive - TIMELINE_HOUR_START;
  return { startIdx, span: Math.max(1, endIdx - startIdx) };
}

/** 마일스톤을 축 위 인덱스로 (해당 축에 없으면 null). */
export function milestoneIndex(dueAt: string, mode: TimelineMode, units: Date[]): number | null {
  const due = new Date(dueAt);
  if (mode === "day") {
    const idx = units.findIndex((u) => isSameDay(u, due));
    return idx >= 0 ? idx : null;
  }
  const day = units[0];
  if (!isSameDay(day, due)) return null;
  return clamp(due.getHours(), TIMELINE_HOUR_START, TIMELINE_HOUR_END) - TIMELINE_HOUR_START;
}

/** 축 단위 라벨(주 라벨 + 보조 라벨). */
export function unitLabels(unit: Date, mode: TimelineMode): { primary: string; secondary?: string } {
  if (mode === "day") {
    return {
      primary: format(unit, "M/d", { locale: ko }),
      secondary: format(unit, "EEE", { locale: ko }),
    };
  }
  return { primary: `${String(unit.getHours()).padStart(2, "0")}:00` };
}

/** 이 축 단위가 "지금"인가 (오늘 날짜 / 오늘의 현재 시각). */
export function isUnitNow(unit: Date, mode: TimelineMode): boolean {
  if (mode === "day") return isToday(unit);
  return isToday(unit) && unit.getHours() === new Date().getHours();
}
