"use client";

import { useEffect, useState } from "react";
import { Maximize2, Minimize2 } from "lucide-react";

// 공개 현황판(view.griff.co.kr) 전체화면 토글 — 사무실 TV/모니터 상시 표시용.
// Fullscreen API 미지원(iOS Safari 등)이면 버튼을 숨긴다.
export function FullscreenButton() {
  const [supported, setSupported] = useState(false);
  const [active, setActive] = useState(false);

  useEffect(() => {
    // 레포 표준: effect 본문 동기 setState 금지 — microtask 콜백에서 판정(purity 룰).
    let alive = true;
    Promise.resolve().then(() => {
      if (alive) setSupported(!!document.documentElement.requestFullscreen);
    });
    const onChange = () => setActive(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", onChange);
    return () => {
      alive = false;
      document.removeEventListener("fullscreenchange", onChange);
    };
  }, []);

  if (!supported) return null;

  const toggle = () => {
    if (document.fullscreenElement) void document.exitFullscreen();
    else void document.documentElement.requestFullscreen();
  };

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={active ? "전체화면 종료" : "전체화면 보기"}
      className="flex size-10 items-center justify-center rounded-lg text-[var(--que-text-tertiary)] transition-colors hover:bg-black/5 hover:text-[var(--que-text)] dark:hover:bg-white/10"
    >
      {active ? <Minimize2 className="size-5" aria-hidden /> : <Maximize2 className="size-5" aria-hidden />}
    </button>
  );
}
