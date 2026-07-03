"use client";

import Link from "next/link";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import type { CalendarViewDay, CalendarViewTask, ProjectCalendarView } from "@/lib/pm-data";
import { buttonVariants } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];
const MAX_PILLS = 3;

/** 뒤 2자리 알파를 붙여 옅은 틴트로. hex(#rrggbb)에 8자리 hex. */
function tint(hex: string, alpha: string): string {
  return `${hex}${alpha}`;
}

/** icon-only 링크 — aria-label + Tooltip. 터치 40px. IconButton은 button 전용이라 링크용으로 별도. */
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

/** 프로젝트 캘린더(월 그리드) 뷰 — 마감 태스크를 날짜 셀에 표시. 읽기 전용(P3). */
export function ProjectCalendarView({ data }: { data: ProjectCalendarView }) {
  return (
    <div className="-mx-4 flex min-h-0 flex-1 flex-col px-4 pt-3 md:-mx-5 md:px-5 xl:-mx-6 xl:px-6">
      <header className="flex shrink-0 items-center justify-between gap-2 pb-3">
        <h2 className="text-lg font-semibold text-[var(--que-text)]">{data.monthLabel}</h2>
        <div className="flex items-center gap-1">
          <NavIconLink href="?view=calendar" label="기본 달로">
            <CalendarDays className="size-4" aria-hidden />
          </NavIconLink>
          <NavIconLink href={`?view=calendar&month=${data.prevMonth}`} label="이전 달">
            <ChevronLeft className="size-4" aria-hidden />
          </NavIconLink>
          <NavIconLink href={`?view=calendar&month=${data.nextMonth}`} label="다음 달">
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
            <DayCell key={day.date} day={day} />
          ))}
        </div>
      </div>
    </div>
  );
}

function DayCell({ day }: { day: CalendarViewDay }) {
  const hidden = day.tasks.length - MAX_PILLS;
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
        {day.tasks.slice(0, MAX_PILLS).map((task) => (
          <TaskPill key={task.id} task={task} />
        ))}
        {hidden > 0 && (
          <span className="px-1 text-xs font-medium text-[var(--que-brand)]">+{hidden}개 작업</span>
        )}
      </div>
    </div>
  );
}

function TaskPill({ task }: { task: CalendarViewTask }) {
  return (
    <span
      className="flex items-center gap-1.5 rounded-md px-1.5 py-1 text-xs text-[var(--que-text)]"
      style={{ backgroundColor: tint(task.color, "1f") }}
      title={task.name}
    >
      <span
        className="size-1.5 shrink-0 rounded-full"
        style={{ backgroundColor: task.color }}
        aria-hidden
      />
      <span className="truncate">{task.name}</span>
    </span>
  );
}
