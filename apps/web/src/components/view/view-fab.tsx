"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { CalendarCheck, SquareCheckBig } from "lucide-react";
import { cn } from "@/lib/utils";

// 보드 ↔ 주간 전환 FAB. 현재 date/week 파라미터를 보존한 링크로 이동한다.
// - 보드에서는 파란 캘린더-체크(→ 주간), 주간에서는 빨간 체크(→ 보드).
// - 재생(슬라이드쇼) 중엔 숨김(opacity 0 + 클릭 차단) — TV 상시 표시용(2026-07-11).
export function ViewFab({ to, href }: { to: "board" | "week"; href: string }) {
  const isWeek = to === "week";
  const searchParams = useSearchParams();
  const playing = searchParams.get("play") === "1";
  return (
    <Link
      href={href}
      aria-label={isWeek ? "주간 스케줄 보기" : "할일 보드 보기"}
      className={cn(
        "absolute bottom-8 right-8 flex size-16 items-center justify-center rounded-full text-white shadow-lg transition-[background-color,opacity]",
        isWeek ? "bg-blue-600 hover:bg-blue-500" : "bg-red-600 hover:bg-red-500",
        playing && "pointer-events-none opacity-0",
      )}
    >
      {isWeek ? (
        <CalendarCheck className="size-7" />
      ) : (
        <SquareCheckBig className="size-7" />
      )}
    </Link>
  );
}
