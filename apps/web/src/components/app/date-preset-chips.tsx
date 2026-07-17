"use client";

import { useMemo } from "react";
import { cn } from "@/lib/utils";

// 마감일/시각 빠른 선택 칩(작업 입력·마일스톤 등에서 재사용 전제).
// 날짜 계산은 브라우저 로컬 TZ가 아니라 KST 벽시계 기준으로 한다(회사 TZ 고정 관례).
// 서버는 instrumentation.ts에서 TZ=Asia/Seoul로 고정되지만 클라이언트는 사용자 로컬이라,
// Intl(timeZone:"Asia/Seoul")로 오늘의 KST 달력 날짜를 뽑고 UTC 앵커 Date로 요일 산술을 한다
// (로컬 TZ 드리프트 없이 순수 벽시계 계산). view-format.ts의 KST Intl 패턴과 동일 계열.

const TZ = "Asia/Seoul";

/** YYYY-MM-DD → UTC 앵커 Date(요일·가감 산술용 — 로컬 TZ 영향 없음). */
function toAnchor(key: string): Date {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

function keyOf(date: Date): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  const d = String(date.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function addDays(date: Date, n: number): Date {
  const next = new Date(date.getTime());
  next.setUTCDate(next.getUTCDate() + n);
  return next;
}

export interface DatePreset {
  label: string;
  key: string; // YYYY-MM-DD
}

/** 오늘·내일·다가오는 금요일·다음 주 월요일(모두 KST 벽시계 기준). */
export function computeDatePresets(now: Date = new Date()): DatePreset[] {
  const todayKey = new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
  const today = toAnchor(todayKey);
  const day = today.getUTCDay(); // 0=일 … 5=금 … 6=토
  // 다가오는 금요일: 오늘이 금이면 오늘(0), 토·일이면 다음 주 금.
  const untilFriday = (5 - day + 7) % 7;
  // 다음 주 월요일: 오늘이 월이면 +7(이번 주가 아니라 다음 월), 그 외엔 다가오는 월.
  const untilNextMonday = ((1 - day + 7) % 7) || 7;
  return [
    { label: "오늘", key: todayKey },
    { label: "내일", key: keyOf(addDays(today, 1)) },
    { label: "금요일", key: keyOf(addDays(today, untilFriday)) },
    { label: "다음 주 월", key: keyOf(addDays(today, untilNextMonday)) },
  ];
}

// 마감 시각 허용 창 11:00~17:00(2026-07-15 사용자 확정 — due-picker의 DUE_TIME_MIN/MAX와 정합).
export const TIME_PRESETS = ["11:00", "14:00", "17:00"] as const;

// 운영 도구 톤: 작은 outline 칩, hover. 활성=브랜드(상태색 의미 침범 금지). 최소 40px 터치(h-10).
const CHIP_BASE =
  "inline-flex h-10 min-w-10 items-center justify-center rounded-lg border px-3 text-sm transition-colors focus-visible:outline-2 focus-visible:outline-[var(--que-brand)]";
const CHIP_ON =
  "border-[var(--que-brand)] bg-[var(--que-brand-subtle)] font-semibold text-[var(--que-brand)]";
const CHIP_OFF =
  "border-[var(--que-border)] text-[var(--que-text-secondary)] hover:bg-[var(--que-bg-muted)] hover:text-[var(--que-text)]";

/** 마감일 프리셋 칩. value(YYYY-MM-DD)가 칩과 일치하면 활성(aria-pressed). onSelect로 상태만 set. */
export function DatePresetChips({
  value,
  onSelect,
  ariaLabel = "마감일 빠른 선택",
  className,
}: {
  value?: string;
  onSelect: (key: string) => void;
  ariaLabel?: string;
  className?: string;
}) {
  const presets = useMemo(() => computeDatePresets(), []);
  return (
    <div
      role="group"
      aria-label={ariaLabel}
      className={cn("flex flex-wrap gap-1.5", className)}
    >
      {presets.map((p) => {
        const active = value === p.key;
        return (
          <button
            key={p.label}
            type="button"
            aria-pressed={active}
            title={p.key}
            onClick={() => onSelect(p.key)}
            className={cn(CHIP_BASE, active ? CHIP_ON : CHIP_OFF)}
          >
            {p.label}
          </button>
        );
      })}
    </div>
  );
}

// 예상 소요 프리셋(시간 단위). 값은 core estimatedHours와 동일 단위(시간).
export const HOUR_PRESETS: readonly { label: string; value: number }[] = [
  { label: "30분", value: 0.5 },
  { label: "1시간", value: 1 },
  { label: "2시간", value: 2 },
  { label: "4시간", value: 4 },
  { label: "하루", value: 8 },
] as const;

/**
 * 예상 소요 프리셋 칩([30분][1시간][2시간][4시간][하루]). value(시간)가 칩과 일치하면 활성.
 * 활성 칩을 다시 누르면 해제(undefined). 직접 입력 Input과 병행 사용한다.
 */
export function HourPresetChips({
  value,
  onSelect,
  ariaLabel = "예상 소요 빠른 선택",
  className,
}: {
  value?: number;
  onSelect: (hours: number | undefined) => void;
  ariaLabel?: string;
  className?: string;
}) {
  return (
    <div
      role="group"
      aria-label={ariaLabel}
      className={cn("flex flex-wrap gap-1.5", className)}
    >
      {HOUR_PRESETS.map((p) => {
        const active = value === p.value;
        return (
          <button
            key={p.label}
            type="button"
            aria-pressed={active}
            onClick={() => onSelect(active ? undefined : p.value)}
            className={cn(CHIP_BASE, active ? CHIP_ON : CHIP_OFF)}
          >
            {p.label}
          </button>
        );
      })}
    </div>
  );
}

/** 마감 시각 프리셋 칩([10:00][14:00][18:00]). value(HH:mm)가 일치하면 활성. */
export function TimePresetChips({
  value,
  onSelect,
  ariaLabel = "마감 시각 빠른 선택",
  className,
}: {
  value?: string;
  onSelect: (time: string) => void;
  ariaLabel?: string;
  className?: string;
}) {
  return (
    <div
      role="group"
      aria-label={ariaLabel}
      className={cn("flex flex-wrap gap-1.5", className)}
    >
      {TIME_PRESETS.map((t) => {
        const active = value === t;
        return (
          <button
            key={t}
            type="button"
            aria-pressed={active}
            onClick={() => onSelect(t)}
            className={cn(CHIP_BASE, active ? CHIP_ON : CHIP_OFF)}
          >
            {t}
          </button>
        );
      })}
    </div>
  );
}
