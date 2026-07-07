import {
  CircleCheckBig,
  ClipboardList,
  LoaderCircle,
  Maximize2,
  TriangleAlert,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import type { StaffHomeData } from "@/lib/home-grade-data";
import type { PerfKpi } from "@/lib/performance-data";
import { KpiCard } from "@/components/performance/kpi-card";
import { PerformanceHeatmap } from "@/components/performance/performance-heatmap";
import { PerformanceLineChart } from "@/components/performance/performance-line-chart";
import { PeriodSelect } from "@/components/performance/period-select";
import { HomeCard } from "@/components/home/home-card";
import { HomeTodoList } from "@/components/home/home-todo-list";
import { HomeSchedule } from "@/components/home/home-schedule";
import { RequestInbox } from "@/components/home/request-inbox";

const KPI_ICONS: Record<PerfKpi["key"], LucideIcon> = {
  total: ClipboardList,
  in_progress: LoaderCircle,
  completed: CircleCheckBig,
  overdue: TriangleAlert,
};

const MONTH_OPTIONS = Array.from({ length: 12 }, (_, i) => ({
  value: String(i + 1),
  label: `${i + 1}월`,
}));

/** 사원 홈 "내 하루" — 내 KPI → 오늘 할 일·개인 일정 → 내게 온 요청 → 내 기여·성과. */
export function StaffHome({ data, month }: { data: StaffHomeData; month: number }) {
  const contribution = data.contributionHeatmap.rows.reduce(
    (sum, row) => sum + row.cells.reduce((a, c) => a + c.taskCount, 0),
    0,
  );

  return (
    <div className="flex flex-col gap-4">
      {/* 내 KPI 4 */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {data.kpis.map((kpi) => (
          <KpiCard key={kpi.key} kpi={kpi} icon={KPI_ICONS[kpi.key]} />
        ))}
      </div>

      {/* 오늘 할 일 | 개인 일정 */}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-5">
        <HomeCard title="오늘 할 일" meta={String(data.todoCount)} className="xl:col-span-2">
          <HomeTodoList todos={data.todos} />
        </HomeCard>
        <HomeCard
          title="개인 일정"
          className="xl:col-span-3"
          action={
            <Link
              href="/schedule"
              aria-label="일정 전체 보기"
              className="flex size-10 items-center justify-center rounded-lg text-[var(--que-text-tertiary)] hover:bg-[var(--que-bg-muted)] hover:text-[var(--que-text)]"
            >
              <Maximize2 className="size-4" aria-hidden />
            </Link>
          }
        >
          <HomeSchedule items={data.schedule} dateLabel={data.scheduleDateLabel} />
        </HomeCard>
      </div>

      {/* 내게 온 요청 */}
      <HomeCard title="내게 온 요청" meta={String(data.alerts.count)}>
        <RequestInbox alerts={data.alerts} noteSummary={data.noteSummary} />
      </HomeCard>

      {/* 내 기여 히트맵 | 내 작업 성과 */}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <HomeCard
          title="내 기여 히트맵"
          action={
            <PeriodSelect
              param="hm"
              ariaLabel="히트맵 기준 월 선택"
              options={MONTH_OPTIONS}
              value={String(month)}
            />
          }
        >
          <div className="flex flex-col gap-3">
            <PerformanceHeatmap data={data.contributionHeatmap} />
            <p className="text-center text-sm text-[var(--que-text-secondary)]">
              {month}월에 <span className="font-semibold tabular-nums">{contribution}</span>개 기여
            </p>
          </div>
        </HomeCard>
        <HomeCard title="내 작업 성과" meta={data.rangeLabel}>
          <PerformanceLineChart data={data.performanceTrend} />
        </HomeCard>
      </div>
    </div>
  );
}
