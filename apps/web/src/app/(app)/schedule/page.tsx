import { addDays, format, isSameDay, startOfMonth, startOfWeek } from "date-fns";
import { ko } from "date-fns/locale";
import { MonthView } from "@/components/schedule/month-view";
import { ScheduleHeader, type ScheduleRange } from "@/components/schedule/schedule-header";
import { WeekCalendar } from "@/components/schedule/week-calendar";
import { getCurrentUser } from "@/lib/current-user";
import { getCalendarData } from "@/lib/calendar-data";

export const dynamic = "force-dynamic";

/** range 파라미터 화이트리스트 — 쓰레기 입력은 주간으로 폴백. */
function parseRange(value: string | undefined): ScheduleRange {
  return value === "day" || value === "month" ? value : "week";
}

/** date 파라미터 화이트리스트 — YYYY-MM-DD 아니면 오늘로 폴백. */
function parseDateParam(value: string | undefined): Date {
  if (value && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const parsed = new Date(`${value}T00:00:00`);
    if (!Number.isNaN(parsed.getTime())) return parsed;
  }
  return new Date();
}

export default async function SchedulePage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string; date?: string }>;
}) {
  const params = await searchParams;
  const range = parseRange(params.range);
  const anchor = parseDateParam(params.date);
  const user = await getCurrentUser();

  // 뷰별 표시 기간 계산
  const weekStart = startOfWeek(anchor, { weekStartsOn: 1 });
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const monthGridStart = startOfWeek(startOfMonth(anchor), { weekStartsOn: 1 });
  const monthWeeks = Array.from({ length: 6 }, (_, w) =>
    Array.from({ length: 7 }, (_, d) => addDays(monthGridStart, w * 7 + d)),
  );

  const [rangeStart, rangeEnd] =
    range === "month"
      ? [monthWeeks[0][0], monthWeeks[5][6]]
      : range === "day"
        ? [anchor, anchor]
        : [weekDays[0], weekDays[6]];

  const rangeEndOfDay = new Date(rangeEnd);
  rangeEndOfDay.setHours(23, 59, 59, 999);
  const data = await getCalendarData(user, rangeStart, rangeEndOfDay);

  // 부제 지표: anchor 날짜의 마감 작업 수 / 미팅(이벤트) 수를 데이터로 계산.
  const dueTasks = data.items.filter(
    (it) => it.kind === "task" && isSameDay(new Date(it.endAt), anchor),
  ).length;
  const meetings = data.items.filter(
    (it) => it.kind === "event" && isSameDay(new Date(it.startAt), anchor),
  ).length;

  return (
    <div>
      <header className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-[var(--que-text)]">
            {format(anchor, "yyyy년 M월 d일", { locale: ko })}
          </h1>
          <p className="mt-1 text-sm text-[var(--que-text-secondary)]">
            집중하세요! 마감 작업 {dueTasks}개와 미팅 {meetings}개가 남아 있습니다.
          </p>
        </div>
        <ScheduleHeader range={range} />
      </header>

      {range === "month" ? (
        <MonthView weeks={monthWeeks} anchor={anchor} items={data.items} />
      ) : range === "day" ? (
        <WeekCalendar days={[anchor]} items={data.items} />
      ) : (
        <WeekCalendar days={weekDays} items={data.items} />
      )}
    </div>
  );
}
