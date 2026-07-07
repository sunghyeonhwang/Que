import type { ReactNode } from "react";
import {
  CircleCheckBig,
  ClipboardList,
  LoaderCircle,
  TriangleAlert,
  type LucideIcon,
} from "lucide-react";
import { gradeForUser } from "@que/core";
import { getCurrentUser } from "@/lib/current-user";
import { getClientFilter, getClientFilterName } from "@/lib/client-filter";
import { getPerformanceData, type PerfKpi } from "@/lib/performance-data";
import { ClientFilterBadge } from "@/components/app/client-filter-badge";
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
const WEEK_OPTIONS = [
  { value: "4", label: "4주" },
  { value: "8", label: "8주" },
  { value: "12", label: "12주" },
  { value: "26", label: "26주" },
];
const OT_ALLOWED = new Set([4, 8, 12, 26]);

/** 1~12 정수만 통과, 아니면 현재월 폴백 */
function parseMonth(raw: string | string[] | undefined, fallback: number): number {
  const v = Array.isArray(raw) ? raw[0] : raw;
  const n = Number(v);
  return Number.isInteger(n) && n >= 1 && n <= 12 ? n : fallback;
}

export default async function PerformancePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await getCurrentUser();
  const now = new Date();
  const currentMonth = now.getMonth() + 1;
  const sp = await searchParams;

  const hm = parseMonth(sp.hm, currentMonth);
  const cm = parseMonth(sp.cm, currentMonth);
  const lm = parseMonth(sp.lm, currentMonth);
  const otRaw = Number(Array.isArray(sp.ot) ? sp.ot[0] : sp.ot);
  const ot = OT_ALLOWED.has(otRaw) ? otRaw : 8;

  const [clientId, clientName] = await Promise.all([
    getClientFilter(),
    getClientFilterName(),
  ]);

  // 사람-위젯(히트맵 rows·부하표) 스코프와 사원 KPI 스코프는 세션 사용자 grade에서만 유도한다.
  // viewer를 넘기면 데이터 계층이 viewer.id로 스코프를 재유도한다 — URL 파라미터로 넓힐 수 없다.
  const data = await getPerformanceData(now, { hm, cm, ot, lm, clientId, viewer: user });

  // 부하 순위표는 대표(ceo) 전용이다(RPT-1, 2026-07-07 UX 감사 — 관리자 레벨 줄세우기 노출 제거).
  // 관리자/사원은 표 대신 본인 월간 요약만 본다. 데이터 계층도 비대표에게는 lowPerformers를 본인
  // 1행으로만 계산한다(순위 데이터가 아예 안 내려감). 관리자의 부하 히트맵·KPI는 재배분용으로 유지.
  const isCeo = gradeForUser(user) === "ceo";
  const selfRow = data.lowPerformers[0];

  return (
    <div className="flex flex-col gap-4">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-[var(--que-text)]">성과</h1>
          <p className="mt-1 text-sm text-[var(--que-text-secondary)]">
            팀 작업 진척·병목·부하 분포를 한눈에. 개인 평가가 아니라 업무 배분과 병목 조정용입니다.
          </p>
        </div>
        <ClientFilterBadge clientName={clientName} />
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
              param="cm"
              ariaLabel="작업 완료율 기준 월 선택"
              options={MONTH_OPTIONS}
              value={String(cm)}
            />
          }
        >
          <CompletionBarChart data={data.completionByMonth} />
        </SectionCard>

        <SectionCard
          title="기한 초과 추이"
          action={
            <PeriodSelect
              param="ot"
              ariaLabel="기한 초과 추이 기간 선택"
              options={WEEK_OPTIONS}
              value={String(ot)}
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
              param="hm"
              ariaLabel="히트맵 기준 월 선택"
              options={MONTH_OPTIONS}
              value={String(hm)}
            />
          }
        >
          <PerformanceHeatmap data={data.heatmap} />
        </SectionCard>

        <SectionCard title="작업 성과" meta={data.rangeLabel}>
          <PerformanceLineChart data={data.performanceTrend} />
        </SectionCard>
      </div>

      {/* 4행: (대표) 팀 부하 순위표 · (관리자/사원) 내 월간 요약 | 프로젝트 진행률 */}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        {!isCeo ? (
          <SectionCard
            title="내 월간 요약"
            action={
              <PeriodSelect
                param="lm"
                ariaLabel="내 월간 요약 기준 월 선택"
                options={MONTH_OPTIONS}
                value={String(lm)}
              />
            }
          >
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-lg border border-[var(--que-border)] p-4">
                <p className="text-3xl font-semibold tabular-nums text-[var(--que-success)]">
                  {selfRow?.completed ?? 0}
                </p>
                <p className="mt-1 text-sm text-[var(--que-text-secondary)]">이번 달 완료</p>
              </div>
              <div className="rounded-lg border border-[var(--que-border)] p-4">
                <p
                  className={
                    "text-3xl font-semibold tabular-nums " +
                    ((selfRow?.overdue ?? 0) > 0
                      ? "text-[var(--que-error)]"
                      : "text-[var(--que-text-tertiary)]")
                  }
                >
                  {selfRow?.overdue ?? 0}
                </p>
                <p className="mt-1 text-sm text-[var(--que-text-secondary)]">기한 초과</p>
              </div>
            </div>
          </SectionCard>
        ) : (
          <SectionCard
            title="팀 부하 현황"
            action={
              <PeriodSelect
                param="lm"
                ariaLabel="팀 부하 현황 기준 월 선택"
                options={MONTH_OPTIONS}
                value={String(lm)}
              />
            }
          >
            <LowPerformersTable rows={data.lowPerformers} />
          </SectionCard>
        )}

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
    <section className="flex flex-col gap-3 rounded-xl border border-[var(--que-border)] bg-[var(--que-bg)] p-4">
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
