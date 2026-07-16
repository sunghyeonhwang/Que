import { cookies } from "next/headers";
import { addDays, format, isSameDay, startOfMonth, startOfWeek } from "date-fns";
import { ko } from "date-fns/locale";
import { MonthView } from "@/components/schedule/month-view";
import { ScheduleHeader, type ScheduleRange } from "@/components/schedule/schedule-header";
import { WeekCalendar } from "@/components/schedule/week-calendar";
import { getClientFilter } from "@/lib/client-filter";
import { getCurrentUser } from "@/lib/current-user";
import {
  filterScheduleItems,
  getCalendarData,
  SCHEDULE_KINDS,
  type ScheduleFilters,
  type ScheduleKind,
} from "@/lib/calendar-data";
import type { Task } from "@que/core";

export const dynamic = "force-dynamic";

/** range 파라미터 화이트리스트 — 쓰레기 입력은 주간으로 폴백. */
function parseRange(value: string | undefined): ScheduleRange {
  return value === "day" || value === "3day" || value === "2week" || value === "month"
    ? value
    : "week";
}

/** priority 파라미터 화이트리스트 — 유효 우선순위만 필터로 인정, 그 외는 무시. */
function parsePriority(value: string | undefined): Task["priority"] | undefined {
  return value === "low" || value === "normal" || value === "high" ? value : undefined;
}

/** date 파라미터 화이트리스트 — YYYY-MM-DD 아니면 오늘로 폴백. */
function parseDateParam(value: string | undefined): Date {
  if (value && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const parsed = new Date(`${value}T00:00:00`);
    if (!Number.isNaN(parsed.getTime())) return parsed;
  }
  return new Date();
}

/** owner 파라미터(콤마 구분) 파싱 — 실존 사용자 id만 화이트리스트해 Set으로. 비면 전체. */
function parseOwners(value: string | undefined, validIds: Set<string>): Set<string> {
  if (!value) return new Set();
  return new Set(
    value
      .split(",")
      .map((s) => s.trim())
      .filter((id) => validIds.has(id)),
  );
}

/** hide 파라미터(콤마 구분) 파싱 — 유효 종류 4키만 화이트리스트. 비면 전부 표시. */
function parseHide(value: string | undefined): Set<ScheduleKind> {
  if (!value) return new Set();
  const valid = new Set<string>(SCHEDULE_KINDS);
  return new Set(
    value
      .split(",")
      .map((s) => s.trim())
      .filter((k): k is ScheduleKind => valid.has(k)),
  );
}

export default async function SchedulePage({
  searchParams,
}: {
  searchParams: Promise<{
    range?: string;
    date?: string;
    priority?: string;
    q?: string;
    owner?: string;
    hide?: string;
  }>;
}) {
  const params = await searchParams;
  // 마지막 뷰 기억(기획 428): range 파라미터가 없으면 쿠키에 저장된 마지막 뷰로 연다.
  // date는 기억하지 않는다 — 옛 날짜로 열려 혼란스러운 것을 피하고 항상 오늘 기준.
  const cookieStore = await cookies();
  const savedRange = cookieStore.get("que_schedule_range")?.value;
  const range = parseRange(params.range ?? savedRange);
  const anchor = parseDateParam(params.date);
  const user = await getCurrentUser();

  // 뷰별 표시 기간 계산
  const weekStart = startOfWeek(anchor, { weekStartsOn: 1 });
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  // 2주: anchor가 속한 주(월요일 시작)부터 14일 — 주간과 같은 시간축 캘린더에 열만 2배.
  const twoWeekDays = Array.from({ length: 14 }, (_, i) => addDays(weekStart, i));
  const threeDays = Array.from({ length: 3 }, (_, i) => addDays(anchor, i));
  const monthGridStart = startOfWeek(startOfMonth(anchor), { weekStartsOn: 1 });
  const monthWeeks = Array.from({ length: 6 }, (_, w) =>
    Array.from({ length: 7 }, (_, d) => addDays(monthGridStart, w * 7 + d)),
  );

  const [rangeStart, rangeEnd] =
    range === "month"
      ? [monthWeeks[0][0], monthWeeks[5][6]]
      : range === "day"
        ? [anchor, anchor]
        : range === "3day"
          ? [threeDays[0], threeDays[2]]
          : range === "2week"
            ? [twoWeekDays[0], twoWeekDays[13]]
            : [weekDays[0], weekDays[6]];

  const rangeEndOfDay = new Date(rangeEnd);
  rangeEndOfDay.setHours(23, 59, 59, 999);
  // 상단 클라이언트 스위처 필터(쿠키). 회사 공통/개인 일정은 필터하지 않는다(calendar-data 참고).
  const clientId = await getClientFilter();
  const data = await getCalendarData(user, rangeStart, rangeEndOfDay, clientId);

  // 부제 지표: anchor 날짜의 마감 작업 수 / 미팅(이벤트) 수 — 필터 전 전체 items 기준으로 센다.
  const dueTasks = data.items.filter(
    (it) => it.kind === "task" && isSameDay(new Date(it.endAt), anchor),
  ).length;
  const meetings = data.items.filter(
    (it) => it.kind === "event" && isSameDay(new Date(it.startAt), anchor),
  ).length;

  // 우선순위·키워드·담당자·종류 서버 필터(URL 파라미터). 마스킹 이후 items에 적용한다(비공개 우회 방지).
  const validUserIds = new Set(data.users.map((u) => u.id));
  const ownerIds = parseOwners(params.owner, validUserIds);
  const hide = parseHide(params.hide);
  const filters: ScheduleFilters = {
    priority: parsePriority(params.priority),
    keyword: params.q,
    ownerIds,
    hide,
  };
  const items = filterScheduleItems(data.items, filters);
  // 마일스톤은 items 밖이라 종류 토글(hide)로만 제어 — 담당자 필터·우선순위 대상 아님.
  const milestones = hide.has("milestone") ? [] : data.milestones;

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
        <ScheduleHeader
          range={range}
          anchorIso={format(anchor, "yyyy-MM-dd")}
          currentUserId={user.id}
          members={data.users.map((u) => ({
            id: u.id,
            name: u.name,
            avatarColor: u.avatarColor,
          }))}
          projects={data.projects.map((p) => ({ id: p.id, name: p.name }))}
        />
      </header>

      {range === "month" ? (
        <MonthView weeks={monthWeeks} anchor={anchor} items={items} milestones={milestones} />
      ) : range === "day" ? (
        <WeekCalendar days={[anchor]} items={items} milestones={milestones} />
      ) : range === "3day" ? (
        <WeekCalendar days={threeDays} items={items} milestones={milestones} />
      ) : range === "2week" ? (
        <WeekCalendar days={twoWeekDays} items={items} milestones={milestones} />
      ) : (
        <WeekCalendar days={weekDays} items={items} milestones={milestones} />
      )}
    </div>
  );
}
