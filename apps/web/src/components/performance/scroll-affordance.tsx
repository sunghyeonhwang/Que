"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

// 가로 스크롤이 가능함을 드러내는 래퍼(날짜별 업무 집중도 히트맵 등).
// ① 스크롤이 남았을 때 좌/우 페이드 그라데이션 힌트 ② 위치에 따라 나타나는 좌/우 화살표 버튼.
// 화살표는 한 번에 7일치(기본 308px ≈ 7×44px 셀)만큼 스크롤한다. 버튼은 aria-label·키보드 포커스 지원.
export function ScrollAffordance({
  children,
  step = 308,
  className,
}: {
  children: React.ReactNode;
  /** 화살표 클릭 시 스크롤 폭(px). 기본 308 = 7일치(셀 44px 기준). */
  step?: number;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [atStart, setAtStart] = useState(true);
  const [atEnd, setAtEnd] = useState(true);

  const update = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    const maxScroll = el.scrollWidth - el.clientWidth;
    setAtStart(el.scrollLeft <= 1);
    setAtEnd(el.scrollLeft >= maxScroll - 1);
  }, []);

  useEffect(() => {
    update();
    const el = ref.current;
    if (!el) return;
    el.addEventListener("scroll", update, { passive: true });
    // 컨테이너 크기 변화(리사이즈·데이터 변경)에도 힌트를 다시 계산한다.
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => {
      el.removeEventListener("scroll", update);
      ro.disconnect();
    };
  }, [update]);

  const scrollBy = (dir: -1 | 1) => {
    ref.current?.scrollBy({ left: dir * step, behavior: "smooth" });
  };

  return (
    <div className={cn("relative", className)}>
      <div ref={ref} className="overflow-x-auto">
        {children}
      </div>

      {/* 좌측 페이드 + 이전 버튼 */}
      {!atStart && (
        <>
          <div
            aria-hidden
            className="pointer-events-none absolute inset-y-0 left-0 w-10 bg-gradient-to-r from-[var(--que-bg)] to-transparent"
          />
          <button
            type="button"
            aria-label="이전 날짜 보기"
            onClick={() => scrollBy(-1)}
            className="absolute left-1 top-1 z-40 flex size-8 items-center justify-center rounded-full border border-[var(--que-border)] bg-[var(--que-bg)] text-[var(--que-text-secondary)] shadow-[var(--que-shadow-sm)] transition-colors hover:bg-[var(--que-bg-muted)] hover:text-[var(--que-text)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--que-brand)]"
          >
            <ChevronLeft className="size-4" aria-hidden />
          </button>
        </>
      )}

      {/* 우측 페이드 + 다음 버튼 */}
      {!atEnd && (
        <>
          <div
            aria-hidden
            className="pointer-events-none absolute inset-y-0 right-0 w-10 bg-gradient-to-l from-[var(--que-bg)] to-transparent"
          />
          <button
            type="button"
            aria-label="다음 날짜 보기"
            onClick={() => scrollBy(1)}
            className="absolute right-1 top-1 z-40 flex size-8 items-center justify-center rounded-full border border-[var(--que-border)] bg-[var(--que-bg)] text-[var(--que-text-secondary)] shadow-[var(--que-shadow-sm)] transition-colors hover:bg-[var(--que-bg-muted)] hover:text-[var(--que-text)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--que-brand)]"
          >
            <ChevronRight className="size-4" aria-hidden />
          </button>
        </>
      )}
    </div>
  );
}
