import { ArrowDownRight, ArrowUpRight, Minus, type LucideIcon } from "lucide-react";
import type { PerfKpi } from "@/lib/performance-data";
import { cn } from "@/lib/utils";

/** KPI 카드 — 아이콘·큰 수·증감% 배지·서브라인. 배지 색은 증감 방향(상승=green/하락=red). */
export function KpiCard({ kpi, icon: Icon }: { kpi: PerfKpi; icon: LucideIcon }) {
  const { direction, deltaPct } = kpi;
  const DeltaIcon =
    direction === "up" ? ArrowUpRight : direction === "down" ? ArrowDownRight : Minus;
  const deltaText = direction === "flat" ? "0%" : `${deltaPct > 0 ? "+" : ""}${deltaPct}%`;

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-[var(--que-border)] bg-[var(--que-bg)] p-4 shadow-[var(--que-shadow-sm)]">
      <div className="flex items-center justify-between gap-2">
        <span className="flex size-9 items-center justify-center rounded-lg bg-[var(--que-brand-subtle)] text-[var(--que-brand)]">
          <Icon className="size-[18px]" aria-hidden />
        </span>
        <span
          className={cn(
            "flex items-center gap-0.5 rounded-full px-2 py-0.5 text-xs font-medium tabular-nums",
            direction === "up" && "bg-[var(--que-success-bg)] text-[var(--que-success)]",
            direction === "down" && "bg-[var(--que-error-bg)] text-[var(--que-error)]",
            direction === "flat" && "bg-[var(--que-bg-muted)] text-[var(--que-text-tertiary)]",
          )}
          aria-label={`전기 대비 ${deltaText}`}
        >
          <DeltaIcon className="size-3" aria-hidden />
          {deltaText}
        </span>
      </div>
      <div>
        <p className="text-sm text-[var(--que-text-secondary)]">{kpi.label}</p>
        <p className="mt-0.5 text-3xl font-semibold tracking-tight text-[var(--que-text)] tabular-nums">
          {kpi.value}
        </p>
      </div>
      <p className="text-xs text-[var(--que-text-tertiary)]">{kpi.subLabel}</p>
    </div>
  );
}
