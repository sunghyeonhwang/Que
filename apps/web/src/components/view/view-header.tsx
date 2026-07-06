import Link from "next/link";
import { addDays, format, parseISO } from "date-fns";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { ViewClock } from "./view-clock";
import { HideCompletedToggle } from "./hide-completed-toggle";
import {
  formatKoreanDate,
  formatKoreanWeekday,
  scale,
  shortWeekdayKR,
} from "./view-format";

// 현황판 상단 바(모든 뷰 공통).
// 좌: 오늘 날짜 · 요일 · 라이브 시계 · 기온(벽시계용 '오늘' 실시간).
// 우: 뷰 스위처 + 완료 숨김(보드) + "지금 보고 있는 날짜" 라벨 + 날짜이동(‹ 이전 · Today · 다음 ›).
//     날짜이동은 board·스케줄 모두 이 상단 헤더에 통일 배치한다(하단 WeekNav 제거).
//
// 급소(item 1): 보고 있는 날짜 라벨을 상단에 노출한다.
//   기존엔 좌측이 항상 '오늘'만 보여줘, board에서 이전/다음을 눌러 date 쿼리가 바뀌어도
//   화면상 날짜 피드백이 없어 "이동이 안 된다"고 오인됐다(링크·파라미터 자체는 정상).
//   이동 폭: board=±1일, 3day=±3, 1day=±1. 전부 상대 쿼리 Link(proxy pathname 보존).

// 스케줄(week) 모드의 서브 range. 날짜 열(3day) + 사람 열(1day).
type WeekRange = "3day" | "1day";
type BoardMode = "all" | "paged";

interface ViewHeaderProps {
  mode: "board" | "week";
  now: Date;
  temperature?: number;
  todayISO: string;
  /** 보드 모드: 현재 보고 있는 기준일. */
  boardDate?: Date;
  hideCompleted?: boolean;
  /** 보드 모드: 전체(8명)/2명 페이지 토글 상태. */
  boardMode?: BoardMode;
  /** 주간 모드: 현재 범위(3day=날짜 열, 1day=사람 열). */
  weekRange?: WeekRange;
  /** 주간 모드: prev/next/today·범위 라벨 계산의 기준 앵커일 ISO. */
  weekAnchorISO?: string;
}

export function ViewHeader({
  mode,
  now,
  temperature,
  todayISO,
  boardDate,
  hideCompleted = false,
  boardMode = "all",
  weekRange,
  weekAnchorISO,
}: ViewHeaderProps) {
  return (
    <header
      className={cn(
        // 좁은 폭(예: 768)에서 컨트롤이 잘리지 않게 wrap. view는 가로 디스플레이 전용이라 보조용.
        "flex shrink-0 flex-wrap items-center justify-between gap-x-6 gap-y-3 border-b border-neutral-200",
        scale("px-8", "px-12", "px-16", "px-24"),
        scale("py-5", "py-6", "py-8", "py-10"),
      )}
    >
      <div
        className={cn(
          "flex items-center gap-3 font-medium text-neutral-800",
          scale("text-xl", "text-2xl", "text-3xl", "text-4xl"),
        )}
      >
        <span>{formatKoreanDate(now)}</span>
        <Dot />
        <span>{formatKoreanWeekday(now)}</span>
        <Dot />
        <ViewClock />
        {temperature !== undefined ? (
          <>
            <Dot />
            <span className="font-semibold">{Math.round(temperature)}°</span>
          </>
        ) : null}
      </div>

      {mode === "board" && boardDate ? (
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
          <BoardModeToggle
            mode={boardMode}
            boardISO={format(boardDate, "yyyy-MM-dd")}
            hideCompleted={hideCompleted}
          />
          <HideCompletedToggle />
          <DateNav
            label={dayLabel(boardDate)}
            prevHref={boardHref(format(addDays(boardDate, -1), "yyyy-MM-dd"), boardMode, hideCompleted)}
            todayHref={boardHref(todayISO, boardMode, hideCompleted)}
            nextHref={boardHref(format(addDays(boardDate, 1), "yyyy-MM-dd"), boardMode, hideCompleted)}
          />
        </div>
      ) : null}

      {mode === "week" && weekRange && weekAnchorISO ? (
        <WeekModeControls
          range={weekRange}
          anchorISO={weekAnchorISO}
          todayISO={todayISO}
        />
      ) : null}
    </header>
  );
}

// ---------- 보드 모드: [전체][2명] 토글 + 날짜이동 ----------

/** 보드 상대 쿼리 링크. bmode·hc를 항상 보존한다(벽 디스플레이 새로고침 유지). */
function boardHref(dateISO: string, mode: BoardMode, hideCompleted: boolean): string {
  const hc = hideCompleted ? "&hc=1" : "";
  return `?view=board&date=${dateISO}&bmode=${mode}${hc}`;
}

function BoardModeToggle({
  mode,
  boardISO,
  hideCompleted,
}: {
  mode: BoardMode;
  boardISO: string;
  hideCompleted: boolean;
}) {
  return (
    <div className="flex items-center gap-1 rounded-full border border-neutral-200 p-1">
      <SegLink href={boardHref(boardISO, "all", hideCompleted)} active={mode === "all"}>
        전체
      </SegLink>
      <SegLink href={boardHref(boardISO, "paged", hideCompleted)} active={mode === "paged"}>
        2명
      </SegLink>
    </div>
  );
}

// ---------- 주간 모드: [1Day][3day] 토글 + 날짜이동 ----------

function WeekModeControls({
  range,
  anchorISO,
  todayISO,
}: {
  range: WeekRange;
  anchorISO: string;
  todayISO: string;
}) {
  // 범위 전환은 앵커일을 유지한다(1day↔3day 왕복 시 보던 날짜 보존).
  const step = range === "3day" ? 3 : 1;
  const anchor = parseISO(anchorISO);
  const prevISO = format(addDays(anchor, -step), "yyyy-MM-dd");
  const nextISO = format(addDays(anchor, step), "yyyy-MM-dd");

  return (
    <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
      <div className="flex items-center gap-1 rounded-full border border-neutral-200 p-1">
        <SegLink href={`?view=week&range=1day&date=${anchorISO}`} active={range === "1day"}>
          1Day
        </SegLink>
        <SegLink href={`?view=week&range=3day&date=${anchorISO}`} active={range === "3day"}>
          3day
        </SegLink>
      </div>
      <DateNav
        label={rangeLabel(anchor, range)}
        prevHref={`?view=week&range=${range}&date=${prevISO}`}
        todayHref={`?view=week&range=${range}&date=${todayISO}`}
        nextHref={`?view=week&range=${range}&date=${nextISO}`}
      />
    </div>
  );
}

// ---------- 공용: 세그먼트 링크 · 날짜이동 pill ----------

function SegLink({
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
function DateNav({
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

function NavCircle({
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

function Dot() {
  return <span className="text-neutral-300">·</span>;
}

// ---------- 라벨 계산 ----------

function md(d: Date): string {
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

/** "7/4 (금)" — 하루짜리 라벨(board·1day). */
function dayLabel(d: Date): string {
  return `${md(d)} (${shortWeekdayKR(d)})`;
}

/** 3day="7/4 – 7/6", 1day="7/4 (금)". */
function rangeLabel(anchor: Date, range: WeekRange): string {
  if (range === "1day") return dayLabel(anchor);
  const end = addDays(anchor, 2);
  return `${md(anchor)} – ${md(end)}`;
}
