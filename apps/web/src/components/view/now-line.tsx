"use client";

import { useEffect, useState } from "react";
import { formatClockTime, minutesOfDayKST } from "./view-format";

// 주간 스케줄 그리드의 현재시각 라인(KST).
// - 모든 날짜 칸을 가로지르는 얇은 라인 + 좌측 파란 pill("9:57 AM").
// - GRID_START~END(주로 10~19시) 밖이면 숨긴다. 30초마다 갱신해 시간 따라 내려온다.
// - 마운트 전(now===null)에는 숨겨 hydration mismatch를 피한다.
// - 배치 좌표는 부모 그리드 본문의 padding(pt-2 pb-4)을 그대로 복제해 DayColumn과 정렬시킨다.
export function NowLine({
  startMin,
  endMin,
}: {
  startMin: number;
  endMin: number;
}) {
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    const tick = () => setNow(new Date());
    tick();
    const id = setInterval(tick, 30_000);
    return () => clearInterval(id);
  }, []);

  if (!now) return null;

  const iso = now.toISOString();
  const min = minutesOfDayKST(iso);
  if (min < startMin || min > endMin) return null;

  const span = endMin - startMin;
  const topPct = ((min - startMin) / span) * 100;

  return (
    <div className="pointer-events-none absolute inset-0 pb-4 pt-2" aria-hidden>
      <div className="relative h-full">
        <div className="absolute inset-x-0" style={{ top: `${topPct}%` }}>
          <div className="absolute inset-x-0 left-16 h-0.5 -translate-y-1/2 bg-blue-500" />
          <span className="absolute left-0 -translate-y-1/2 rounded-full bg-blue-600 px-2.5 py-1 text-xs font-semibold tabular-nums text-white shadow">
            {formatClockTime(iso)}
          </span>
        </div>
      </div>
    </div>
  );
}
