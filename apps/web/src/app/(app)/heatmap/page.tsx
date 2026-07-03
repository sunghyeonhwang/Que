import type { ReactNode } from "react";
import {
  CircleCheckBig,
  ClipboardList,
  LoaderCircle,
  TriangleAlert,
  type LucideIcon,
} from "lucide-react";
import { getCurrentUser } from "@/lib/current-user";
import { getPerformanceData, type PerfKpi } from "@/lib/performance-data";
import { CompletionBarChart } from "@/components/performance/completion-bar-chart";
import { OverdueAreaChart } from "@/components/performance/overdue-area-chart";
import { PerformanceLineChart } from "@/components/performance/performance-line-chart";
import { PerformanceHeatmap } from "@/components/performance/performance-heatmap";
import { KpiCard } from "@/components/performance/kpi-card";
import { PeriodSelect } from "@/components/performance/period-select";
import { LowPerformersTable } from "@/components/performance/low-performers-table";
import { ProjectProgressList } from "@/components/performance/project-progress-list";

export const dynamic = "force-dynamic";

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
const RANGE_OPTIONS = [
  { value: "7d", label: "최근 7일" },
  { value: "4w", label: "4주 보기" },
  { value: "3m", label: "3개월" },
  { value: "6m", label: "6개월" },
];

export default async function PerformancePage() {
  await getCurrentUser();
  const data = await getPerformanceData();

  return (
    <div className="flex flex-col gap-4">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight text-[var(--que-text)]">성과</h1>
        <p className="mt-1 text-sm text-[var(--que-text-secondary)]">
          팀 작업 진척·병목·부하 분포를 한눈에. 개인 평가가 아니라 업무 배분과 병목 조정용입니다.
        </p>
      </header>

      {/* KPI 4 */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {data.kpis.map((kpi) => (
          <KpiCard key={kpi.key} kpi={kpi} icon={KPI_ICONS[kpi.key]} />
        ))}
      </div>

      {/* 2행: 완료율(막대) | 기한 초과 추이(영역) */}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <SectionCard
          title="작업 완료율"
          meta={data.rangeLabel}
          action={
            <PeriodSelect
              ariaLabel="작업 완료율 기준 월 선택"
              options={MONTH_OPTIONS}
              defaultValue="7"
            />
          }
        >
          <CompletionBarChart data={data.completionByMonth} />
        </SectionCard>

        <SectionCard
          title="기한 초과 추이"
          action={
            <PeriodSelect
              ariaLabel="기한 초과 추이 기간 선택"
              options={RANGE_OPTIONS}
              defaultValue="4w"
            />
          }
        >
          <OverdueAreaChart data={data.overdueTrend} />
        </SectionCard>
      </div>

      {/* 3행: 히트맵 | 작업 성과(라인) */}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <SectionCard
          title="히트맵"
          action={
            <PeriodSelect
              ariaLabel="히트맵 기준 월 선택"
              options={MONTH_OPTIONS}
              defaultValue="7"
            />
          }
        >
          <PerformanceHeatmap data={data.heatmap} />
        </SectionCard>

        <SectionCard title="작업 성과" meta={data.rangeLabel}>
          <PerformanceLineChart data={data.performanceTrend} />
        </SectionCard>
      </div>

      {/* 4행: 저성과 팀 표 | 프로젝트 진행률 */}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <SectionCard
          title="팀 부하 현황"
          action={
            <PeriodSelect
              ariaLabel="팀 부하 현황 기준 월 선택"
              options={MONTH_OPTIONS}
              defaultValue="7"
            />
          }
        >
          <LowPerformersTable rows={data.lowPerformers} />
        </SectionCard>

        <SectionCard
          title="프로젝트 진행률"
          action={
            <span className="text-sm font-medium text-[var(--que-brand)]">{data.overallProgress}% 완료</span>
          }
        >
          <ProjectProgressList overall={data.overallProgress} projects={data.projects} />
        </SectionCard>
      </div>
    </div>
  );
}

function SectionCard({
  title,
  meta,
  action,
  children,
}: {
  title: string;
  meta?: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="flex flex-col gap-3 rounded-xl border border-[var(--que-border)] bg-white p-4">
      <header className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-baseline gap-2">
          <h2 className="text-base font-semibold text-[var(--que-text)]">{title}</h2>
          {meta && <span className="text-xs text-[var(--que-text-tertiary)]">{meta}</span>}
        </div>
        {action}
      </header>
      {children}
    </section>
  );
}
