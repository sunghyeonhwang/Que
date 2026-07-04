"use client";

import {
  Bar,
  BarChart,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { HomeDistributionRow } from "@/lib/home-data";
import { ChartTooltip } from "@/components/performance/chart-tooltip";

/** 작업 분포 — 멤버별 활성 작업 수(가로 막대). 색은 멤버 아바타색. */
export function TaskDistributionChart({ data }: { data: HomeDistributionRow[] }) {
  const height = Math.max(200, data.length * 36);
  return (
    <div style={{ height }} className="w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={data}
          layout="vertical"
          margin={{ top: 4, right: 12, left: 0, bottom: 0 }}
          barCategoryGap="28%"
        >
          <XAxis
            type="number"
            allowDecimals={false}
            tickLine={false}
            axisLine={false}
            tick={{ fill: "var(--que-text-tertiary)", fontSize: 12 }}
          />
          <YAxis
            type="category"
            dataKey="name"
            width={56}
            tickLine={false}
            axisLine={false}
            tick={{ fill: "var(--que-text-secondary)", fontSize: 12 }}
          />
          <Tooltip cursor={{ fill: "var(--que-bg-muted)" }} content={<ChartTooltip unit="건" />} />
          <Bar dataKey="value" name="활성 작업" radius={[0, 4, 4, 0]} maxBarSize={20}>
            {data.map((row) => (
              <Cell key={row.id} fill={row.color} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
