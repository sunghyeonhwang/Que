import Link from "next/link";
import { addDays, format } from "date-fns";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { ViewClock } from "./view-clock";
import { HideCompletedToggle } from "./hide-completed-toggle";
import { formatKoreanDate, formatKoreanWeekday } from "./view-format";

// 현황판 상단 바.
// 좌: 오늘 날짜 · 요일 · 라이브 시계 · 기온.  (표시 날짜는 벽시계용 '오늘' 실시간 기준)
// 우: 보드 모드에서만 '완료 숨김' 토글 + 날짜 이동 pill(‹ / Today / ›). 주간 이동은 하단(week-grid).

interface ViewHeaderProps {
  mode: "board" | "week";
  now: Date;
  temperature?: number;
  /** 보드 모드에서 현재 보고 있는 기준일(날짜 이동 링크 계산용). */
  boardDate?: Date;
  todayISO: string;
  hideCompleted?: boolean;
}

export function ViewHeader({
  mode,
  now,
  temperature,
  boardDate,
  todayISO,
  hideCompleted = false,
}: ViewHeaderProps) {
  return (
    <header className="flex shrink-0 items-center justify-between gap-6 border-b border-neutral-200 px-8 py-5">
      <div className="flex items-center gap-3 text-xl font-medium text-neutral-800">
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
        <div className="flex items-center gap-6">
          <HideCompletedToggle active={hideCompleted} />
          <DateNav boardDate={boardDate} todayISO={todayISO} hideCompleted={hideCompleted} />
        </div>
      ) : null}
    </header>
  );
}

function Dot() {
  return <span className="text-neutral-300">·</span>;
}

/** 보드 날짜 이동. 상대 쿼리(?...)로 이동해 뷰 호스트 pathname을 보존한다. */
function DateNav({
  boardDate,
  todayISO,
  hideCompleted,
}: {
  boardDate: Date;
  todayISO: string;
  hideCompleted: boolean;
}) {
  const hc = hideCompleted ? "&hc=1" : "";
  const prevISO = format(addDays(boardDate, -1), "yyyy-MM-dd");
  const nextISO = format(addDays(boardDate, 1), "yyyy-MM-dd");

  return (
    <div className="flex items-center gap-2">
      <NavCircle
        href={`?view=board&date=${prevISO}${hc}`}
        label="이전 날짜"
        icon={<ChevronLeft className="size-5" />}
      />
      <Link
        href={`?view=board&date=${todayISO}${hc}`}
        className="flex min-h-10 items-center rounded-full px-4 text-base font-medium text-green-600 hover:bg-green-50"
      >
        Today
      </Link>
      <NavCircle
        href={`?view=board&date=${nextISO}${hc}`}
        label="다음 날짜"
        icon={<ChevronRight className="size-5" />}
      />
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
      className="flex size-10 items-center justify-center rounded-full border border-neutral-200 text-neutral-500 hover:bg-neutral-100"
    >
      {icon}
    </Link>
  );
}
