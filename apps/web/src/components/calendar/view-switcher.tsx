"use client";

import { useEffect } from "react";
import Link from "next/link";
import { addDays, addMonths, format } from "date-fns";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

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

function href(view: CalendarView, range: CalendarRange, date: Date): string {
  return `/calendar?view=${view}&range=${range}&date=${format(date, "yyyy-MM-dd")}`;
}

/** 뷰/기간 스위처 + 날짜 이동. 마지막 사용 뷰는 쿠키로 기억한다. */
export function ViewSwitcher({
  view,
  range,
  anchor,
}: {
  view: CalendarView;
  range: CalendarRange;
  anchor: Date;
}) {
  useEffect(() => {
    document.cookie = `que-calendar-view=${view}; path=/; max-age=${60 * 60 * 24 * 365}`;
  }, [view]);

  const shift = (direction: 1 | -1): Date => {
    if (view === "timeline") return addDays(anchor, 14 * direction);
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
            href={href(v.key, range, anchor)}
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
              href={href(view, r.key, anchor)}
              aria-current={range === r.key ? "page" : undefined}
              className={linkClass(range === r.key)}
            >
              {r.label}
            </Link>
          ))}
        </nav>
      )}

      <div className="ml-auto flex items-center gap-1">
        <Link
          href={href(view, range, shift(-1))}
          aria-label="이전 기간"
          className={cn(buttonVariants({ variant: "outline", size: "icon" }), "size-10")}
        >
          <ChevronLeft className="size-4" aria-hidden />
        </Link>
        <Link
          href={href(view, range, new Date())}
          className={cn(buttonVariants({ variant: "outline" }), "h-10")}
        >
          오늘
        </Link>
        <Link
          href={href(view, range, shift(1))}
          aria-label="다음 기간"
          className={cn(buttonVariants({ variant: "outline", size: "icon" }), "size-10")}
        >
          <ChevronRight className="size-4" aria-hidden />
        </Link>
      </div>
    </div>
  );
}
