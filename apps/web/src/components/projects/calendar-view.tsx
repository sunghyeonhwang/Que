"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { AlertTriangle, CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import type { CalendarCard, CalendarDay, ProjectCalendar } from "@/lib/projects-data";
import { STATUS_TONE, TONE_STYLE } from "@/lib/pm-columns";
import { buttonVariants } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];
const MAX_PILLS = 3;

/** icon-only 링크 — aria-label + Tooltip. 터치 40px. */
function NavIconLink({
  href,
  label,
  children,
}: {
  href: string;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Link
            href={href}
            scroll={false}
            aria-label={label}
            className={cn(
              buttonVariants({ variant: "outline" }),
              "size-10 rounded-lg text-[var(--que-text-secondary)]",
            )}
          />
        }
      >
        {children}
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}

/** 프로젝트 캘린더(월 그리드) 뷰 — 마감(endAt) 태스크를 날짜 셀에 표시. pill 클릭 → 상세 드로어. */
export function ProjectCalendarView({
  data,
  taskHref,
}: {
  data: ProjectCalendar;
  taskHref: (taskId: string) => string;
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // 현재 파라미터(project 등)를 보존하며 month만 바꾼 링크.
  const monthHref = (month: string | null) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("view", "calendar");
    if (month) params.set("month", month);
    else params.delete("month");
    params.delete("task");
    return `${pathname}?${params.toString()}`;
  };

  return (
    <div className="-mx-4 flex min-h-0 flex-1 flex-col px-4 pt-3 md:-mx-5 md:px-5 xl:-mx-6 xl:px-6">
      <header className="flex shrink-0 items-center justify-between gap-2 pb-3">
        <h2 className="text-lg font-semibold text-[var(--que-text)]">{data.monthLabel}</h2>
        <div className="flex items-center gap-1">
          <NavIconLink href={monthHref(null)} label="기본 달로">
            <CalendarDays className="size-4" aria-hidden />
          </NavIconLink>
          <NavIconLink href={monthHref(data.prevMonth)} label="이전 달">
            <ChevronLeft className="size-4" aria-hidden />
          </NavIconLink>
          <NavIconLink href={monthHref(data.nextMonth)} label="다음 달">
            <ChevronRight className="size-4" aria-hidden />
          </NavIconLink>
        </div>
      </header>

      <div className="min-h-0 flex-1 overflow-auto rounded-xl border border-[var(--que-border)]">
        <div
          role="grid"
          aria-label={`${data.monthLabel} 프로젝트 캘린더`}
          className="grid min-w-[720px] grid-cols-7"
        >
          {WEEKDAYS.map((label) => (
            <div
              key={label}
              role="columnheader"
              className="sticky top-0 z-10 border-b border-[var(--que-border)] bg-[var(--que-bg-muted)] px-2 py-2.5 text-center text-sm font-medium text-[var(--que-text-secondary)]"
            >
              {label}
            </div>
          ))}
          {data.days.map((day) => (
            <DayCell key={day.date} day={day} taskHref={taskHref} />
          ))}
        </div>
      </div>
    </div>
  );
}

function DayCell({
  day,
  taskHref,
}: {
  day: CalendarDay;
  taskHref: (taskId: string) => string;
}) {
  const hidden = day.cards.length - MAX_PILLS;
  return (
    <div
      role="gridcell"
      aria-label={day.date}
      className={cn(
        "flex min-h-[132px] flex-col gap-1.5 border-b border-l border-[var(--que-border)] px-2 py-2 [&:nth-child(7n+1)]:border-l-0",
        !day.inMonth && "bg-[var(--que-bg-muted)]/40",
      )}
    >
      <div className="flex h-6 items-center px-0.5">
        {day.isToday ? (
          <span className="flex size-6 items-center justify-center rounded-full bg-[var(--que-text)] text-xs font-semibold tabular-nums text-white">
            {day.day}
          </span>
        ) : (
          <span
            className={cn(
              "text-xs font-medium tabular-nums",
              day.inMonth ? "text-[var(--que-text-secondary)]" : "text-[var(--que-text-tertiary)]",
            )}
          >
            {day.day}
          </span>
        )}
      </div>

      <div className="flex flex-col gap-1">
        {day.cards.slice(0, MAX_PILLS).map((card) => (
          <TaskPill key={card.taskId} card={card} href={taskHref(card.taskId)} />
        ))}
        {hidden > 0 && (
          <span className="px-1 text-xs font-medium text-[var(--que-brand)]">+{hidden}개 작업</span>
        )}
      </div>
    </div>
  );
}

function TaskPill({ card, href }: { card: CalendarCard; href: string }) {
  const tone = TONE_STYLE[STATUS_TONE[card.status]];
  return (
    <Link
      href={href}
      scroll={false}
      aria-label={`${card.title} 상세 열기${card.isOverdue ? " (기한 초과)" : ""}`}
      className={cn(
        "flex items-center gap-1.5 rounded-md px-1.5 py-1 text-xs text-[var(--que-text)] focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[var(--que-brand)]",
        card.isOverdue && "ring-1 ring-[var(--que-error)] ring-inset",
      )}
      style={{ backgroundColor: tone.tint }}
      title={card.isOverdue ? `${card.title} (기한 초과)` : card.title}
    >
      {card.isOverdue ? (
        <AlertTriangle className="size-3 shrink-0 text-[var(--que-error)]" aria-hidden />
      ) : (
        <span
          className="size-1.5 shrink-0 rounded-full"
          style={{ backgroundColor: tone.dot }}
          aria-hidden
        />
      )}
      <span className="truncate">{card.title}</span>
    </Link>
  );
}
