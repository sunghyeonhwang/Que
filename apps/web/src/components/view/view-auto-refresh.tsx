"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

// 대형 디스플레이 상시 노출용 자동 갱신. 기본 10분마다 router.refresh()로
// 서버 컴포넌트를 다시 데이터 로드시킨다(전체 리로드가 아니라 RSC 갱신).
export function ViewAutoRefresh({ intervalMs = 600_000 }: { intervalMs?: number }) {
  const router = useRouter();

  useEffect(() => {
    const id = setInterval(() => router.refresh(), intervalMs);
    return () => clearInterval(id);
  }, [router, intervalMs]);

  return null;
}
