"use client";

import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { PerformancePoint } from "@/lib/performance-data";
import { ChartTooltip } from "./chart-tooltip";

// 상태 색 의미 고정: 완료=green, 새작업=amber, 기한초과=red.
// 데이터 계열색은 라이트/다크 공용 고정 팔레트(계열 구분 우선). 차트 구조색(그리드·틱)만 --que-* 토큰.
const SERIES = [
  { key: "completed", name: "완료", color: "#157f2f" },
  { key: "created", name: "새 작업", color: "#d97706" },
  { key: "overdue", name: "기한 초과", color: "#e33030" },
] as const;

/** 작업 성과(3계열 라인) — 주별 완료/새작업/기한초과 수. */
export function PerformanceLineChart({ data }: { data: PerformancePoint[] }) {
  return (
    <div className="h-56 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
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
          <Tooltip content={<ChartTooltip unit="건" />} />
          <Legend
            iconType="plainline"
            wrapperStyle={{ fontSize: 12, paddingTop: 4 }}
          />
          {SERIES.map((s) => (
            <Line
              key={s.key}
              type="monotone"
              dataKey={s.key}
              name={s.name}
              stroke={s.color}
              strokeWidth={2}
              dot={{ r: 2.5, fill: s.color, strokeWidth: 0 }}
              activeDot={{ r: 5 }}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
