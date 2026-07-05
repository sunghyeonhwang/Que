"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";

// 완료 카드 숨김 토글(보드 전용). 상태를 URL 파라미터(hc=1)로 유지한다.
// - 서버(board-grid)가 hc=1이면 done 카드를 걸러 렌더 → 자동 갱신/새로고침에도 상태 유지.
// - 조회 전용 화면이라 카드 자체는 클릭 불가. 이 토글만 유일한 인터랙션.
export function HideCompletedToggle({ active }: { active: boolean }) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const toggle = () => {
    const params = new URLSearchParams(searchParams.toString());
    if (active) params.delete("hc");
    else params.set("hc", "1");
    // pathname은 유지(뷰 호스트 rewrite 대비 상대 쿼리로 이동).
    router.push(`?${params.toString()}`, { scroll: false });
  };

  return (
    <button
      type="button"
      role="switch"
      aria-checked={active}
      aria-label="완료 항목 숨기기"
      onClick={toggle}
      className="inline-flex min-h-10 items-center gap-2.5 text-base text-neutral-600"
    >
      <span
        className={cn(
          "relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors",
          active ? "bg-green-600" : "bg-neutral-300",
        )}
      >
        <span
          className={cn(
            "inline-block h-5 w-5 rounded-full bg-white shadow-sm transition-transform",
            active ? "translate-x-[22px]" : "translate-x-0.5",
          )}
        />
      </span>
      <span>Hide completed</span>
    </button>
  );
}
