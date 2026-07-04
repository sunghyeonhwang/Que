import type { LucideIcon } from "lucide-react";

/**
 * 팀 개요 KPI 카드 — 아이콘 + 라벨 + 큰 숫자(+선택 단위).
 * 성과화면 KpiCard와 달리 증감% 배지가 없는 단순형이다(팀 개요 Figma 사양).
 */
export function TeamKpiCard({
  icon: Icon,
  label,
  value,
  unit,
}: {
  icon: LucideIcon;
  label: string;
  value: number | string;
  unit?: string;
}) {
  return (
    <div className="flex flex-col gap-3 rounded-xl border border-[var(--que-border)] bg-[var(--que-bg)] p-4 shadow-[var(--que-shadow-sm)]">
      <span className="flex size-10 items-center justify-center rounded-lg bg-[var(--que-brand-subtle)] text-[var(--que-brand)]">
        <Icon className="size-5" aria-hidden />
      </span>
      <div>
        <p className="text-sm text-[var(--que-text-secondary)]">{label}</p>
        <p className="mt-0.5 flex items-baseline gap-1">
          <span className="text-3xl font-semibold tracking-tight text-[var(--que-text)] tabular-nums">
            {value}
          </span>
          {unit && (
            <span className="text-sm font-medium text-[var(--que-text-tertiary)]">{unit}</span>
          )}
        </p>
      </div>
    </div>
  );
}
