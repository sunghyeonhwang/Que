"use client";

import { useEffect } from "react";
import Link from "next/link";
import { addDays, addMonths, format } from "date-fns";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { TimelineOrientation, TimelineRange } from "./timeline-shared";

export type CalendarView = "basic" | "members" | "timeline";
export type CalendarRange = "day" | "week" | "month";

const VIEWS: { key: CalendarView; label: string }[] = [
  { key: "basic", label: "기본형" },
  { key: "members", label: "전체 멤버" },
  { key: "timeline", label: "타임라인" },
];

const RANGES: { key: CalendarRange; label: string }[] = [
  { key: "day", label: "일간" },
  { key: "week", label: "주간" },
  { key: "month", label: "월간" },
];

const TIMELINE_RANGES: { key: TimelineRange; label: string }[] = [
  { key: "hourly", label: "시간별" },
  { key: "week", label: "1주간" },
  { key: "biweek", label: "2주간" },
];

const ORIENTS: { key: TimelineOrientation; label: string }[] = [
  { key: "h", label: "가로" },
  { key: "v", label: "세로" },
];

interface HrefState {
  range: CalendarRange;
  timelineRange: TimelineRange;
  orient: TimelineOrientation;
  date: Date;
}

/** view에 맞는 range 파라미터를 고르고, 타임라인일 때만 orient를 붙인다. */
function href(view: CalendarView, s: HrefState): string {
  const params = new URLSearchParams();
  params.set("view", view);
  if (view === "timeline") {
    params.set("range", s.timelineRange);
    params.set("orient", s.orient);
  } else {
    params.set("range", s.range);
  }
  params.set("date", format(s.date, "yyyy-MM-dd"));
  return `/calendar?${params.toString()}`;
}

/** 뷰/기간/방향 스위처 + 날짜 이동. 마지막 사용 뷰는 쿠키로 기억한다. */
export function ViewSwitcher({
  view,
  range,
  timelineRange,
  orient,
  anchor,
}: {
  view: CalendarView;
  range: CalendarRange;
  timelineRange: TimelineRange;
  orient: TimelineOrientation;
  anchor: Date;
}) {
  useEffect(() => {
    document.cookie = `que-calendar-view=${view}; path=/; max-age=${60 * 60 * 24 * 365}`;
  }, [view]);

  const state: HrefState = { range, timelineRange, orient, date: anchor };

  const shift = (direction: 1 | -1): Date => {
    if (view === "timeline") {
      if (timelineRange === "hourly") return addDays(anchor, direction);
      if (timelineRange === "week") return addDays(anchor, 7 * direction);
      return addDays(anchor, 14 * direction);
    }
    if (view === "members") return addDays(anchor, 7 * direction);
    if (range === "day") return addDays(anchor, direction);
    if (range === "month") return addMonths(anchor, direction);
    return addDays(anchor, 7 * direction);
  };

  const linkClass = (active: boolean) =>
    cn(
      "flex h-10 items-center rounded-md px-3 text-sm font-medium transition-colors",
      active ? "bg-primary text-primary-foreground" : "hover:bg-accent",
    );

  return (
    <div className="mb-4 flex flex-wrap items-center gap-2">
      <nav aria-label="캘린더 뷰 전환" className="flex rounded-lg border p-0.5">
        {VIEWS.map((v) => (
          <Link
            key={v.key}
            href={href(v.key, state)}
            aria-current={view === v.key ? "page" : undefined}
            className={linkClass(view === v.key)}
          >
            {v.label}
          </Link>
        ))}
      </nav>

      {view === "basic" && (
        <nav aria-label="기간 전환" className="flex rounded-lg border p-0.5">
          {RANGES.map((r) => (
            <Link
              key={r.key}
              href={href(view, { ...state, range: r.key })}
              aria-current={range === r.key ? "page" : undefined}
              className={linkClass(range === r.key)}
            >
              {r.label}
            </Link>
          ))}
        </nav>
      )}

      {view === "timeline" && (
        <>
          <nav aria-label="타임라인 범위 전환" className="flex rounded-lg border p-0.5">
            {TIMELINE_RANGES.map((r) => (
              <Link
                key={r.key}
                href={href(view, { ...state, timelineRange: r.key })}
                aria-current={timelineRange === r.key ? "page" : undefined}
                className={linkClass(timelineRange === r.key)}
              >
                {r.label}
              </Link>
            ))}
          </nav>
          <nav aria-label="타임라인 방향 전환" className="flex rounded-lg border p-0.5">
            {ORIENTS.map((o) => (
              <Link
                key={o.key}
                href={href(view, { ...state, orient: o.key })}
                aria-current={orient === o.key ? "page" : undefined}
                className={linkClass(orient === o.key)}
              >
                {o.label}
              </Link>
            ))}
          </nav>
        </>
      )}

      <div className="ml-auto flex items-center gap-1">
        <Link
          href={href(view, { ...state, date: shift(-1) })}
          aria-label="이전 기간"
          className={cn(buttonVariants({ variant: "outline", size: "icon" }), "size-10")}
        >
          <ChevronLeft className="size-4" aria-hidden />
        </Link>
        <Link
          href={href(view, { ...state, date: new Date() })}
          className={cn(buttonVariants({ variant: "outline" }), "h-10")}
        >
          오늘
        </Link>
        <Link
          href={href(view, { ...state, date: shift(1) })}
          aria-label="다음 기간"
          className={cn(buttonVariants({ variant: "outline", size: "icon" }), "size-10")}
        >
          <ChevronRight className="size-4" aria-hidden />
        </Link>
      </div>
    </div>
  );
}
