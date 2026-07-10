"use client";

import { useEffect, useState } from "react";
import { format, isSameDay, isToday } from "date-fns";
import { Lock } from "lucide-react";
import type { CalendarMilestone, CalendarViewItem } from "@/lib/calendar-data";
import { cn } from "@/lib/utils";
import { eventSwatch } from "./event-color";
import { EventDetailPopover } from "./event-detail-popover";
import { MilestoneChip } from "./milestone-chip";
import {
  GRID_HEIGHT,
  HOURS,
  HOUR_HEIGHT,
  START_HOUR,
  END_HOUR,
  layoutDay,
  timeToY,
  type PositionedItem,
} from "./time-layout";

/** 표시 타임존 라벨(디자인 GMT 표기 자리). 한국 팀 기준 고정 표기. */
const TZ_LABEL = "GMT+9";

/** "9:00 - 10:30 AM" / "11:10 AM - 1:00 PM" — AM/PM이 같으면 끝에 한 번만. */
function timeRangeLabel(startAt: string, endAt: string): string {
  const start = new Date(startAt);
  const end = new Date(endAt);
  const sap = format(start, "a");
  const eap = format(end, "a");
  return sap === eap
    ? `${format(start, "h:mm")} - ${format(end, "h:mm")} ${eap}`
    : `${format(start, "h:mm a")} - ${format(end, "h:mm a")}`;
}

