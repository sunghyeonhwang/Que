"use client";

import { useMemo, useState } from "react";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  WEEKDAYS,
  kstTodayKey,
  parseKey,
  keyOfYmd,
  weekdayOf,
  daysInMonth,
  addDaysKey,
} from "@/components/app/due-picker";
import { DatePresetChips } from "@/components/app/date-preset-chips";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

// 기간(범위) 선택 캘린더 — 한 그리드에서 시작일·마감일을 찍으면 두 마커(원형 채움)와
// 사이 기간이 연속 밴드로 하이라이트된다. 색은 Que 브랜드 인디고(마커=brand, 밴드=brand-subtle).
// 달력 원시 헬퍼는 due-picker에서 재사용(중복 구현 금지). KST 벽시계 기준.

/** "7월 21일(월)" */
function dayLabel(key: string): string {
  const { m, d } = parseKey(key);
  return `${m}월 ${d}일(${WEEKDAYS[weekdayOf(key)]})`;
}

/** 트리거 라벨: 기간 "7월 21일(월) ~ 7월 25일(금)"(+마감시각), 하루 "7월 21일(월)", 미설정 emptyLabel. */
export function formatRangeLabel(
  startDate: string,
  startTime: string,
  endDate: string,
  endTime: string,
  opts?: { showTime?: boolean; emptyLabel?: string },
): string {
  const emptyLabel = opts?.emptyLabel ?? "기간 미정";
  if (!startDate) return emptyLabel;
  const single = !endDate || endDate === startDate;
  const base = single
    ? dayLabel(startDate)
    : `${dayLabel(startDate)} ~ ${dayLabel(endDate)}`;
  const t = opts?.showTime !== false && endTime ? ` ${endTime}` : "";
  return base + t;
}

export interface DateRange {
  startDate: string; // YYYY-MM-DD | ""
  startTime: string; // HH:mm | ""
  endDate: string; // YYYY-MM-DD | ""
  endTime: string; // HH:mm | ""
}

// ---- 시각 슬롯(30분 단위 드롭다운) ----
// 업무 도구에서 고를 일 없는 심야(00:30~05:30)는 목록에서 뺀다(2026-07-20 사용자 요청).
// 자정(00:00)은 "그날 끝" 의미로 남긴다. 범위 밖 기존 값(예: 03:00, 14:05)은 지우지 않고
// 그 값만 옵션에 끼워 표시한다 — 과거 데이터·파서 결과가 깨지지 않게.
const TIME_NONE = "__none__"; // base-ui Select는 빈 문자열 값이 까다로워 미지정 sentinel 사용

