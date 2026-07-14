"use client";

import { useMemo, useState } from "react";
import { CalendarDays, ChevronLeft, ChevronRight, X } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  DatePresetChips,
  TimePresetChips,
} from "@/components/app/date-preset-chips";
import { cn } from "@/lib/utils";

// 통합 마감 설정(B안) — 마감일 + 마감 시각 + 시작 시각을 버튼 1개 → 팝오버로.
// 달력은 의존성 추가 없이 직접 구현하고 KST 벽시계 기준으로 계산한다(로컬 TZ 드리프트 없음).
// 작업 입력 등에서 재사용 전제의 공용 컴포넌트.

const TZ = "Asia/Seoul";
const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];
const pad = (n: number) => String(n).padStart(2, "0");

/** 오늘의 KST 날짜 키(YYYY-MM-DD). */
function kstTodayKey(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}
function parseKey(key: string): { y: number; m: number; d: number } {
  const [y, m, d] = key.split("-").map(Number);
  return { y, m, d }; // m 1-based
}
function keyOfYmd(y: number, m1: number, d: number): string {
  return `${y}-${pad(m1)}-${pad(d)}`;
}
/** UTC 앵커로 요일 계산(로컬 TZ 무관). 0=일 … 6=토. */
function weekdayOf(key: string): number {
  const { y, m, d } = parseKey(key);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}
function daysInMonth(y: number, m1: number): number {
  return new Date(Date.UTC(y, m1, 0)).getUTCDate();
}

/** 버튼 라벨: "7월 18일(금) 17:00" / 날짜만 "7월 18일(금)" / 미설정 emptyLabel.
 *  showTime=false거나 dueTime 없으면 날짜만 표기. */
export function formatDueLabel(
  dueDate?: string,
  dueTime?: string,
  opts?: { showTime?: boolean; emptyLabel?: string },
): string {
  const emptyLabel = opts?.emptyLabel ?? "마감 미정";
  if (!dueDate) return emptyLabel;
  const { m, d } = parseKey(dueDate);
  const base = `${m}월 ${d}일(${WEEKDAYS[weekdayOf(dueDate)]})`;
  const withTime = opts?.showTime !== false && dueTime;
  return withTime ? `${base} ${dueTime}` : base;
}

/** 마감 시각 허용 창(2026-07-15 사용자 확정 — 마감은 오전 11시~오후 5시에만 존재). 기본값. */
export const DUE_TIME_MIN = "11:00";
export const DUE_TIME_MAX = "17:00";

/** datetime-local 문자열("yyyy-MM-ddTHH:mm") ↔ DuePicker의 date/time 분리 헬퍼.
 *  기존 datetime-local 입력을 쓰던 폼이 페이로드 형식을 그대로 유지하며 UI만 교체할 때 쓴다. */
export function splitDateTimeLocal(v: string): { date: string; time: string } {
  if (!v) return { date: "", time: "" };
  return { date: v.slice(0, 10), time: v.length >= 16 ? v.slice(11, 16) : "" };
}
export function joinDateTimeLocal(
  date: string,
  time: string,
  defaultTime = "10:00",
): string {
  if (!date) return "";
  return `${date}T${time || defaultTime}`;
}

const toMin = (t: string) => {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
};
const fromMin = (t: number) => `${pad(Math.floor(t / 60))}:${pad(t % 60)}`;

/** [min, max] 30분 간격 슬롯(min이 :00/:30 정렬 가정). */
function buildSlots(min: string, max: string): string[] {
  const start = toMin(min);
  const end = toMin(max);
  const out: string[] = [];
  for (let t = start; t <= end; t += 30) out.push(fromMin(t));
  return out;
}

/** HH:mm을 허용 창 안으로 클램프(직접 입력 방어). */
function clampTime(time: string, min: string, max: string): string {
  if (!time) return time;
  if (time < min) return min;
  if (time > max) return max;
  return time;
}

