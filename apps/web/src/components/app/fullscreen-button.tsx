"use client";

import { useSyncExternalStore } from "react";
import { Maximize2, Minimize2 } from "lucide-react";
import { IconButton } from "./icon-button";

/** 전체화면 토글 버튼(조회성 — core 무관).
 *  문서 전체(documentElement)를 requestFullscreen/exitFullscreen으로 토글한다.
 *  - fullscreenchange 구독으로 브라우저 UI(ESC 종료 등)와 상태를 동기화한다.
 *  - feature-detect: document.fullscreenEnabled가 false인 환경에선 렌더하지 않는다.
 *    useSyncExternalStore의 서버 스냅샷을 false로 두어 SSR/CSR 불일치를 피한다
 *    (서버·최초 클라 렌더는 항상 미노출, 하이드레이션 후 지원되면 나타난다). */

const NOOP_UNSUBSCRIBE = () => () => {};

function subscribeFullscreen(onChange: () => void) {
  document.addEventListener("fullscreenchange", onChange);
  return () => document.removeEventListener("fullscreenchange", onChange);
}

export function FullscreenButton({
  variant = "outline",
  className,
}: {
  variant?: "ghost" | "outline";
  className?: string;
}) {
  // 지원 여부(고정값) — 구독 불필요, 서버 스냅샷 false로 하이드레이션 안전.
  const supported = useSyncExternalStore(
    NOOP_UNSUBSCRIBE,
    () => document.fullscreenEnabled,
    () => false,
  );
  // 현재 전체화면 여부 — fullscreenchange로 갱신.
  const isFullscreen = useSyncExternalStore(
    subscribeFullscreen,
    () => Boolean(document.fullscreenElement),
    () => false,
  );

  if (!supported) return null;

  const toggle = () => {
    if (document.fullscreenElement) {
      void document.exitFullscreen();
    } else {
      void document.documentElement.requestFullscreen();
    }
  };

  const label = isFullscreen ? "전체화면 종료" : "전체화면";

  return (
    <IconButton label={label} onClick={toggle} variant={variant} className={className}>
      {isFullscreen ? (
        <Minimize2 className="size-4" aria-hidden />
      ) : (
        <Maximize2 className="size-4" aria-hidden />
      )}
    </IconButton>
  );
}