function toMin(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}
function fromMin(min: number): string {
  return `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;
}

const TIME_SLOTS: string[] = (() => {
  const out: string[] = ["00:00"];
  for (let t = 6 * 60; t <= 23 * 60 + 30; t += 30) out.push(fromMin(t));
  return out;
})();

/** t + 1시간(23:30 상한). 시작 시각을 정하면 마감을 자동으로 이 값으로 둔다. */
function plusOneHour(t: string): string {
  return fromMin(Math.min(toMin(t) + 60, 23 * 60 + 30));
}

/** 시각 드롭다운 — 미지정 + 슬롯(+범위 밖 현재 값). */
function TimeSelect({
  value,
  onChange,
  ariaLabel,
}: {
  value: string;
  onChange: (next: string) => void;
  ariaLabel: string;
}) {
  const options = useMemo(() => {
    if (!value || TIME_SLOTS.includes(value)) return TIME_SLOTS;
    return [...TIME_SLOTS, value].sort((a, b) => toMin(a) - toMin(b));
  }, [value]);
  const items = {
    [TIME_NONE]: "미지정",
    ...Object.fromEntries(options.map((t) => [t, t])),
  };
  return (
    <Select
      items={items}
      value={value || TIME_NONE}
      onValueChange={(v) => onChange(v === TIME_NONE || !v ? "" : (v as string))}
    >
      <SelectTrigger aria-label={ariaLabel} className="h-9 min-h-9 w-28 tabular-nums">
        <SelectValue />
      </SelectTrigger>
      <SelectContent className="max-h-64">
        <SelectItem value={TIME_NONE}>미지정</SelectItem>
        {options.map((t) => (
          <SelectItem key={t} value={t}>
            {t}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export interface DateRangePickerProps {
  value: DateRange;
  onChange: (next: DateRange) => void;
  /** 하루 고정(재일정 등) — 클릭 한 번에 시작=마감 동일 날짜. 기간 밴드 없음. */
  singleDay?: boolean;
  /** 시각 절(시작·마감 자유 입력) 노출. 기본 true. */
  showTime?: boolean;
  /** 인라인 변형 — Popover 래핑을 생략하고 달력 본문만 렌더한다(트리거·부모 표시는 호출부가 담당).
   *  Popover 안 Popover 중첩 시 부모가 닫히는 문제를 피하려 팝오버 안에서 아코디언처럼 펼칠 때 쓴다. */
  inline?: boolean;
  emptyLabel?: string;
  triggerAriaLabel?: string;
  triggerClassName?: string;
}

export function DateRangePicker({
  value,
  onChange,
  singleDay = false,
  showTime = true,
  inline = false,
  emptyLabel = "기간 미정",
  triggerAriaLabel = "기간 설정",
  triggerClassName,
}: DateRangePickerProps) {
  const { startDate, startTime, endDate, endTime } = value;
  const todayKey = useMemo(() => kstTodayKey(), []);
  const init = parseKey(startDate || todayKey);
  const [view, setView] = useState({ y: init.y, m: init.m }); // m 1-based
  // 진행 중 선택의 시작점(두 번째 클릭 대기). 처음부터 start만 있으면 그걸 기점으로.
  const [pendingStart, setPendingStart] = useState<string | null>(
    startDate && !endDate ? startDate : null,
  );

  // 기간 프리셋(시작·마감 동시). singleDay면 단일 날짜 칩으로 대체.
  const presets = useMemo(() => {
    const today = kstTodayKey();
    const day = weekdayOf(today);
    const friday = addDaysKey(today, (5 - day + 7) % 7);
    const nextMonday = addDaysKey(today, ((1 - day + 7) % 7) || 7);
    const nextFriday = addDaysKey(nextMonday, 4);
    return [
      { label: "오늘 하루", start: today, end: today },
      { label: "오늘~금요일", start: today, end: friday },
      { label: "다음 주(월~금)", start: nextMonday, end: nextFriday },
      { label: "+1주", start: today, end: addDaysKey(today, 7) },
    ];
  }, []);

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

  const pickDate = (k: string) => {
    if (singleDay) {
      onChange({ ...value, startDate: k, endDate: k });
      return;
    }
    if (pendingStart === null) {
      // 새 선택 시작(미선택이거나 완성 상태) — 시작만 세팅, 마감 비움.
      setPendingStart(k);
      onChange({ ...value, startDate: k, endDate: "" });
    } else {
      // 두 번째 클릭 — 앞뒤 정렬해 시작·마감 확정(같은 날이면 하루짜리).
      const lo = k < pendingStart ? k : pendingStart;
      const hi = k < pendingStart ? pendingStart : k;
      setPendingStart(null);
      onChange({ ...value, startDate: lo, endDate: hi });
    }
  };

  const applyPreset = (start: string, end: string) => {
    setPendingStart(null);
    onChange({ ...value, startDate: start, endDate: end });
  };

  // 시작 시각을 정하면 마감 시각을 +1시간으로 자동 제안한다(2026-07-20 사용자 요청).
  // 마감이 비어 있거나, 같은 날(또는 마감일 미정) 범위에서 마감이 시작 이하로 어긋난 경우만
  // 덮어쓴다 — 사용자가 이미 늦은 마감을 골라뒀다면 존중.
  const setStartTime = (t: string) => {
    const sameDay = singleDay || !endDate || endDate === startDate;
    const autoEnd =
      t !== "" && (!endTime || (sameDay && toMin(endTime) <= toMin(t)));
    onChange({ ...value, startTime: t, endTime: autoEnd ? plusOneHour(t) : endTime });
  };

  const firstWeekday = weekdayOf(keyOfYmd(view.y, view.m, 1));
  const dim = daysInMonth(view.y, view.m);
  const cells: (string | null)[] = [
    ...Array.from({ length: firstWeekday }, () => null),
    ...Array.from({ length: dim }, (_, i) => keyOfYmd(view.y, view.m, i + 1)),
  ];

  const hasRange = Boolean(startDate && endDate);
  const sameDay = hasRange && startDate === endDate;
  const hasStart = Boolean(startDate);

  const body = (
    <>
        {/* 빠른 선택(프리셋 버튼) */}
        <div className="flex flex-col gap-2">
          <p className="text-xs font-medium text-[var(--que-text-tertiary)]">
            빠른 선택
          </p>
          {singleDay ? (
            <DatePresetChips
              value={startDate}
              onSelect={(d) => applyPreset(d, d)}
              ariaLabel="날짜 빠른 선택"
            />
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {presets.map((p) => {
                const active = startDate === p.start && endDate === p.end;
                return (
                  <button
                    key={p.label}
                    type="button"
                    aria-pressed={active}
                    onClick={() => applyPreset(p.start, p.end)}
                    className={cn(
                      "inline-flex h-10 items-center justify-center rounded-lg border px-3 text-sm transition-colors",
                      active
                        ? "border-[var(--que-brand)] bg-[var(--que-brand-subtle)] font-semibold text-[var(--que-brand)]"
                        : "border-[var(--que-border)] text-[var(--que-text-secondary)] hover:bg-[var(--que-bg-muted)] hover:text-[var(--que-text)]",
                    )}
                  >
                    {p.label}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* 콤팩트 월 달력(KST) + 기간 밴드 */}
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
                  const isStart = key === startDate && hasStart;
                  const isEnd = hasRange && key === endDate;
                  const endpoint = isStart || isEnd;
                  const inRange =
                    hasRange && !sameDay && key > startDate && key < endDate;
                  const bandRight = hasRange && !sameDay && isStart;
                  const bandLeft = hasRange && !sameDay && isEnd;
                  const isToday = key === todayKey;
                  return (
                    <div
                      key={key}
                      className="relative grid size-10 place-items-center"
                    >
                      {/* 연속 밴드(brand-subtle) — 셀 폭을 꽉 채워 인접 셀과 이어진다 */}
                      {inRange && (
                        <span
                          aria-hidden
                          className="absolute inset-x-0 inset-y-1 bg-[var(--que-brand-subtle)]"
                        />
                      )}
                      {bandRight && (
                        <span
                          aria-hidden
                          className="absolute inset-y-1 left-1/2 right-0 bg-[var(--que-brand-subtle)]"
                        />
                      )}
                      {bandLeft && (
                        <span
                          aria-hidden
                          className="absolute inset-y-1 left-0 right-1/2 bg-[var(--que-brand-subtle)]"
                        />
                      )}
                      <button
                        type="button"
                        aria-pressed={endpoint}
                        aria-label={`${view.m}월 ${day}일${isToday ? " (오늘)" : ""}${
                          isStart ? " 시작" : ""
                        }${isEnd ? " 마감" : ""}`}
                        onClick={() => pickDate(key)}
                        className={cn(
                          "relative grid size-9 place-items-center rounded-full text-sm transition-colors",
                          endpoint
                            ? "bg-[var(--que-brand)] font-semibold text-[var(--que-on-brand)]"
                            : "text-[var(--que-text)] hover:bg-[var(--que-bg-muted)]",
                          !endpoint &&
                            !inRange &&
                            isToday &&
                            "font-semibold text-[var(--que-brand)] ring-1 ring-inset ring-[var(--que-brand)]",
                        )}
                      >
                        {day}
                      </button>
                    </div>
                  );
                })()
              ),
            )}
          </div>
          {!singleDay && (
            <p className="text-[11px] text-[var(--que-text-tertiary)]">
              시작일과 마감일을 차례로 누르세요. 같은 날을 두 번 누르면 하루짜리입니다.
            </p>
          )}
        </div>

        {/* 시각 절 — 30분 슬롯 드롭다운(심야 제외). 시작을 고르면 마감이 +1시간 자동. */}
        {showTime && (
          <div className="flex flex-col gap-2 border-t border-[var(--que-border)] pt-2.5">
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs font-medium text-[var(--que-text-tertiary)]">
                시작 시각
              </p>
              <TimeSelect value={startTime} onChange={setStartTime} ariaLabel="시작 시각" />
            </div>
            <div className="flex items-center justify-between gap-2">
              <div className="flex flex-col">
                <p className="text-xs font-medium text-[var(--que-text-tertiary)]">
                  마감 시각
                </p>
                <p className="text-[11px] text-[var(--que-text-tertiary)]">
                  시작 +1시간 자동 · 직접 조정 가능
                </p>
              </div>
              <TimeSelect
                value={endTime}
                onChange={(t) => onChange({ ...value, endTime: t })}
                ariaLabel="마감 시각"
              />
            </div>
          </div>
        )}
    </>
  );

  // 인라인: 부모(팝오버 등) 본문에 달력을 직접 펼친다 — 중첩 Popover 회피.
  if (inline) {
    return (
      <div className="flex max-h-[min(55vh,30rem)] flex-col gap-3 overflow-y-auto rounded-lg border border-[var(--que-border)] bg-[var(--que-bg)] p-2.5">
        {body}
      </div>
    );
  }

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
            hasStart ? "text-[var(--que-text)]" : "text-[var(--que-text-tertiary)]",
          )}
        >
          {formatRangeLabel(startDate, startTime, endDate, endTime, {
            showTime,
            emptyLabel,
          })}
        </span>
      </PopoverTrigger>

      <PopoverContent
        align="start"
        className="max-h-[min(80vh,36rem)] w-80 gap-3 overflow-y-auto"
      >
        {body}
      </PopoverContent>
    </Popover>
  );
}