export interface DuePickerProps {
  dueDate: string; // YYYY-MM-DD | ""
  dueTime: string; // HH:mm | ""
  onSelectDate: (date: string) => void;
  onSelectDueTime: (time: string) => void;
  /** 시작 시각 절(선택). 둘 다 주면 하단에 시작 시각 절을 렌더한다(미전달 시 미렌더). */
  startTime?: string; // HH:mm | ""
  onSelectStartTime?: (time: string) => void;
  onClear?: () => void;
  /** 시각 허용 창(30분 슬롯·클램프·time input min/max). 기본 11:00~17:00(마감 창). */
  timeMin?: string;
  timeMax?: string;
  /** 시각 선택 UI를 숨기고 순수 날짜 필드로 쓴다(기본 true=시각 노출). */
  showTime?: boolean;
  /** 미설정 라벨(기본 "마감 미정" — "일시 미정" 등 대체). */
  emptyLabel?: string;
  triggerAriaLabel?: string;
  triggerClassName?: string;
}

export function DuePicker({
  dueDate,
  dueTime,
  startTime,
  onSelectDate,
  onSelectDueTime,
  onSelectStartTime,
  onClear,
  timeMin = DUE_TIME_MIN,
  timeMax = DUE_TIME_MAX,
  showTime = true,
  emptyLabel = "마감 미정",
  triggerAriaLabel = "마감 설정",
  triggerClassName,
}: DuePickerProps) {
  const slots = useMemo(() => buildSlots(timeMin, timeMax), [timeMin, timeMax]);
  const todayKey = useMemo(() => kstTodayKey(), []);
  // 보이는 달: 선택일 있으면 그 달, 없으면 오늘 달. 마운트 시 1회 초기화.
  const init = parseKey(dueDate || todayKey);
  const [view, setView] = useState({ y: init.y, m: init.m }); // m 1-based

  const shift = (delta: number) =>
    setView((v) => {
      let y = v.y;
      let m = v.m + delta;
      if (m < 1) {
        m = 12;
        y -= 1;
      } else if (m > 12) {
        m = 1;
        y += 1;
      }
      return { y, m };
    });

  const firstWeekday = weekdayOf(keyOfYmd(view.y, view.m, 1));
  const dim = daysInMonth(view.y, view.m);
  const cells: (string | null)[] = [
    ...Array.from({ length: firstWeekday }, () => null),
    ...Array.from({ length: dim }, (_, i) => keyOfYmd(view.y, view.m, i + 1)),
  ];

  const hasDue = Boolean(dueDate);

  return (
    <Popover>
      <PopoverTrigger
        aria-label={triggerAriaLabel}
        className={cn(
          "flex h-10 w-full items-center gap-2 rounded-lg border border-[var(--que-border)] bg-transparent px-2.5 text-left text-sm transition-colors hover:bg-[var(--que-bg-muted)] focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50",
          triggerClassName,
        )}
      >
        <CalendarDays
          className="size-4 shrink-0 text-[var(--que-text-tertiary)]"
          aria-hidden
        />
        <span
          className={cn(
            "min-w-0 flex-1 truncate",
            hasDue ? "text-[var(--que-text)]" : "text-[var(--que-text-tertiary)]",
          )}
        >
          {formatDueLabel(dueDate, dueTime, { showTime, emptyLabel })}
        </span>
      </PopoverTrigger>

      <PopoverContent
        align="start"
        className="max-h-[min(80vh,34rem)] w-80 gap-3 overflow-y-auto"
      >
        {/* 프리셋 칩 재사용 */}
        <div className="flex flex-col gap-2">
          <p className="text-xs font-medium text-[var(--que-text-tertiary)]">
            빠른 선택
          </p>
          <DatePresetChips value={dueDate} onSelect={onSelectDate} />
          {showTime && <TimePresetChips value={dueTime} onSelect={onSelectDueTime} />}
        </div>

        {/* 콤팩트 월 달력(KST) */}
        <div className="flex flex-col gap-1.5 border-t border-[var(--que-border)] pt-2.5">
          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={() => shift(-1)}
              aria-label="이전 달"
              className="grid size-10 place-items-center rounded-lg text-[var(--que-text-secondary)] hover:bg-[var(--que-bg-muted)]"
            >
              <ChevronLeft className="size-4" aria-hidden />
            </button>
            <span className="text-sm font-semibold text-[var(--que-text)]">
              {view.y}년 {view.m}월
            </span>
            <button
              type="button"
              onClick={() => shift(1)}
              aria-label="다음 달"
              className="grid size-10 place-items-center rounded-lg text-[var(--que-text-secondary)] hover:bg-[var(--que-bg-muted)]"
            >
              <ChevronRight className="size-4" aria-hidden />
            </button>
          </div>
          <div className="grid grid-cols-7">
            {WEEKDAYS.map((w) => (
              <span
                key={w}
                className="grid h-7 place-items-center text-[11px] font-medium text-[var(--que-text-tertiary)]"
              >
                {w}
              </span>
            ))}
            {cells.map((key, idx) =>
              key === null ? (
                <span key={`blank-${idx}`} className="size-10" aria-hidden />
              ) : (
                (() => {
                  const day = Number(key.slice(-2));
                  const selected = key === dueDate;
                  const isToday = key === todayKey;
                  return (
                    <button
                      key={key}
                      type="button"
                      aria-pressed={selected}
                      aria-label={`${view.m}월 ${day}일${isToday ? " (오늘)" : ""}`}
                      onClick={() => onSelectDate(key)}
                      className={cn(
                        "grid size-10 place-items-center rounded-lg text-sm transition-colors",
                        selected
                          ? "bg-[var(--que-brand)] font-semibold text-[var(--que-on-brand)]"
                          : "text-[var(--que-text)] hover:bg-[var(--que-bg-muted)]",
                        !selected &&
                          isToday &&
                          "font-semibold text-[var(--que-brand)] ring-1 ring-inset ring-[var(--que-brand)]",
                      )}
                    >
                      {day}
                    </button>
                  );
                })()
              ),
            )}
          </div>
        </div>

        {/* 시각 슬롯 + 직접 입력 — showTime일 때만 */}
        {showTime && (
          <div className="flex flex-col gap-1.5 border-t border-[var(--que-border)] pt-2.5">
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs font-medium text-[var(--que-text-tertiary)]">
                시각
              </p>
              <input
                type="time"
                value={dueTime}
                min={timeMin}
                max={timeMax}
                onChange={(e) =>
                  onSelectDueTime(clampTime(e.target.value, timeMin, timeMax))
                }
                aria-label={`시각 직접 입력 (${timeMin}~${timeMax})`}
                className="h-9 rounded-lg border border-[var(--que-border)] bg-transparent px-2 text-sm"
              />
            </div>
            <div className="grid max-h-36 grid-cols-4 gap-1 overflow-y-auto">
              {slots.map((t) => {
                const active = t === dueTime;
                return (
                  <button
                    key={t}
                    type="button"
                    aria-pressed={active}
                    onClick={() => onSelectDueTime(t)}
                    className={cn(
                      "h-10 rounded-lg border text-xs transition-colors",
                      active
                        ? "border-[var(--que-brand)] bg-[var(--que-brand-subtle)] font-semibold text-[var(--que-brand)]"
                        : "border-[var(--que-border)] text-[var(--que-text-secondary)] hover:bg-[var(--que-bg-muted)]",
                    )}
                  >
                    {t}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* 시작 시각(마감 −1h 자동, 수동 편집 가능) — 시작 절 사용처에서만 렌더 */}
        {showTime && onSelectStartTime && (
          <div className="flex items-center justify-between gap-2 border-t border-[var(--que-border)] pt-2.5">
            <div className="flex flex-col">
              <p className="text-xs font-medium text-[var(--que-text-tertiary)]">
                시작 시각
              </p>
              <p className="text-[11px] text-[var(--que-text-tertiary)]">
                마감 1시간 전 자동 · 직접 조정 가능
              </p>
            </div>
            <input
              type="time"
              value={startTime ?? ""}
              onChange={(e) => onSelectStartTime(e.target.value)}
              aria-label="시작 시각"
              className="h-9 rounded-lg border border-[var(--que-border)] bg-transparent px-2 text-sm"
            />
          </div>
        )}

        {hasDue && onClear && (
          <button
            type="button"
            onClick={onClear}
            className="flex h-10 items-center justify-center gap-1.5 rounded-lg border border-[var(--que-border)] text-sm text-[var(--que-text-secondary)] hover:bg-[var(--que-bg-muted)]"
          >
            <X className="size-4" aria-hidden />
            지우기
          </button>
        )}
      </PopoverContent>
    </Popover>
  );
}
