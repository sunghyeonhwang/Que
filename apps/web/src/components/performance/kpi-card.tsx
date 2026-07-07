import { ArrowDownRight, ArrowUpRight, Minus, type LucideIcon } from "lucide-react";
import type { PerfKpi } from "@/lib/performance-data";
import { cn } from "@/lib/utils";

/** KPI 카드 — 아이콘·큰 수·증감% 배지·서브라인. 배지 색은 방향이 아니라 지표 극성으로 정한다:
 *  goodDirection(그 지표에 "좋은" 방향)과 실제 방향이 같으면 green, 반대면 red, 변화 없음이면 중립.
 *  (RPT-2, 2026-07-07 UX 감사 — 기한초과 증가를 green으로 오독하던 버그 수정) */
export function KpiCard({ kpi, icon: Icon }: { kpi: PerfKpi; icon: LucideIcon }) {
  const { direction, deltaPct, goodDirection } = kpi;
  const DeltaIcon =
    direction === "up" ? ArrowUpRight : direction === "down" ? ArrowDownRight : Minus;
  const deltaText = direction === "flat" ? "0%" : `${deltaPct > 0 ? "+" : ""}${deltaPct}%`;
  // 변화 방향이 이 지표에 좋은 방향이면 good(green), 아니면 bad(red). flat은 중립.
  const isGood = direction !== "flat" && direction === goodDirection;
  const isBad = direction !== "flat" && direction !== goodDirection;

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-[var(--que-border)] bg-[var(--que-bg)] p-4 shadow-[var(--que-shadow-sm)]">
      <div className="flex items-center justify-between gap-2">
        <span className="flex size-9 items-center justify-center rounded-lg bg-[var(--que-brand-subtle)] text-[var(--que-brand)]">
          <Icon className="size-[18px]" aria-hidden />
        </span>
        <span
          className={cn(
            "flex items-center gap-0.5 rounded-full px-2 py-0.5 text-xs font-medium tabular-nums",
            isGood && "bg-[var(--que-success-bg)] text-[var(--que-success)]",
            isBad && "bg-[var(--que-error-bg)] text-[var(--que-error)]",
            direction === "flat" && "bg-[var(--que-bg-muted)] text-[var(--que-text-tertiary)]",
          )}
          aria-label={`전기 대비 ${deltaText}, ${
            isGood ? "개선" : isBad ? "악화" : "변화 없음"
          }`}
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
