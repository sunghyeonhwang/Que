"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { MonthlyCompletion } from "@/lib/performance-data";
import { ChartTooltip } from "./chart-tooltip";

/** 작업 완료율(월별 막대) — 파랑 그라데이션. 완료 수 = status_logs done 전이 기준. */
export function CompletionBarChart({ data }: { data: MonthlyCompletion[] }) {
  return (
    <div className="h-56 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
          <defs>
            <linearGradient id="que-bar-blue" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--que-brand)" stopOpacity={0.95} />
              <stop offset="100%" stopColor="var(--que-brand)" stopOpacity={0.35} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--que-border)" vertical={false} />
          <XAxis
            dataKey="label"
            tickLine={false}
            axisLine={false}
            tick={{ fill: "var(--que-text-tertiary)", fontSize: 12 }}
          />
          <YAxis
            tickLine={false}
            axisLine={false}
            width={40}
            tick={{ fill: "var(--que-text-tertiary)", fontSize: 12 }}
          />
          <Tooltip
            cursor={{ fill: "var(--que-brand)", fillOpacity: 0.08 }}
            content={<ChartTooltip unit="건" />}
          />
          <Bar
            dataKey="completed"
            name="완료"
            fill="url(#que-bar-blue)"
            radius={[6, 6, 0, 0]}
            maxBarSize={44}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
