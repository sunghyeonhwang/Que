"use client";

import { useMemo, useState } from "react";
import { CalendarSearch, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  WEEKDAYS,
  daysInMonth,
  keyOfYmd,
  kstTodayKey,
  parseKey,
  weekdayOf,
} from "@/components/app/due-picker";
import { cn } from "@/lib/utils";

/** 미니 달력 날짜 점프 — KST 월 달력(due-picker 헬퍼 재사용, react-day-picker 미사용).
 * 날짜를 고르면 onSelect(YYYY-MM-DD)로 위임한다(다른 파라미터 보존은 호출부 pushParams가 담당). */
export function DateJump({
  anchorIso,
  onSelect,
}: {
  /** 현재 기준 날짜 YYYY-MM-DD — 강조 표시·초기 보이는 달. */
  anchorIso: string;
  onSelect: (dateKey: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const todayKey = useMemo(() => kstTodayKey(), []);
  const init = parseKey(anchorIso || todayKey);
  // 보이는 달(m 1-based). 팝오버를 열 때마다 현재 anchor 달로 리셋한다.
  const [view, setView] = useState({ y: init.y, m: init.m });

  const onOpenChange = (next: boolean) => {
    if (next) {
      const cur = parseKey(anchorIso || todayKey);
      setView({ y: cur.y, m: cur.m });
    }
    setOpen(next);
  };

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

  const pick = (key: string) => {
    onSelect(key);
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger
        render={
          <Button
            variant="outline"
            aria-label="날짜로 이동"
            className="size-10 rounded-lg border-[var(--que-border)] p-0"
          />
        }
      >
        <CalendarSearch className="size-4" aria-hidden />
      </PopoverTrigger>
      <PopoverContent align="start" className="w-72 gap-1.5">
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
                const selected = key === anchorIso;
                const isToday = key === todayKey;
                return (
                  <button
                    key={key}
                    type="button"
                    aria-pressed={selected}
                    aria-label={`${view.m}월 ${day}일${isToday ? " (오늘)" : ""}`}
                    onClick={() => pick(key)}
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
      </PopoverContent>
    </Popover>
  );
}
