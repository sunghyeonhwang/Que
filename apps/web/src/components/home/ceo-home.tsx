import type { CeoHomeData } from "@/lib/home-grade-data";
import { PerformanceHeatmap } from "@/components/performance/performance-heatmap";
import { PeriodSelect } from "@/components/performance/period-select";
import { HomeCard } from "@/components/home/home-card";
import { HomeTodoList } from "@/components/home/home-todo-list";
import { HomeSchedule } from "@/components/home/home-schedule";
import { LoadBars } from "@/components/home/load-bars";
import { ClientOverviewCard } from "@/components/home/client-overview-card";
import { TodaySummaryCard } from "@/components/home/today-summary-card";
import { KpiStrip } from "@/components/home/kpi-strip";
import { PriorityList, type PriorityRow } from "@/components/home/priority-list";
import { ProjectOverviewCard } from "@/components/home/project-overview-card";
import { WorkflowTrendCard } from "@/components/home/workflow-trend-card";
import { PendingCard } from "@/components/home/pending-card";
import { AwayChip } from "@/components/home/away-chip";

const MONTH_OPTIONS = Array.from({ length: 12 }, (_, i) => ({
  value: String(i + 1),
  label: `${i + 1}월`,
}));

/** 대표 홈 "전사 현황" — 오늘 요약 → KPI 2줄(위험/운영) → 우선 확인 → 본인 할 일·일정(+부재 칩)
 *  → 프로젝트+클라이언트별 현황 → 업무 흐름 → 전 인원 부하·히트맵 → 처리 대기(명세 §5). */
export function CeoHome({ data, month }: { data: CeoHomeData; month: number }) {
  const priorityItems: PriorityRow[] = data.teamPriority.items.map((i) => ({
    id: i.id,
    kind: i.kind,
    tone: i.tone,
    title: i.title,
    description: i.description,
    href: i.href,
  }));

  return (
    <div className="flex flex-col gap-4">
      {/* 1. 경영 AI 브리핑 */}
      <TodaySummaryCard title="경영 AI 브리핑" lines={data.todaySummary.lines} />

      {/* 2. 핵심 현황 — 위험 줄 + 운영 줄 */}
      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-2">
          <p className="text-xs font-medium text-[var(--que-text-tertiary)]">위험</p>
          <KpiStrip items={data.riskKpis} cols={6} ariaLabel="핵심 현황 — 위험" />
        </div>
        <div className="flex flex-col gap-2">
          <p className="text-xs font-medium text-[var(--que-text-tertiary)]">운영</p>
          <KpiStrip items={data.opsKpis} cols={6} ariaLabel="핵심 현황 — 운영" />
        </div>
      </div>

      {/* 3. 우선 확인 */}
      <HomeCard title="우선 확인" meta={String(data.teamPriority.count)}>
        <PriorityList
          items={priorityItems}
          total={data.teamPriority.count}
          viewAllHref="/team"
          emptyText="지금 결정·확인할 항목이 없습니다."
        />
      </HomeCard>

      {/* 4. 본인 오늘 할 일 | 일정(+부재 칩) */}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <HomeCard title="내 오늘 할 일" meta={String(data.todoCount)}>
          <HomeTodoList todos={data.todos} />
        </HomeCard>
        <HomeCard title="내 오늘 일정">
          <HomeSchedule items={data.schedule} dateLabel={data.scheduleDateLabel} />
          <AwayChip chip={data.awayChip} />
        </HomeCard>
      </div>

      {/* 5. 프로젝트 현황 | 클라이언트별 현황 */}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <HomeCard title="프로젝트 현황" meta={String(data.projectOverview.length)}>
          <ProjectOverviewCard rows={data.projectOverview} />
        </HomeCard>
        <HomeCard title="클라이언트별 현황" meta={String(data.clientOverview.length)}>
          <ClientOverviewCard rows={data.clientOverview} />
        </HomeCard>
      </div>

      {/* 6. 업무 흐름 */}
      <WorkflowTrendCard trend={data.workflowTrend} />

      {/* 7. 전 인원 부하 | 전 인원 히트맵 */}
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

      {/* 8. 처리 대기 */}
      <HomeCard title="처리 대기">
        <PendingCard pending={data.pending} />
      </HomeCard>
    </div>
  );
}
