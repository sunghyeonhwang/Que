import Link from "next/link";
import { addDays, format, parseISO } from "date-fns";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type {
  ViewScheduleRange,
  ViewWeek,
  ViewWeekDay,
  ViewWeekItem,
  ViewWeekMemberSummary,
} from "@/lib/view-data";
import {
  avatarInitials,
  formatTimeRange,
  minutesOfDayKST,
  withAlpha,
} from "./view-format";
import { NowLine } from "./now-line";

// 주간 스케줄. 상단 멤버 완료 요약행 + 월~금(또는 3day) 캘린더(시간 그리드) + 하단 범위 이동.
// 조회 전용. 이벤트 카드는 시작~종료 시각으로 배치되며 클릭 불가.

const GRID_START_MIN = 10 * 60; // 10:00
const GRID_END_MIN = 19 * 60; // 19:00
const GRID_SPAN = GRID_END_MIN - GRID_START_MIN;
const AXIS_HOURS = [10, 12, 14, 16, 18] as const;

export function WeekGrid({ week }: { week: ViewWeek }) {
  // prev/next 이동 폭: week=7일, 3day=3일. 기준 앵커는 week.weekStartISO.
  const step = week.range === "3day" ? 3 : 7;
  const anchor = parseISO(week.weekStartISO);
  const prevDate = format(addDays(anchor, -step), "yyyy-MM-dd");
  const nextDate = format(addDays(anchor, step), "yyyy-MM-dd");

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <MemberSummaryRow members={week.memberSummary} />
      <WeekCalendar days={week.days} />
      <WeekNav prevDate={prevDate} nextDate={nextDate} range={week.range} />
    </div>
  );
}

// ---------- 멤버 완료 요약행 ----------

