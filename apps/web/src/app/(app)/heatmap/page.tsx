import type { ReactNode } from "react";
import Link from "next/link";
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
import { getOkrData, currentMonthKey, currentPeriodKey } from "@/lib/okr-data";
import { ClientFilterBadge } from "@/components/app/client-filter-badge";
import { CompletionBarChart } from "@/components/performance/completion-bar-chart";
import { OverdueAreaChart } from "@/components/performance/overdue-area-chart";
import { PerformanceLineChart } from "@/components/performance/performance-line-chart";
import { PerformanceHeatmap } from "@/components/performance/performance-heatmap";
import { KpiCard } from "@/components/performance/kpi-card";
import { PeriodSelect } from "@/components/performance/period-select";
import { LinkTabs } from "@/components/app/link-tabs";
import { WorkloadTable } from "@/components/app/workload-table";
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

  // 내 성과 | 팀 성과 탭 — 관리자·대표(비-사원)만 노출한다. 사원은 어차피 본인 스코프라 탭이 무의미.
  // scope=me면 대표·관리자도 본인 스코프로 좁혀 '내 성과'를 본다(데이터 계층 forceSelf). 기본 team.
  const viewerGrade = gradeForUser(user);
  const canScopeTeam = viewerGrade !== "staff" || user.role === "admin";
  const scope: "me" | "team" = sp.scope === "me" ? "me" : "team";

  // 사람-위젯(히트맵 rows·부하표) 스코프와 사원 KPI 스코프는 세션 사용자 grade에서만 유도한다.
  // viewer를 넘기면 데이터 계층이 viewer.id로 스코프를 재유도한다 — URL 파라미터로 넓힐 수 없다.
  // scope는 좁히기 전용(me) — 사원이 ?scope=team을 넣어도 grade 재유도로 본인만 산출된다.
  const data = await getPerformanceData(now, {
    hm,
    cm,
    ot,
    lm,
    clientId,
    viewer: user,
    scope,
  });

  // 부하 순위표는 대표(ceo) 전용이다(RPT-1, 2026-07-07 UX 감사 — 관리자 레벨 줄세우기 노출 제거).
  // '내 성과'(scope=me)면 대표여도 표 대신 본인 월간 요약을 본다. 관리자/사원도 본인 요약.
  const isCeo = viewerGrade === "ceo";
  const showTeamLoadTable = isCeo && scope !== "me";

  // KR 달성률 축(기획 §7 Phase 4) — 이번 달 활성 KR 평균 진척(keyResultProgress). 목표 진척 축.
  // '내 성과'(me·사원 고정)면 내 KR만, 팀 스코프면 전사 활성 KR. getOkrData를 재사용하되
  // period를 현재 분기로 고정한다 — 미래 분기 Objective를 미리 만들어도(정상 워크플로)
  // 이 카드가 미래 분기를 조회해 이번 달 KR을 놓치지 않게(글래도스 게이트2 Medium).
  const okr = await getOkrData(user, { period: currentPeriodKey(now) });
  const monthKey = currentMonthKey(now);
  const scopeToMe = scope === "me" || !canScopeTeam;
  const activeKrs = okr.objectives
    .flatMap((o) => o.keyResults)
    .filter((v) => v.keyResult.month === monthKey && v.keyResult.status === "active")
    .filter((v) => !scopeToMe || v.keyResult.ownerId === user.id);
  const krCount = activeKrs.length;
  const krAvgProgress = krCount
    ? Math.round(activeKrs.reduce((sum, v) => sum + v.progress, 0) / krCount)
    : 0;
  // 업무 부하 표(홈·리포트와 동일) — 팀 스코프에서만. '내 성과'(scope=me)에서는 숨긴다.
  const showLoadTable = scope !== "me";
  const loadScopeLabel = isCeo ? "전 인원 부하" : "업무 부하";
  const selfRow = data.lowPerformers[0];

  return (
    <div className="flex flex-col gap-4">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-[var(--que-text)]">
            {scope === "me" || !canScopeTeam ? "내 성과" : "성과"}
          </h1>
          <p className="mt-1 text-sm text-[var(--que-text-secondary)]">
            {scope === "me" || !canScopeTeam
              ? "내 작업 진척·완료·기한 초과를 한눈에. 개인 평가가 아니라 스스로 흐름을 점검하는 용도입니다."
              : "팀 작업 진척·병목·부하 분포를 한눈에. 개인 평가가 아니라 업무 배분과 병목 조정용입니다."}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <ClientFilterBadge clientName={clientName} />
        </div>
      </header>

      {/* 내 성과 | 팀 성과 탭 — 관리자·대표만. 사원은 본인 스코프 고정이라 탭 없음. */}
      {canScopeTeam && (
        <LinkTabs
          label="성과 스코프 전환"
          active={scope}
          tabs={[
            { key: "me", label: "내 성과", href: "/heatmap?scope=me" },
            { key: "team", label: "팀 성과", href: "/heatmap" },
          ]}
        />
      )}

      {/* KPI 4 */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {data.kpis.map((kpi) => (
          <KpiCard key={kpi.key} kpi={kpi} icon={KPI_ICONS[kpi.key]} />
        ))}
      </div>

      {/* KR 달성률 — 이번 달 활성 KR 평균 진척(목표 진척 축). '내 성과'는 내 KR만. */}
      <SectionCard
        title="KR 달성률"
        meta={scopeToMe ? "내 KR · 이번 달" : "팀 KR · 이번 달"}
        action={
          <Link
            href="/daily?tab=okr"
            className="text-sm font-medium text-[var(--que-brand)] hover:underline"
          >
            OKR 보기
          </Link>
        }
      >
        {krCount > 0 ? (
          <div className="flex flex-col gap-2">
            <div className="flex items-end gap-3">
              <p className="text-4xl font-semibold tabular-nums text-[var(--que-text)]">
                {krAvgProgress}%
              </p>
              <p className="pb-1.5 text-sm text-[var(--que-text-secondary)]">
                활성 KR {krCount}개 평균 진척
              </p>
            </div>
            <div
              className="h-2 w-full overflow-hidden rounded-full bg-[var(--que-bg-muted)]"
              role="progressbar"
              aria-valuenow={krAvgProgress}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label="이번 달 활성 KR 평균 진척"
            >
              <div
                className="h-full rounded-full bg-[var(--que-brand)]"
                style={{ width: `${krAvgProgress}%` }}
              />
            </div>
            <p className="text-xs text-[var(--que-text-tertiary)]">
              분기 목표(Objective) 대비 이번 달 핵심결과(KR) 달성 축입니다. 개인 평가가 아닙니다.
            </p>
          </div>
        ) : (
          <p className="text-sm text-[var(--que-text-tertiary)]">이번 달 활성 KR이 없습니다.</p>
        )}
      </SectionCard>

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

      {/* 업무 부하 표 — 홈·리포트와 동일(WorkloadTable). 팀 스코프에서만 노출('내 성과'는 숨김). */}
      {showLoadTable && (
        <WorkloadTable
          load={data.load}
          scopeLabel={loadScopeLabel}
          canManage={user.role === "admin"}
        />
      )}

      {/* 4행: (대표) 기한 초과·완료 현황 · (관리자/사원) 내 월간 요약 | 프로젝트 진행률 */}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        {!showTeamLoadTable ? (
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
            title="기한 초과·완료 현황"
            action={
              <PeriodSelect
                param="lm"
                ariaLabel="기한 초과·완료 현황 기준 월 선택"
                options={MONTH_OPTIONS}
                value={String(lm)}
              />
            }
          >
            <p className="text-xs text-[var(--que-text-tertiary)]">
              선택한 달의 기한 초과·완료 작업 현황입니다. 업무량(부하)이 아니라 마감 이행 관점이며,
              막힘 사유·경과로 병목을 함께 확인합니다. 개인 평가가 아닙니다.
            </p>
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
