import { AlertTriangle, ArrowDown, ArrowUp, Minus, Pause, type LucideIcon } from "lucide-react";
import type { AdminReportData, HealthMetric } from "@/lib/report-data";
import type { HomeKpi } from "@/lib/home-grade-data";
import { AiAnalysisCard } from "./ai-analysis-card";
import { HomeCard } from "@/components/home/home-card";
import { KpiStrip } from "@/components/home/kpi-strip";
import { PerformanceLineChart } from "@/components/performance/performance-line-chart";
import { cn } from "@/lib/utils";

/** 관리자 리포트 뷰 — 진척(프로젝트별 완료)·병목(현재 막힘)·부하 분포(밸런싱)만 보여준다.
 *  개인 완료 순위/점수는 의도적으로 없다 (기획서 "감시 아님" 원칙).
 *  홈 대시보드 컴포넌트(HomeCard·KpiStrip)와 상태색 팔레트를 재사용해 가독성을 올린다
 *  (green=완료, red=문제, amber=주의/홀드, blue=정보). */
export function AdminReport({ data }: { data: AdminReportData }) {
  const periodLabel = data.period === "week" ? "최근 7일" : "최근 4주";
  const maxProject = Math.max(...data.completedByProject.map((p) => p.count), 1);
  const maxLoad = Math.max(...data.loadByMember.map((m) => m.loadScore), 1);
  // 순증 배지 tone: 적체 증가(순증>0)=주의(amber), 적체 감소(<0)=완화(green), 0=중립(홈 카드와 동일 규약).
  const net = data.workflowTrend.netChange;
  const netClass =
    net > 0
      ? "border-[var(--que-warning)] bg-[var(--que-warning-bg)] text-[var(--que-warning)]"
      : net < 0
        ? "border-[var(--que-success)] bg-[var(--que-success-bg)] text-[var(--que-success)]"
        : "border-[var(--que-border)] text-[var(--que-text-secondary)]";

  // 전체 현황 → 홈 KpiStrip(tone·href). red=문제/연체, amber=대기.
  const snapshot: HomeKpi[] = [
    {
      key: "active_projects",
      label: "진행 프로젝트",
      value: data.overall.activeProjects,
      href: "/projects",
    },
    { key: "open_tasks", label: "열린 작업", value: data.overall.openTasks, href: "/now" },
    {
      key: "blocked_now",
      label: "현재 막힘",
      value: data.overall.blockedNow,
      href: "/team",
      tone: data.overall.blockedNow > 0 ? "danger" : "default",
    },
    {
      key: "at_risk",
      label: "위험 마일스톤",
      value: data.overall.atRiskMilestones,
      href: "/planning?tab=milestones",
      tone: data.overall.atRiskMilestones > 0 ? "danger" : "default",
    },
    {
      key: "pending_pay",
      label: "결제 대기",
      value: data.overall.pendingPayments,
      href: "/payments",
      tone: data.overall.pendingPayments > 0 ? "warning" : "default",
    },
    {
      key: "overdue_pay",
      label: "결제 연체",
      value: data.overall.overduePayments,
      href: "/payments",
      tone: data.overall.overduePayments > 0 ? "danger" : "default",
    },
  ];

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-[var(--que-text-secondary)]">
        {periodLabel} ({data.rangeStart} ~ {data.rangeEnd}) · 대표/관리자 전용 · 개인 평가가 아니라
        진척과 병목을 보기 위한 요약입니다.
      </p>

      {/* 전체 현황 → 홈 KpiStrip */}
      <KpiStrip items={snapshot} cols={6} ariaLabel="전체 현황" />

      {/* 운영 건강도 3종 — 흐름·구조 진단(개인 평가 아님). 전 기간 대비 증감 동반. */}
      <HomeCard title="운영 건강도" meta={`${periodLabel} 기준 · 이전 기간 대비`}>
        <div className="grid gap-4 sm:grid-cols-3">
          <HealthCell label="병목 해소 시간" metric={data.opsHealth.resolution} />
          <HealthCell label="기한 준수율" metric={data.opsHealth.adherence} />
          <HealthCell label="재발 병목" metric={data.opsHealth.recurring} caption="구조 문제 신호" />
        </div>
      </HomeCard>

      <div className="grid gap-4 xl:grid-cols-2">
        {/* 진척: 기간 완료 + 프로젝트별 (완료=green) */}
        <HomeCard
          title={`진척 — ${periodLabel} 완료 ${data.completedInPeriod}건`}
          meta={data.cancelledInPeriod > 0 ? `취소 ${data.cancelledInPeriod}건` : undefined}
        >
          <div className="flex flex-col gap-2">
            {data.completedByProject.length === 0 && (
              <p className="text-sm text-[var(--que-text-tertiary)]">
                이 기간에 완료된 작업이 없습니다.
              </p>
            )}
            {data.completedByProject.map((p) => (
              <div key={p.name} className="flex items-center gap-2">
                <span className="w-28 shrink-0 truncate text-sm text-[var(--que-text)]">
                  {p.name}
                </span>
                <span className="flex h-2 flex-1 overflow-hidden rounded-full bg-[var(--que-bg-muted)]">
                  <span
                    className="h-full rounded-full bg-[var(--que-success)]"
                    style={{
                      width: `${(p.count / maxProject) * 100}%`,
                      minWidth: p.count ? "0.5rem" : "0",
                    }}
                    aria-hidden
                  />
                </span>
                <span className="w-6 shrink-0 text-right text-sm tabular-nums text-[var(--que-text-secondary)]">
                  {p.count}
                </span>
              </div>
            ))}
          </div>
        </HomeCard>

        {/* 업무 흐름 — 최근 8주 (신규·완료·기한초과 3선 + 순증, 홈 workflow-trend-card와 동일 렌더).
            문제/홀드 발생은 '이번 기간' 스코프 보조 뱃지로 유지. */}
        <HomeCard
          title="업무 흐름 — 최근 8주"
          action={
            <span
              className={cn(
                "rounded-full border px-2.5 py-1 text-xs font-medium tabular-nums",
                netClass,
              )}
            >
              {data.workflowTrend.netLabel}
            </span>
          }
        >
          <div className="flex flex-col gap-3">
            <div className="flex flex-wrap gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-md border border-[var(--que-error)] bg-[var(--que-error-bg)] px-2 py-1 text-xs font-medium text-[var(--que-error)]">
                <AlertTriangle className="size-3.5" aria-hidden />
                이번 기간 문제 {data.raisedIssues}건
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-md border border-[var(--que-warning)] bg-[var(--que-warning-bg)] px-2 py-1 text-xs font-medium text-[var(--que-warning)]">
                <Pause className="size-3.5" aria-hidden />
                이번 기간 홀드 {data.raisedHolds}건
              </span>
            </div>
            <PerformanceLineChart data={data.workflowTrend.weeks} />
          </div>
        </HomeCard>
      </div>

      {/* 현재 막혀 있는 작업 — 홈 PriorityList 룩(유형 뱃지). issue=red, on_hold=amber. */}
      <HomeCard
        title="현재 막혀 있는 작업"
        meta={`${data.currentBlockers.length}건 · 도움이 필요한 곳`}
      >
        {data.currentBlockers.length === 0 ? (
          <p className="text-sm text-[var(--que-text-tertiary)]">
            현재 막혀 있는 작업이 없습니다.
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {data.currentBlockers.map((b) => (
              <BlockerRow
                key={b.taskId}
                status={b.status}
                title={b.taskTitle}
                meta={`${b.projectName ?? "프로젝트 미지정"} · 담당 ${b.assigneeName} · ${b.sinceLabel}`}
                reason={b.reason}
              />
            ))}
          </ul>
        )}
      </HomeCard>

      {/* 부하 분포 — 밸런싱용 (평가 아님). 색 막대로 어디에 일이 몰렸는지. */}
      <HomeCard title="부하 분포" meta="업무 배분 조정용 (평가 아님)">
        <p className="mb-3 text-xs text-[var(--que-text-tertiary)]">
          막대 길이 = 예상 소요 시간에 문제발생·홀드·마감 임박 가중을 더한 부하(단순 작업 수 아님).
          줄세우기가 아니라 어디에 일이 몰렸는지 보기 위한 것입니다.
        </p>
        <div className="flex flex-col gap-2">
          {data.loadByMember.map((m) => {
            const ratio = m.loadScore / maxLoad;
            // 상대 부하로 색을 준다: 높음(>=80%)=red, 중간(>=50%)=amber, 그 외 blue(정보).
            const bar =
              ratio >= 0.8
                ? "bg-[var(--que-error)]"
                : ratio >= 0.5
                  ? "bg-[var(--que-warning)]"
                  : "bg-[var(--que-brand)]";
            return (
              <div key={m.name} className="flex items-center gap-2">
                <span className="w-16 shrink-0 text-sm text-[var(--que-text)]">{m.name}</span>
                <span className="flex h-2.5 flex-1 overflow-hidden rounded-full bg-[var(--que-bg-muted)]">
                  <span
                    className={cn("h-full rounded-full", bar)}
                    style={{
                      width: `${ratio * 100}%`,
                      minWidth: m.loadScore ? "0.5rem" : "0",
                    }}
                    aria-hidden
                  />
                </span>
                <span className="shrink-0 text-xs tabular-nums text-[var(--que-text-secondary)]">
                  열린 {m.openTasks}건 · 예상 {m.openHours}h
                  {m.blocked > 0 && (
                    <span className="font-medium text-[var(--que-error)]"> · 막힘 {m.blocked}</span>
                  )}
                </span>
              </div>
            );
          })}
        </div>
      </HomeCard>

      {/* E-10 분석 AI — 온디맨드(버튼식). 리포트 집계를 근거로 병목·조치를 코치 톤으로. */}
      <AiAnalysisCard period={data.period} />
    </div>
  );
}

