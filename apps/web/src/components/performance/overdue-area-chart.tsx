"use client";

import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { OverduePoint } from "@/lib/performance-data";
import { ChartTooltip } from "./chart-tooltip";

/** 기한 초과 추이(영역) — red(문제). 주별 기한 초과(마감 지남·미완료) 수.
 *  계열색 #e33030은 performance-line-chart의 '기한 초과' 계열과 통일(같은 화면 동일 지표 동일색).
 *  라이트/다크 공용 고정(계열 신호색). 구조색(그리드·틱)만 --que-* 토큰. */
export function OverdueAreaChart({ data }: { data: OverduePoint[] }) {
  return (
    <div className="h-56 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
          <defs>
            <linearGradient id="que-area-overdue" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#e33030" stopOpacity={0.35} />
              <stop offset="100%" stopColor="#e33030" stopOpacity={0.02} />
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
          <Tooltip content={<ChartTooltip unit="건" />} />
          <Area
            type="monotone"
            dataKey="overdue"
            name="기한 초과"
            stroke="#e33030"
            strokeWidth={2}
            fill="url(#que-area-overdue)"
            dot={{ r: 3, fill: "#e33030", strokeWidth: 0 }}
            activeDot={{ r: 5 }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
