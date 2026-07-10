import Link from "next/link";
import { Maximize2 } from "lucide-react";
import type { StaffHomeData } from "@/lib/home-grade-data";
import { HomeCard } from "@/components/home/home-card";
import { HomeTodoList } from "@/components/home/home-todo-list";
import { HomeSchedule } from "@/components/home/home-schedule";
import { TodaySummaryCard } from "@/components/home/today-summary-card";
import { KpiStrip } from "@/components/home/kpi-strip";
import { CheckInCard } from "@/components/home/checkin-card";
import { PriorityList, type PriorityRow } from "@/components/home/priority-list";
import { AwayChip } from "@/components/home/away-chip";

/** 사원 홈 "내 하루" — 오늘 요약 → KPI 4 → 작업 상태 확인 → 우선 확인 → 오늘 할 일·일정(+부재 칩).
 *  팀 지표·타인 데이터·업무 흐름은 없다(명세 §3). */
export function StaffHome({ data }: { data: StaffHomeData }) {
  // 우선 확인 = 벨과 같은 viewer-scoped 신호에서 체크인만 제외(체크인은 별도 '작업 상태 확인' 카드).
  // alerts는 all:true 전체분 — 벨 캡(8)·읽음순 정렬에 종속되지 않고, 여기서 5건으로 자른다(명세 §3).
  const filtered = data.alerts.items.filter((i) => i.kind !== "checkin");
  const priorityItems: PriorityRow[] = filtered.slice(0, 5).map((i) => ({
    id: i.id,
    kind: i.kind,
    tone: i.tone,
    title: i.title,
    description: i.description,
    href: i.href,
  }));
  const priorityTotal = filtered.length;

  return (
    <div className="flex flex-col gap-4">
      {/* 1. 오늘 요약 */}
      <TodaySummaryCard title="오늘 요약" lines={data.todaySummary.lines} />

      {/* 2. 핵심 현황(KPI 4) */}
      <KpiStrip items={data.homeKpis} cols={4} />

      {/* 3. 작업 상태 확인(응답 대기 있을 때만) */}
      {data.checkIns.length > 0 && <CheckInCard items={data.checkIns} />}

      {/* 4. 우선 확인 */}
      <HomeCard title="우선 확인" meta={String(priorityTotal)}>
        <PriorityList
          items={priorityItems.slice(0, 5)}
          total={priorityTotal}
          viewAllHref="/notifications"
          emptyText="지금 확인할 요청이 없습니다."
        />
      </HomeCard>

      {/* 5. 오늘 할 일 | 오늘 일정(+부재 칩) */}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-5">
        <HomeCard title="오늘 할 일" meta={String(data.todoCount)} className="xl:col-span-2">
          <HomeTodoList todos={data.todos} />
        </HomeCard>
        <HomeCard
          title="오늘 일정"
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
          <AwayChip chip={data.awayChip} />
        </HomeCard>
      </div>
    </div>
  );
}