// 운영 건강도 한 칸 — 큰 수치 + 증감 배지(화살표+텍스트, 색은 보조) + 서브라벨.
// tone 의미: good=개선(green)/bad=악화(red)/neutral=중립. 색 단독 금지라 화살표·문구를 항상 동반한다.
const HEALTH_ICON: Record<HealthMetric["direction"], LucideIcon | null> = {
  up: ArrowUp,
  down: ArrowDown,
  flat: Minus,
  none: null,
};
const HEALTH_TONE: Record<HealthMetric["tone"], string> = {
  good: "text-[var(--que-success)]",
  bad: "text-[var(--que-error)]",
  neutral: "text-[var(--que-text-secondary)]",
};

function HealthCell({
  label,
  metric,
  caption,
}: {
  label: string;
  metric: HealthMetric;
  caption?: string;
}) {
  const Icon = HEALTH_ICON[metric.direction];
  const toneClass = HEALTH_TONE[metric.tone];
  return (
    <div className="flex flex-col gap-1">
      <p className="text-xs text-[var(--que-text-secondary)]">{label}</p>
      <p className="text-2xl font-semibold tabular-nums text-[var(--que-text)]">{metric.value}</p>
      <p className={cn("inline-flex items-center gap-1 text-xs font-medium", toneClass)}>
        {Icon && <Icon className="size-3.5 shrink-0" aria-hidden />}
        {metric.deltaLabel}
      </p>
      {metric.sub && (
        <p className="text-xs text-[var(--que-text-tertiary)]" title={metric.sub}>
          {metric.sub}
        </p>
      )}
      {caption && (
        <p className="text-[11px] text-[var(--que-text-tertiary)]">{caption}</p>
      )}
    </div>
  );
}

