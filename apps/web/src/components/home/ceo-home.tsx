import Link from "next/link";
import {
  CircleCheckBig,
  ClipboardList,
  LoaderCircle,
  TriangleAlert,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import type { CeoHomeData } from "@/lib/home-grade-data";
import type { PerfKpi } from "@/lib/performance-data";
import { KpiCard } from "@/components/performance/kpi-card";
import { CompletionBarChart } from "@/components/performance/completion-bar-chart";
import { PerformanceHeatmap } from "@/components/performance/performance-heatmap";
import { ProjectProgressList } from "@/components/performance/project-progress-list";
import { PeriodSelect } from "@/components/performance/period-select";
import { HomeCard } from "@/components/home/home-card";
import { HomeTodoList } from "@/components/home/home-todo-list";
import { HomeSchedule } from "@/components/home/home-schedule";
import { LoadBars } from "@/components/home/load-bars";
import { RequestInbox } from "@/components/home/request-inbox";
import { BlockerList } from "@/components/home/blocker-list";
import { ClientOverviewCard } from "@/components/home/client-overview-card";
import { RiskMilestonesCard } from "@/components/home/risk-milestones-card";

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

/** 대표 홈 "전사 조망" — 전사 KPI·완료 추이 → 진행률·위험 마일스톤 → 막힘 → 클라이언트별 → 부하·히트맵 → 본인. */
export function CeoHome({ data, month }: { data: CeoHomeData; month: number }) {
  return (
    <div className="flex flex-col gap-4">
      {/* 전사 KPI 4 */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {data.kpis.map((kpi) => (
          <KpiCard key={kpi.key} kpi={kpi} icon={KPI_ICONS[kpi.key]} />
        ))}
      </div>

      {/* 완료 추이 | 프로젝트 진행률 */}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <HomeCard title="완료 추이" meta={data.rangeLabel}>
          <CompletionBarChart data={data.completionByMonth} />
        </HomeCard>
        <HomeCard
          title="프로젝트 진행률"
          action={
            <span className="text-sm font-medium text-[var(--que-brand)]">
              {data.overallProgress}% 완료
            </span>
          }
        >
          <ProjectProgressList overall={data.overallProgress} projects={data.projects} />
        </HomeCard>
      </div>

      {/* 위험 마일스톤 | 현재 막힘 */}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <HomeCard title="위험 마일스톤" meta={String(data.riskMilestones.length)}>
          <RiskMilestonesCard rows={data.riskMilestones} />
        </HomeCard>
        <HomeCard title="현재 막힘" meta={String(data.currentBlockers.length)}>
          <BlockerList blockers={data.currentBlockers} />
        </HomeCard>
      </div>

      {/* 클라이언트별 현황 */}
      <HomeCard title="클라이언트별 현황" meta={String(data.clientOverview.length)}>
        <ClientOverviewCard rows={data.clientOverview} />
      </HomeCard>

      {/* 전 인원 부하 | 전 인원 히트맵 */}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <HomeCard title="전 인원 부하 — 배분 조정용">
          <LoadBars rows={data.loadByMember} />
        </HomeCard>
        <HomeCard
          title="전 인원 히트맵"
          action={
            <PeriodSelect
              param="hm"
              ariaLabel="히트맵 기준 월 선택"
              options={MONTH_OPTIONS}
              value={String(month)}
            />
          }
        >
          <PerformanceHeatmap data={data.heatmap} />
        </HomeCard>
      </div>

      {/* 결제 요약 */}
      <Link
        href="/payments"
        className="flex min-h-16 items-center gap-3 rounded-xl border border-[var(--que-border)] bg-[var(--que-bg)] p-4 transition-colors hover:bg-[var(--que-bg-muted)]"
      >
        <span
          className={
            "flex size-10 shrink-0 items-center justify-center rounded-lg border " +
            (data.overduePayments > 0
              ? "border-[var(--que-error)] bg-[var(--que-error-bg)] text-[var(--que-error)]"
              : "border-[var(--que-warning)] bg-[var(--que-warning-bg)] text-[var(--que-warning)]")
          }
        >
          <Wallet className="size-5" aria-hidden />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm text-[var(--que-text-secondary)]">결제 대기</span>
          <span className="block text-lg font-semibold tabular-nums text-[var(--que-text)]">
            {data.pendingPayments}건
          </span>
        </span>
        {data.overduePayments > 0 && (
          <span className="text-xs font-medium text-[var(--que-error)]">
            마감 초과 {data.overduePayments}
          </span>
        )}
      </Link>

      {/* 내게 온 요청 (본인 신호 — 전사 조망 아래, 본인 것은 하단에) */}
      <HomeCard title="내게 온 요청" meta={String(data.alerts.count)}>
        <RequestInbox alerts={data.alerts} noteSummary={data.noteSummary} />
      </HomeCard>

      {/* 본인 오늘 할 일 | 개인 일정 (축소) */}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <HomeCard title="내 오늘 할 일" meta={String(data.todoCount)}>
          <HomeTodoList todos={data.todos} />
        </HomeCard>
        <HomeCard title="내 개인 일정">
          <HomeSchedule items={data.schedule} dateLabel={data.scheduleDateLabel} />
        </HomeCard>
      </div>
    </div>
  );
}
