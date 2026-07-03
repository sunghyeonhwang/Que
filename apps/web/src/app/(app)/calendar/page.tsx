import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { addDays, format, startOfMonth, startOfWeek } from "date-fns";
import { ko } from "date-fns/locale";
import { PageHeader } from "@/components/app/page-header";
import { MembersGrid } from "@/components/calendar/members-grid";
import { MonthGrid } from "@/components/calendar/month-grid";
import { TimelineGrid } from "@/components/calendar/timeline-grid";
import {
  ViewSwitcher,
  type CalendarRange,
  type CalendarView,
} from "@/components/calendar/view-switcher";
import {
  buildHourUnits,
  type TimelineMode,
  type TimelineOrientation,
  type TimelineRange,
} from "@/components/calendar/timeline-shared";
import { WeekGrid } from "@/components/calendar/week-grid";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getCurrentUser } from "@/lib/current-user";
import { getCalendarData, getRecentChangeLogs } from "@/lib/calendar-data";

export const dynamic = "force-dynamic";

const VIEW_COOKIE = "que-calendar-view";

function parseView(value: string | undefined): CalendarView | null {
  return value === "basic" || value === "members" || value === "timeline" ? value : null;
}

function parseRange(value: string | undefined): CalendarRange {
  return value === "day" || value === "month" ? value : "week";
}

/** 타임라인 전용 범위 — 기본형의 range(day/week/month)와 파싱을 분리한다. 기본값 biweek(=현재 14일). */
function parseTimelineRange(value: string | undefined): TimelineRange {
  return value === "hourly" || value === "week" ? value : "biweek";
}

/** 타임라인 방향 — 화이트리스트, 기본값 h(=현재 가로). */
function parseOrient(value: string | undefined): TimelineOrientation {
  return value === "v" ? "v" : "h";
}

/** date 파라미터도 view/range와 동일하게 화이트리스트 — 쓰레기 입력은 오늘로 폴백 */
function parseDateParam(value: string | undefined): Date {
  if (value && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const parsed = new Date(`${value}T00:00:00`);
    if (!Number.isNaN(parsed.getTime())) return parsed;
  }
  return new Date();
}

export default async function CalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string; range?: string; date?: string; orient?: string }>;
}) {
  const params = await searchParams;
  const view = parseView(params.view);

  // 뷰 파라미터가 없으면 마지막 사용 뷰로 리다이렉트 (URL에 항상 뷰가 반영되게)
  if (!view) {
    const store = await cookies();
    const saved = parseView(store.get(VIEW_COOKIE)?.value) ?? "basic";
    redirect(`/calendar?view=${saved}`);
  }

  const isTimeline = view === "timeline";
  const range = parseRange(params.range);
  // 타임라인이 아니면 타임라인 파라미터는 기본값으로 둔다(타임라인으로 전환 시 2주간·가로로 진입).
  const timelineRange = isTimeline ? parseTimelineRange(params.range) : "biweek";
  const orient = isTimeline ? parseOrient(params.orient) : "h";
  const anchor = parseDateParam(params.date);
  const user = await getCurrentUser();

  // 뷰별 표시 기간 계산
  const weekStart = startOfWeek(anchor, { weekStartsOn: 1 });
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const monthGridStart = startOfWeek(startOfMonth(anchor), { weekStartsOn: 1 });
  const monthWeeks = Array.from({ length: 6 }, (_, w) =>
    Array.from({ length: 7 }, (_, d) => addDays(monthGridStart, w * 7 + d)),
  );

  // 타임라인 축 계산: hourly=anchor 하루의 시간칸, week=anchor부터 7일, biweek=anchor-2…+11(14일).
  const timelineMode: TimelineMode = timelineRange === "hourly" ? "hour" : "day";
  const timelineUnits =
    timelineRange === "hourly"
      ? buildHourUnits(anchor)
      : timelineRange === "week"
        ? Array.from({ length: 7 }, (_, i) => addDays(anchor, i))
        : Array.from({ length: 14 }, (_, i) => addDays(anchor, i - 2));

  const [rangeStart, rangeEnd] =
    view === "timeline"
      ? [timelineUnits[0], timelineUnits[timelineUnits.length - 1]]
      : view === "basic" && range === "month"
        ? [monthWeeks[0][0], monthWeeks[5][6]]
        : view === "basic" && range === "day"
          ? [anchor, anchor]
          : [weekDays[0], weekDays[6]];

  const rangeEndOfDay = new Date(rangeEnd);
  rangeEndOfDay.setHours(23, 59, 59, 999);
  const data = await getCalendarData(user, rangeStart, rangeEndOfDay);
  const logs = await getRecentChangeLogs();

  return (
    <div>
      <PageHeader
        title="캘린더"
        subtitle={`회사 일정, 작업, 마일스톤을 한 시간축에서 · ${format(anchor, "yyyy년 M월", { locale: ko })}`}
      />

      <ViewSwitcher
        view={view}
        range={range}
        timelineRange={timelineRange}
        orient={orient}
        anchor={anchor}
      />

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,20rem)]">
        <div className="min-w-0">
          {view === "basic" && range === "month" && (
            <MonthGrid weeks={monthWeeks} anchor={anchor} data={data} />
          )}
          {view === "basic" && range === "day" && <WeekGrid days={[anchor]} data={data} />}
          {view === "basic" && range === "week" && <WeekGrid days={weekDays} data={data} />}
          {view === "members" && <MembersGrid days={weekDays} data={data} />}
          {view === "timeline" && (
            <TimelineGrid
              units={timelineUnits}
              data={data}
              mode={timelineMode}
              orientation={orient}
            />
          )}
          <p className="mt-2 text-xs text-muted-foreground">
            Que 작업과 마일스톤은 드래그로 이동할 수 있습니다. 회사 일정과 자리비움은 읽기
            전용입니다. 터치 환경에서는 오늘 화면의 작업 상세에서 날짜를 변경할 수 있습니다.
          </p>
        </div>

        <Card className="h-fit">
          <CardHeader>
            <CardTitle className="text-base">최근 변경 내역</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {logs.length === 0 && (
              <p className="text-sm text-muted-foreground">변경 내역이 없습니다.</p>
            )}
            {logs.map((log) => (
              <div key={log.id} className="text-sm">
                <p className="font-medium">{log.text}</p>
                <p className="text-xs text-muted-foreground">
                  {log.actorName} · {format(new Date(log.createdAt), "M/d HH:mm")}
                </p>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
