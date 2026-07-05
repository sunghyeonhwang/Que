"use client";

import { useEffect, useState } from "react";

// 라이브 시계(KST). 1초마다 tick, "7:33 PM" 형식.
// 서버/클라 시간 차로 인한 hydration mismatch를 피하려고 마운트 전까지는 빈 자리표시를 둔다.

const fmt = new Intl.DateTimeFormat("en-US", {
  timeZone: "Asia/Seoul",
  hour: "numeric",
  minute: "2-digit",
  hour12: true,
});

export function ViewClock() {
  const [time, setTime] = useState<string>("");

  useEffect(() => {
    const tick = () => setTime(fmt.format(new Date()));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <span suppressHydrationWarning aria-label="현재 시각" className="tabular-nums">
      {time || "—"}
    </span>
  );
}
