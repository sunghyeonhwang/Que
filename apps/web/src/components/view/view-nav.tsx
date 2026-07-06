import Link from "next/link";
import { addDays } from "date-fns";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { scale, shortWeekdayKR } from "./view-format";

// 현황판 상단 바의 순수 프리미티브 + 라벨 헬퍼(디렉티브 없음 = universal).
// SegLink/NavCircle/DateNav는 next/link Link + cn + scale만 쓰는 presentational이라
// server(view-header)·client(board-header-controls) 양쪽에서 렌더 가능하다.
// "use client"를 붙이지 말 것 — board 컨트롤이 이 프리미티브를 클라 경계 안에서 재사용한다.

// 스케줄(week) 모드의 서브 range. 날짜 열(3day) + 사람 열(1day).
export type WeekRange = "3day" | "1day";

// ---------- 공용: 세그먼트 링크 · 날짜이동 pill ----------

export function SegLink({
  href,
  active,
  children,
}: {
  href: string;
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex items-center rounded-full font-medium transition-colors",
        scale("min-h-10 px-4 text-base", "min-h-12 px-5 text-lg", "min-h-14 px-6 text-xl", "min-h-16 px-8 text-2xl"),
        active ? "bg-neutral-900 text-white" : "text-neutral-600 hover:bg-neutral-100",
      )}
    >
      {children}
    </Link>
  );
}

/** 상단 통일 날짜이동: [보고 있는 날짜 라벨] · ‹ 이전 · Today · 다음 › */
export function DateNav({
  label,
  prevHref,
  todayHref,
  nextHref,
}: {
  label: string;
  prevHref: string;
  todayHref: string;
  nextHref: string;
}) {
  return (
    <div className="flex items-center gap-2">
      <span
        className={cn(
          "mr-1 font-semibold tabular-nums text-neutral-900",
          scale("text-base", "text-lg", "text-2xl", "text-3xl"),
        )}
      >
        {label}
      </span>
      <NavCircle href={prevHref} label="이전" icon={<ChevronLeft className="size-5" />} />
      <Link
        href={todayHref}
        className={cn(
          "flex items-center rounded-full font-medium text-green-600 hover:bg-green-50",
          scale("min-h-10 px-4 text-base", "min-h-12 px-5 text-lg", "min-h-14 px-6 text-xl", "min-h-16 px-8 text-2xl"),
        )}
      >
        Today
      </Link>
      <NavCircle href={nextHref} label="다음" icon={<ChevronRight className="size-5" />} />
    </div>
  );
}

export function NavCircle({
  href,
  label,
  icon,
}: {
  href: string;
  label: string;
  icon: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      aria-label={label}
      className={cn(
        "flex items-center justify-center rounded-full border border-neutral-200 text-neutral-600 hover:bg-neutral-100",
        scale("size-11", "size-13", "size-15", "size-16"),
      )}
    >
      {icon}
    </Link>
  );
}

// ---------- 라벨 계산 ----------

export function md(d: Date): string {
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

/** "7/4 (금)" — 하루짜리 라벨(board·1day). */
export function dayLabel(d: Date): string {
  return `${md(d)} (${shortWeekdayKR(d)})`;
}

/** 3day="7/4 – 7/6", 1day="7/4 (금)". */
export function rangeLabel(anchor: Date, range: WeekRange): string {
  if (range === "1day") return dayLabel(anchor);
  const end = addDays(anchor, 2);
  return `${md(anchor)} – ${md(end)}`;
}
