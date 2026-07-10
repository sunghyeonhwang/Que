import type { ManagerHomeData } from "@/lib/home-grade-data";
import { PerformanceHeatmap } from "@/components/performance/performance-heatmap";
import { PeriodSelect } from "@/components/performance/period-select";
import { HomeCard } from "@/components/home/home-card";
import { HomeTodoList } from "@/components/home/home-todo-list";
import { HomeSchedule } from "@/components/home/home-schedule";
import { WorkloadTable } from "@/components/app/workload-table";
import { TodaySummaryCard } from "@/components/home/today-summary-card";
import { KpiStrip } from "@/components/home/kpi-strip";
import { CheckInCard } from "@/components/home/checkin-card";
import { PriorityList, type PriorityRow } from "@/components/home/priority-list";
import { ProjectOverviewCard } from "@/components/home/project-overview-card";
import { WorkflowTrendCard } from "@/components/home/workflow-trend-card";
import { PendingCard } from "@/components/home/pending-card";
import { AwayChip } from "@/components/home/away-chip";

const MONTH_OPTIONS = Array.from({ length: 12 }, (_, i) => ({
  value: String(i + 1),
  label: `${i + 1}월`,
}));

/** 관리자 홈 "팀 운영" — 오늘 요약 → KPI 6 → 우선 확인 → 본인 할 일·일정(+부재 칩)
 *  → 프로젝트 현황 → 업무 흐름 → 업무 부하 | 날짜별 집중도 → 처리 대기(명세 §4·§A~C). */
export function ManagerHome({ data, month }: { data: ManagerHomeData; month: number }) {
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
      {/* 1. 팀관리 AI 브리핑 */}
      <TodaySummaryCard title="팀관리 AI 브리핑" lines={data.todaySummary.lines} />

      {/* 2. 핵심 현황(KPI 6) */}
      <KpiStrip items={data.homeKpis} cols={6} />

      {/* 2-2. 작업 상태 확인(본인 응답 대기 있을 때만) */}
      {data.checkIns.length > 0 && <CheckInCard items={data.checkIns} />}

      {/* 3. 우선 확인 */}
      <HomeCard title="우선 확인" meta={String(data.teamPriority.count)}>
        <PriorityList
          items={priorityItems}
          total={data.teamPriority.count}
          viewAllHref="/team"
          emptyText="오늘 조정할 병목·충돌이 없습니다."
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

      {/* 5. 프로젝트 현황 */}
      <HomeCard title="프로젝트 현황" meta={String(data.projectOverview.length)}>
        <ProjectOverviewCard rows={data.projectOverview} />
      </HomeCard>

      {/* 6. 업무 흐름 */}
      <WorkflowTrendCard trend={data.workflowTrend} />

      {/* 7. 업무 부하(대표 제외) | 날짜별 업무 집중도 — 태블릿에선 1열 적층 */}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <WorkloadTable load={data.load} scopeLabel="업무 부하" />
        <HomeCard
          title={`날짜별 업무 집중도 - ${month}월`}
          action={
            <PeriodSelect
              param="hm"
              ariaLabel="집중도 기준 월 선택"
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
