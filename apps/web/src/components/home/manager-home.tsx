import type { ManagerHomeData } from "@/lib/home-grade-data";
import { HomeCard } from "@/components/home/home-card";
import { HomeTodoList } from "@/components/home/home-todo-list";
import { HomeSchedule } from "@/components/home/home-schedule";
import { LoadBars } from "@/components/home/load-bars";
import { TodaySummaryCard } from "@/components/home/today-summary-card";
import { KpiStrip } from "@/components/home/kpi-strip";
import { PriorityList, type PriorityRow } from "@/components/home/priority-list";
import { ProjectOverviewCard } from "@/components/home/project-overview-card";
import { WorkflowTrendCard } from "@/components/home/workflow-trend-card";
import { PendingCard } from "@/components/home/pending-card";
import { AwayChip } from "@/components/home/away-chip";

/** 관리자 홈 "팀 운영" — 오늘 요약 → KPI 6 → 우선 확인 → 본인 할 일·일정(+부재 칩)
 *  → 프로젝트 현황 → 업무 흐름 → 업무 부하 → 처리 대기(명세 §4). */
export function ManagerHome({ data }: { data: ManagerHomeData }) {
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

      {/* 7. 업무 부하 — 배분 조정용(대표 제외) */}
      <HomeCard title="업무 부하 — 업무 배분 조정용">
        <LoadBars rows={data.loadByMember} />
      </HomeCard>

      {/* 8. 처리 대기 */}
      <HomeCard title="처리 대기">
        <PendingCard pending={data.pending} />
      </HomeCard>
    </div>
  );
}
