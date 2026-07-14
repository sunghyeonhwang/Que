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

/** 마감 버튼 라벨: "7월 18일(금) 17:00" / 날짜만 "7월 18일(금)" / 미설정 "마감 미정". */
export function formatDueLabel(dueDate?: string, dueTime?: string): string {
  if (!dueDate) return "마감 미정";
  const { m, d } = parseKey(dueDate);
  const base = `${m}월 ${d}일(${WEEKDAYS[weekdayOf(dueDate)]})`;
  return dueTime ? `${base} ${dueTime}` : base;
}

/** 마감 시각 허용 창(2026-07-15 사용자 확정 — 마감은 오전 11시~오후 5시에만 존재). */
export const DUE_TIME_MIN = "11:00";
export const DUE_TIME_MAX = "17:00";

/** 11:00~17:00, 30분 간격 슬롯. */
function buildSlots(): string[] {
  const out: string[] = [];
  for (let h = 11; h <= 17; h++) {
    out.push(`${pad(h)}:00`);
    if (h < 17) out.push(`${pad(h)}:30`);
  }
  return out;
}

/** HH:mm을 허용 창 안으로 클램프(직접 입력 방어). */
function clampDueTime(time: string): string {
  if (!time) return time;
  if (time < DUE_TIME_MIN) return DUE_TIME_MIN;
  if (time > DUE_TIME_MAX) return DUE_TIME_MAX;
  return time;
}

export interface DuePickerProps {
  dueDate: string; // YYYY-MM-DD | ""
  dueTime: string; // HH:mm | ""
  startTime: string; // HH:mm | ""
  onSelectDate: (date: string) => void;
  onSelectDueTime: (time: string) => void;
  onSelectStartTime: (time: string) => void;
  onClear?: () => void;
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
  triggerAriaLabel = "마감 설정",
  triggerClassName,
}: DuePickerProps) {
  const slots = useMemo(() => buildSlots(), []);
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
          {formatDueLabel(dueDate, dueTime)}
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
          <TimePresetChips value={dueTime} onSelect={onSelectDueTime} />
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

        {/* 마감 시각 슬롯 + 직접 입력 */}
        <div className="flex flex-col gap-1.5 border-t border-[var(--que-border)] pt-2.5">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-medium text-[var(--que-text-tertiary)]">
              마감 시각
            </p>
            <input
              type="time"
              value={dueTime}
              min={DUE_TIME_MIN}
              max={DUE_TIME_MAX}
              onChange={(e) => onSelectDueTime(clampDueTime(e.target.value))}
              aria-label="마감 시각 직접 입력 (11:00~17:00)"
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

        {/* 시작 시각(마감 −1h 자동, 수동 편집 가능) */}
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
            value={startTime}
            onChange={(e) => onSelectStartTime(e.target.value)}
            aria-label="시작 시각"
            className="h-9 rounded-lg border border-[var(--que-border)] bg-transparent px-2 text-sm"
          />
        </div>

        {hasDue && onClear && (
          <button
            type="button"
            onClick={onClear}
            className="flex h-10 items-center justify-center gap-1.5 rounded-lg border border-[var(--que-border)] text-sm text-[var(--que-text-secondary)] hover:bg-[var(--que-bg-muted)]"
          >
            <X className="size-4" aria-hidden />
            마감 지우기
          </button>
        )}
      </PopoverContent>
    </Popover>
  );
}
