"use client";

import { createContext, useContext, useState, type ReactNode } from "react";

// 보드 뷰 클라이언트 상태(완료 숨김).
// - board 데이터는 서버 프롭이고 view/page.tsx는 force-dynamic이라, hideCompleted를 URL로 두면
//   매 토글마다 서버 왕복(loadReadOnlyDb·전체 재렌더)이 발생해 매우 느리다.
// - board-grid의 BoardColumn은 이미 모든 카드를 클라에서 받아 filter만 하므로 서버 왕복이 불필요.
//   → hideCompleted를 서버 렌더에서 분리한 클라 상태로 두어 즉시 필터한다.
// - URL(hc=1)은 history.replaceState로만 동기화(router 이동/서버 재렌더 없음) → 새로고침·공유 시 유지.
// - SSR 초기값(initialHideCompleted)을 서버가 넘겨 첫 페인트부터 올바르게 필터(깜빡임 없음).
//   router.refresh(10분 auto-refresh)는 클라 상태를 보존하므로 토글 상태가 유지된다.

interface BoardViewContextValue {
  hideCompleted: boolean;
  toggleHideCompleted: () => void;
}

const BoardViewContext = createContext<BoardViewContextValue | null>(null);

/** hc 파라미터를 URL에 반영한다(replaceState — 재렌더/네비게이션 없음). 클릭 핸들러 내라 항상 클라. */
function syncUrl(next: boolean): void {
  const params = new URLSearchParams(window.location.search);
  if (next) params.set("hc", "1");
  else params.delete("hc");
  const qs = params.toString();
  window.history.replaceState(
    null,
    "",
    qs ? `${window.location.pathname}?${qs}` : window.location.pathname,
  );
}

export function BoardViewProvider({
  initialHideCompleted,
  children,
}: {
  initialHideCompleted: boolean;
  children: ReactNode;
}) {
  const [hideCompleted, setHide] = useState(initialHideCompleted);

  // 사이드이펙트(replaceState)는 렌더 단계인 setState 업데이터가 아니라 이벤트 핸들러에서 실행한다.
  // (업데이터 안에서 history.replaceState를 부르면 App Router가 렌더 중 갱신돼 "cannot update a
  //  component while rendering" 경고가 난다.) 클릭 시점의 hideCompleted는 최신이라 안전하다.
  const toggleHideCompleted = () => {
    const next = !hideCompleted;
    setHide(next);
    syncUrl(next);
  };

  return (
    <BoardViewContext.Provider value={{ hideCompleted, toggleHideCompleted }}>
      {children}
    </BoardViewContext.Provider>
  );
}

export function useBoardView(): BoardViewContextValue {
  const ctx = useContext(BoardViewContext);
  if (!ctx) {
    throw new Error("useBoardView must be used within a BoardViewProvider");
  }
  return ctx;
}
