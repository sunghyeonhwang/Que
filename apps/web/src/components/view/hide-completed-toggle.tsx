"use client";

import { cn } from "@/lib/utils";
import { useBoardView } from "./board-view-context";

// 완료 카드 숨김 토글(보드 전용). BoardViewProvider의 클라 상태로 즉시 필터한다.
// - 서버 왕복 없이 board-grid의 BoardColumn이 클라에서 filter만 하므로 클릭 즉시 반영된다.
// - URL(hc=1)은 context가 history.replaceState로만 동기화(재렌더/네비게이션 없음).
// - 조회 전용 화면이라 카드 자체는 클릭 불가. 이 토글만 유일한 인터랙션.
export function HideCompletedToggle() {
  const { hideCompleted, toggleHideCompleted } = useBoardView();

  return (
    <button
      type="button"
      role="switch"
      aria-checked={hideCompleted}
      aria-label="완료 항목 숨기기"
      onClick={toggleHideCompleted}
      className="inline-flex min-h-10 items-center gap-2.5 text-base text-neutral-600"
    >
      <span
        className={cn(
          "relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors",
          hideCompleted ? "bg-green-600" : "bg-neutral-300",
        )}
      >
        <span
          className={cn(
            "inline-block h-5 w-5 rounded-full bg-white shadow-sm transition-transform",
            hideCompleted ? "translate-x-[22px]" : "translate-x-0.5",
          )}
        />
      </span>
      <span>Hide completed</span>
    </button>
  );
}
