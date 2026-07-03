import Link from "next/link";
import {
  CircleCheckBig,
  ClipboardList,
  LoaderCircle,
  Maximize2,
  Plus,
  TriangleAlert,
  type LucideIcon,
} from "lucide-react";
import { getCurrentUser } from "@/lib/current-user";
import { getPerformanceData, type PerfKpi } from "@/lib/performance-data";
import { getHomeData } from "@/lib/home-data";
import { KpiCard } from "@/components/performance/kpi-card";
import { PerformanceHeatmap } from "@/components/performance/performance-heatmap";
import { PerformanceLineChart } from "@/components/performance/performance-line-chart";
import { PeriodSelect } from "@/components/performance/period-select";
import { MemberAvatars } from "@/components/projects/member-avatars";
import { HomeCard } from "@/components/home/home-card";
import { HomeTodoList } from "@/components/home/home-todo-list";
import { HomeSchedule } from "@/components/home/home-schedule";
import { TaskDistributionChart } from "@/components/home/task-distribution-chart";

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

/** 1~12 정수만 통과, 아니면 현재월 폴백 */
function parseMonth(raw: string | string[] | undefined, fallback: number): number {
  const v = Array.isArray(raw) ? raw[0] : raw;
  const n = Number(v);
  return Number.isInteger(n) && n >= 1 && n <= 12 ? n : fallback;
}

// 홈(개인 대시보드) — 재설계. KPI·히트맵·작업성과는 성과(/heatmap) 컴포넌트를 재사용,
// 오늘 할 일·개인 일정·작업 분포는 홈 전용 조회(getHomeData)로 조합한다.
export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await getCurrentUser();
  const now = new Date();
  const sp = await searchParams;

  const hm = parseMonth(sp.hm, now.getMonth() + 1);
  const dpRaw = Array.isArray(sp.dp) ? sp.dp[0] : sp.dp;
  const dp = dpRaw === "month" ? "month" : "week";

  const [perf, home] = await Promise.all([
    getPerformanceData(now, { hm }),
    getHomeData(user, now, { dp }),
  ]);

  const selectedMonth = String(hm);
  const contribution = perf.heatmap.rows.reduce(
    (sum, row) => sum + row.cells.reduce((a, c) => a + c.taskCount, 0),
    0,
  );

  return (
    <div className="flex flex-col gap-4">
      {/* 헤더 */}
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-[var(--que-text)]">
            어서오세요, {home.givenName}님!
          </h1>
          <p className="mt-1 text-sm text-[var(--que-text-secondary)]">
            여기서 프로젝트와 작업을 관리하세요.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <MemberAvatars members={home.headerMembers} overflow={home.memberOverflow} size={32} />
          <Link
            href="/today"
            className="inline-flex h-11 min-h-11 items-center gap-1.5 rounded-lg bg-[var(--que-brand)] px-4 text-sm font-medium text-white transition-colors hover:bg-[var(--que-brand-hover)] focus-visible:ring-3 focus-visible:ring-[var(--que-brand)]/40 focus-visible:outline-none"
          >
            <Plus className="size-4" aria-hidden />
            작업 추가
          </Link>
        </div>
      </header>

      {/* 1행: KPI 4(2×2) | 히트맵 */}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {perf.kpis.map((kpi) => (
            <KpiCard key={kpi.key} kpi={kpi} icon={KPI_ICONS[kpi.key]} />
          ))}
        </div>
        <HomeCard
          title="히트맵"
          action={
            <PeriodSelect
              param="hm"
              ariaLabel="히트맵 기준 월 선택"
              options={MONTH_OPTIONS}
              value={selectedMonth}
            />
          }
        >
          <div className="flex flex-col gap-3">
            <PerformanceHeatmap data={perf.heatmap} />
            <p className="text-center text-sm text-[var(--que-text-secondary)]">
              {selectedMonth}월에 <span className="font-semibold tabular-nums">{contribution}</span>개 기여
            </p>
          </div>
        </HomeCard>
      </div>

      {/* 2행: 작업 성과(라인) | 오늘 할 일 */}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-5">
        <HomeCard title="작업 성과" meta={perf.rangeLabel} className="xl:col-span-3">
          <PerformanceLineChart data={perf.performanceTrend} />
        </HomeCard>
        <HomeCard title="오늘 할 일" meta={String(home.todoCount)} className="xl:col-span-2">
          <HomeTodoList todos={home.todos} />
        </HomeCard>
      </div>

      {/* 3행: 개인 일정 | 작업 분포 */}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-5">
        <HomeCard
          title="개인 일정"
          className="xl:col-span-3"
          action={
            <Link
              href="/schedule"
              aria-label="일정 전체 보기"
              className="flex size-9 items-center justify-center rounded-lg text-[var(--que-text-tertiary)] hover:bg-[var(--que-bg-muted)] hover:text-[var(--que-text)]"
            >
              <Maximize2 className="size-4" aria-hidden />
            </Link>
          }
        >
          <HomeSchedule items={home.schedule} dateLabel={home.scheduleDateLabel} />
        </HomeCard>
        <HomeCard
          title="작업 분포"
          className="xl:col-span-2"
          action={
            <PeriodSelect
              param="dp"
              ariaLabel="작업 분포 기간 선택"
              options={[
                { value: "week", label: "주간 보기" },
                { value: "month", label: "월간 보기" },
              ]}
              value={dp}
            />
          }
        >
          <TaskDistributionChart data={home.distribution} />
        </HomeCard>
      </div>
    </div>
  );
}
