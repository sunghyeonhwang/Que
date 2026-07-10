import type { WorkflowTrend } from "@/lib/home-grade-data";
import { HomeCard } from "@/components/home/home-card";
import { PerformanceLineChart } from "@/components/performance/performance-line-chart";
import { PeriodSelect } from "@/components/performance/period-select";
import { cn } from "@/lib/utils";

const WF_OPTIONS = [
  { value: "4", label: "4주" },
  { value: "8", label: "8주" },
  { value: "12", label: "12주" },
];

/** Home/WorkflowTrend — 신규·완료·기한초과 3선(성과 라인 차트 재사용) + 순증 배지 + 4/8/12주 토글.
 *  순증은 파생값(음수 가능)이라 선에 섞지 않고 배지로 낸다(명세 §4 B안). X축은 날짜 구간(MM.DD-MM.DD). */
export function WorkflowTrendCard({ trend }: { trend: WorkflowTrend }) {
  // 순증 배지 tone: 적체 증가(순증>0)=주의(amber), 적체 감소(<0)=완화(green), 0=중립.
  const netClass =
    trend.netChange > 0
      ? "border-[var(--que-warning)] bg-[var(--que-warning-bg)] text-[var(--que-warning)]"
      : trend.netChange < 0
        ? "border-[var(--que-success)] bg-[var(--que-success-bg)] text-[var(--que-success)]"
        : "border-[var(--que-border)] text-[var(--que-text-secondary)]";

  return (
    <HomeCard
      title="업무 흐름"
      action={
        <div className="flex items-center gap-2">
          <span
            className={cn(
              "rounded-full border px-2.5 py-1 text-xs font-medium tabular-nums",
              netClass,
            )}
          >
            {trend.netLabel}
          </span>
          <PeriodSelect
            param="wf"
            ariaLabel="업무 흐름 기간 선택"
            options={WF_OPTIONS}
            value={String(trend.weeksBack)}
          />
        </div>
      }
    >
      <PerformanceLineChart data={trend.weeks} />
    </HomeCard>
  );
}