/** 시간축 캘린더. days가 1개면 일간, 7개면 주간. 읽기 전용. */
export function WeekCalendar({
  days,
  items,
  milestones = [],
}: {
  days: Date[];
  items: CalendarViewItem[];
  milestones?: CalendarMilestone[];
}) {
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    // 최초 값은 rAF로 지연 세팅해 하이드레이션 불일치를 피한다(효과 본문 동기 setState 회피).
    const raf = requestAnimationFrame(() => setNow(new Date()));
    const timer = setInterval(() => setNow(new Date()), 60_000);
    return () => {
      cancelAnimationFrame(raf);
      clearInterval(timer);
    };
  }, []);

  const showNow =
    now != null &&
    now.getHours() + now.getMinutes() / 60 >= START_HOUR &&
    now.getHours() < END_HOUR &&
    days.some((d) => isSameDay(d, now));
  const nowY = now ? timeToY(now) : 0;
  const colTemplate = `4rem repeat(${days.length}, minmax(0, 1fr))`;
  // 마일스톤 밴드는 표시 기간에 마감 마일스톤이 하나라도 있을 때만 렌더(빈 밴드로 공간 낭비 금지).
  const hasMilestones = days.some((d) => milestones.some((m) => isSameDay(new Date(m.dueAt), d)));
  // 가로 스크롤 임계폭을 컬럼 수에 비례시킨다(시간축 4rem + 컬럼당 6.2rem).
  // 7일=약 760px로 기존 주간 레이아웃 유지, 3일/1일은 과하게 넓어지지 않음.
  const minWidth = `calc(4rem + ${days.length} * 6.2rem)`;

  return (
    <div className="overflow-hidden rounded-xl border border-[var(--que-border)] bg-[var(--que-bg)]">
      <div className="max-h-[calc(100dvh-15rem)] overflow-auto">
        <div style={{ minWidth }}>
          {/* 요일 헤더 + 마일스톤 밴드 (sticky top) */}
          <div className="sticky top-0 z-30 border-b border-[var(--que-border)] bg-[var(--que-bg)]">
            <div className="grid" style={{ gridTemplateColumns: colTemplate }}>
              <div className="sticky left-0 z-10 flex items-center justify-center border-r border-[var(--que-border)] bg-[var(--que-bg)] px-2 py-3 text-[11px] font-medium text-[var(--que-text-tertiary)]">
                {TZ_LABEL}
              </div>
              {days.map((day) => {
                const today = isToday(day);
                return (
                  <div
                    key={day.toISOString()}
                    className={cn(
                      "border-l border-[var(--que-border)] px-2 py-3 text-center",
                      today && "bg-[var(--que-brand-subtle)]",
                    )}
                  >
                    <div
                      className={cn(
                        "text-[11px] font-semibold uppercase tracking-wide",
                        today ? "text-[var(--que-brand)]" : "text-[var(--que-text-tertiary)]",
                      )}
                    >
                      {format(day, "EEE")}
                    </div>
                    <div
                      className={cn(
                        "text-lg font-semibold leading-tight",
                        today ? "text-[var(--que-brand)]" : "text-[var(--que-text)]",
                      )}
                    >
                      {format(day, "d")}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* 마일스톤 종일 밴드 — 해당 요일 마감 마일스톤을 읽기 전용 마커로. 없으면 밴드 자체를 숨김. */}
            {hasMilestones && (
              <div
                className="grid border-t border-[var(--que-border)]"
                style={{ gridTemplateColumns: colTemplate }}
              >
                <div className="sticky left-0 z-10 flex items-center justify-center border-r border-[var(--que-border)] bg-[var(--que-bg)] px-1 py-1 text-[10px] font-medium text-[var(--que-text-tertiary)]">
                  마일스톤
                </div>
                {days.map((day) => {
                  const today = isToday(day);
                  const dayMilestones = milestones.filter((m) => isSameDay(new Date(m.dueAt), day));
                  return (
                    <div
                      key={day.toISOString()}
                      className={cn(
                        "flex min-w-0 flex-col gap-1 border-l border-[var(--que-border)] px-1 py-1",
                        today && "bg-[var(--que-brand-subtle)]",
                      )}
                    >
                      {dayMilestones.map((m) => (
                        <MilestoneChip key={`milestone-${m.id}`} milestone={m} />
                      ))}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* 본문: 시간축 + 요일 컬럼 */}
          <div className="flex">
            {/* 시간축 (sticky left) */}
            <div
              className="sticky left-0 z-20 w-16 shrink-0 border-r border-[var(--que-border)] bg-[var(--que-bg)]"
              style={{ height: GRID_HEIGHT }}
            >
              <div className="relative h-full">
                {HOURS.map((hour) => (
                  <div
                    key={hour}
                    className="absolute right-2 -translate-y-1/2 text-[11px] tabular-nums text-[var(--que-text-tertiary)]"
                    style={{ top: (hour - START_HOUR) * HOUR_HEIGHT }}
                  >
                    {format(new Date(2000, 0, 1, hour), "h a")}
                  </div>
                ))}
                {showNow && (
                  <div
                    className="absolute right-1 z-10 -translate-y-1/2 rounded bg-[var(--que-brand)] px-1 py-0.5 text-[10px] font-semibold tabular-nums text-[var(--que-on-brand)]"
                    style={{ top: nowY }}
                  >
                    {format(now!, "hh:mm a")}
                  </div>
                )}
              </div>
            </div>

            {/* 요일 컬럼 영역 */}
            <div className="relative flex flex-1" style={{ height: GRID_HEIGHT }}>
              {days.map((day) => (
                <DayColumn key={day.toISOString()} day={day} items={items} />
              ))}
              {showNow && (
                <div
                  className="pointer-events-none absolute inset-x-0 z-20 flex items-center"
                  style={{ top: nowY }}
                  aria-hidden
                >
                  <span className="size-2 shrink-0 -translate-x-1/2 rounded-full bg-[var(--que-brand)]" />
                  <span className="h-px flex-1 bg-[var(--que-brand)]" />
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function DayColumn({ day, items }: { day: Date; items: CalendarViewItem[] }) {
  const positioned = layoutDay(items, day);
  const today = isToday(day);
  return (
    <div
      className={cn(
        "relative flex-1 border-l border-[var(--que-border)]",
        today && "bg-[var(--que-brand-subtle)]/40",
      )}
    >
      {/* 시간 격자선 */}
      {HOURS.map((hour) => (
        <div
          key={hour}
          className="absolute inset-x-0 border-t border-[var(--que-border)]/70"
          style={{ top: (hour - START_HOUR) * HOUR_HEIGHT, height: HOUR_HEIGHT }}
        />
      ))}
      {/* 이벤트 블록 */}
      {positioned.map((p) => (
        <EventBlock key={`${p.item.kind}-${p.item.id}`} pos={p} />
      ))}
    </div>
  );
}

function EventBlock({ pos }: { pos: PositionedItem }) {
  const { item } = pos;
  const swatch = eventSwatch(item);
  const range = timeRangeLabel(item.startAt, item.endAt);
  const compact = pos.height < 64;

  return (
    <EventDetailPopover item={item}>
    <div
      role="button"
      tabIndex={0}
      aria-label={`${item.title}, ${range}`}
      className="absolute overflow-hidden rounded-lg border px-2 py-1.5 text-left shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-[var(--que-brand)]"
      style={{
        top: pos.top + 1,
        height: pos.height - 2,
        left: `calc(${pos.left * 100}% + 2px)`,
        width: `calc(${pos.width * 100}% - 4px)`,
        backgroundColor: swatch.bg,
        borderColor: swatch.border,
      }}
    >
      <div className="flex items-center gap-1">
        <span
          className="truncate rounded-full bg-[var(--que-bg)]/60 px-1.5 py-px text-[10px] font-semibold tabular-nums"
          style={{ color: swatch.accent }}
        >
          {range}
        </span>
        {!item.movable && (
          <Lock className="size-3 shrink-0" style={{ color: swatch.accent }} aria-hidden />
        )}
        {item.recentlyChanged && (
          // 최근 24h 내 변경(ChangeLog 투명성) — 색 단독이 아닌 텍스트 배지.
          <span className="ml-auto shrink-0 rounded-sm bg-[var(--que-bg)]/70 px-1 py-px text-[9px] font-medium text-[var(--que-text-tertiary)]">
            수정됨
          </span>
        )}
      </div>
      <div
        className={cn(
          "mt-0.5 line-clamp-2 p-[3px] text-[12px] font-semibold leading-snug",
        )}
        style={{ color: swatch.text }}
      >
        {item.title}
      </div>
      {!compact && (
        // 팀원 이니셜 뱃지 — 블록 우하단 고정, 테두리 없음(2026-07-11 사용자 지정 — 전 화면 뱃지 border 제거).
        <span
          className="absolute right-1 bottom-1 flex size-5 items-center justify-center rounded-full text-[9px] font-semibold text-white"
          style={{ backgroundColor: item.ownerColor }}
          aria-hidden
        >
          {item.ownerName.slice(1, 3) || item.ownerName.slice(0, 2)}
        </span>
      )}
    </div>
    </EventDetailPopover>
  );
}