// 막힌 작업 행 — 홈 PriorityList 룩(색 뱃지 칩 + 제목 + 메타). issue=red, on_hold=amber.
const BLOCKER_TONE: Record<"issue" | "on_hold", { chip: string; icon: LucideIcon; label: string }> =
  {
    issue: {
      chip: "border-[var(--que-error)] bg-[var(--que-error-bg)] text-[var(--que-error)]",
      icon: AlertTriangle,
      label: "문제발생",
    },
    on_hold: {
      chip: "border-[var(--que-warning)] bg-[var(--que-warning-bg)] text-[var(--que-warning)]",
      icon: Pause,
      label: "홀드",
    },
  };

function BlockerRow({
  status,
  title,
  meta,
  reason,
}: {
  status: "issue" | "on_hold";
  title: string;
  meta: string;
  reason?: string;
}) {
  const tone = BLOCKER_TONE[status];
  const Icon = tone.icon;
  return (
    <li className="flex min-h-11 flex-wrap items-center gap-2 rounded-lg border border-[var(--que-border)] px-3 py-2">
      <span
        className={cn(
          "inline-flex shrink-0 items-center gap-1 rounded-md border px-1.5 py-0.5 text-xs font-medium",
          tone.chip,
        )}
      >
        <Icon className="size-3.5" aria-hidden />
        {tone.label}
      </span>
      <span className="min-w-0 flex-1 truncate text-sm font-medium text-[var(--que-text)]">
        {title}
      </span>
      <span className="text-xs text-[var(--que-text-secondary)]">{meta}</span>
      {reason && (
        <span className="w-full truncate text-xs text-[var(--que-text-tertiary)]">
          사유: {reason}
        </span>
      )}
    </li>
  );
}
