"use client";

import type { TooltipContentProps } from "recharts";

/** recharts 공용 툴팁 — 디자인 토큰 스타일. 색·라벨·수치를 함께 표기(색 단독 구분 회피). */
export function ChartTooltip({
  active,
  payload,
  label,
  unit = "",
}: Partial<TooltipContentProps<number, string>> & { unit?: string }) {
  if (!active || !payload || payload.length === 0) return null;
  return (
    <div className="rounded-lg border border-[var(--que-border)] bg-[var(--que-bg)] px-3 py-2 text-xs shadow-md">
      <p className="mb-1 font-semibold text-[var(--que-text)]">{label}</p>
      <ul className="flex flex-col gap-1">
        {payload.map((entry) => (
          <li key={String(entry.dataKey)} className="flex items-center gap-2">
            <span
              className="size-2.5 shrink-0 rounded-[3px]"
              style={{ backgroundColor: entry.color ?? "var(--que-text-tertiary)" }}
              aria-hidden
            />
            <span className="text-[var(--que-text-secondary)]">{entry.name}</span>
            <span className="ml-auto font-medium tabular-nums text-[var(--que-text)]">
              {entry.value}
              {unit}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