function MemberSummaryRow({ members }: { members: ViewWeekMemberSummary[] }) {
  return (
    <div
      className="grid shrink-0 gap-3 px-8 pb-4 pt-5"
      style={{ gridTemplateColumns: `repeat(${members.length}, minmax(0, 1fr))` }}
    >
      {members.map((m) => {
        const pct = m.totalCount > 0 ? (m.doneCount / m.totalCount) * 100 : 0;
        return (
          <div
            key={m.user.id}
            className="rounded-xl border border-neutral-200 px-3.5 py-3"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="min-w-0 truncate text-base font-bold text-neutral-900">
                {m.user.name}
              </span>
              <span
                className="size-2.5 shrink-0 rounded-full"
                style={{ backgroundColor: m.user.avatarColor }}
              />
            </div>
            <p className="mt-1 text-sm text-neutral-500 tabular-nums">
              {m.doneCount}/{m.totalCount} Completed
            </p>
            <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-neutral-200">
              <div
                className="h-full rounded-full"
                style={{ width: `${pct}%`, backgroundColor: m.user.avatarColor }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ---------- 주간 캘린더 ----------

function WeekCalendar({ days }: { days: ViewWeekDay[] }) {
  const template = `64px repeat(${days.length}, minmax(0, 1fr))`;

  return (
    <div className="flex min-h-0 flex-1 flex-col px-8">
      {/* 요일 헤더 + 클라이언트 라벨 바 */}
      <div className="grid shrink-0 gap-3" style={{ gridTemplateColumns: template }}>
        <div />
        {days.map((day) => (
          <div key={day.dateISO} className="min-w-0">
            <p className="text-center text-lg font-bold text-neutral-900">
              {day.weekdayLabel}요일 {day.dayNum}
            </p>
            <div className="mt-1.5 truncate rounded-md bg-green-50 px-2 py-1 text-center text-xs font-medium text-green-700">
              {day.clientLabels.length > 0 ? day.clientLabels.join(" · ") : " "}
            </div>
          </div>
        ))}
      </div>

      {/* 시간 그리드 본문 */}
      <div
        className="relative grid min-h-0 flex-1 gap-3 overflow-auto pb-4 pt-2"
        style={{ gridTemplateColumns: template }}
      >
        <TimeAxis />
        {days.map((day) => (
          <DayColumn key={day.dateISO} day={day} />
        ))}
        <NowLine startMin={GRID_START_MIN} endMin={GRID_END_MIN} />
      </div>
    </div>
  );
}

function TimeAxis() {
  return (
    <div className="relative min-h-[420px]">
      {AXIS_HOURS.map((h) => {
        const topPct = ((h * 60 - GRID_START_MIN) / GRID_SPAN) * 100;
        const hour12 = h % 12 === 0 ? 12 : h % 12;
        const label = h < 12 ? `${hour12} AM` : `${hour12} PM`;
        return (
          <span
            key={h}
            className="absolute right-2 text-xs text-neutral-400"
            style={{ top: `${topPct}%`, transform: "translateY(-50%)" }}
          >
            {label}
          </span>
        );
      })}
    </div>
  );
}

function DayColumn({ day }: { day: ViewWeekDay }) {
  return (
    <div className="relative min-h-[420px] min-w-0 rounded-xl border border-neutral-200 bg-neutral-50/60">
      {/* 시간 구분선 */}
      {AXIS_HOURS.map((h) => {
        const topPct = ((h * 60 - GRID_START_MIN) / GRID_SPAN) * 100;
        return (
          <div
            key={h}
            className="pointer-events-none absolute inset-x-0 border-t border-neutral-200/70"
            style={{ top: `${topPct}%` }}
          />
        );
      })}
      {day.items.map((item) => (
        <EventCard key={item.id} item={item} />
      ))}
    </div>
  );
}

function EventCard({ item }: { item: ViewWeekItem }) {
  const startMin = clamp(minutesOfDayKST(item.startAt), GRID_START_MIN, GRID_END_MIN);
  const rawEnd = minutesOfDayKST(item.endAt);
  const endMin = clamp(rawEnd > startMin ? rawEnd : startMin + 30, GRID_START_MIN, GRID_END_MIN);

  const topPct = ((startMin - GRID_START_MIN) / GRID_SPAN) * 100;
  const heightPct = ((endMin - startMin) / GRID_SPAN) * 100;

  return (
    <div
      className="absolute inset-x-1.5 flex flex-col overflow-hidden rounded-lg p-2"
      style={{
        top: `${topPct}%`,
        height: `${heightPct}%`,
        minHeight: 52,
        backgroundColor: withAlpha(item.ownerColor, "1f"),
      }}
    >
      <p
        className="truncate text-sm font-bold"
        style={{ color: item.ownerColor }}
      >
        {item.title}
      </p>
      <p className="truncate text-xs text-neutral-500">
        {formatTimeRange(item.startAt, item.endAt)}
      </p>
      <span
        className="absolute bottom-1.5 right-1.5 flex size-6 items-center justify-center rounded-full text-[10px] font-semibold text-white"
        style={{ backgroundColor: item.ownerColor }}
        title={item.ownerName}
      >
        {avatarInitials(item.ownerName)}
      </span>
    </div>
  );
}

// ---------- 범위 이동 ----------

function WeekNav({
  prevDate,
  nextDate,
  range,
}: {
  prevDate: string;
  nextDate: string;
  range: ViewScheduleRange;
}) {
  const label = range === "3day" ? "3일" : "주";
  return (
    <>
      <div className="flex shrink-0 items-center justify-center gap-3 py-3">
        <Link
          href={`?view=week&range=${range}&date=${prevDate}`}
          aria-label={`이전 ${label}`}
          className="flex size-11 items-center justify-center rounded-full bg-neutral-900 text-white hover:bg-neutral-700"
        >
          <ChevronLeft className="size-5" />
        </Link>
        <Link
          href={`?view=week&range=${range}&date=${nextDate}`}
          aria-label={`다음 ${label}`}
          className="flex size-11 items-center justify-center rounded-full bg-neutral-900 text-white hover:bg-neutral-700"
        >
          <ChevronRight className="size-5" />
        </Link>
      </div>
      <div className="h-10 shrink-0 bg-neutral-900" />
    </>
  );
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.min(Math.max(v, lo), hi);
}
