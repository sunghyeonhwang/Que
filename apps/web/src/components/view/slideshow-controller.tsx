"use client";

import { useEffect, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Pause, Play } from "lucide-react";
import { cn } from "@/lib/utils";

// 벽 디스플레이용 슬라이드쇼(자동 순회) 컨트롤러.
// - (view)/layout.tsx에 배치되어 소프트 내비(router.push)·10분 auto-refresh에도 언마운트되지 않는다.
// - 상태를 URL 파라미터 ?play=1로 둔다 → 전체 리로드/키오스크 재시작에도 순회가 URL만 보고 재개된다.
// - "무상태 재-arm": 현재 URL(view/bp)에서 다음 스텝과 지연을 계산해 setTimeout → router.push.
//   URL이 바뀌면 이 컴포넌트가 다시 렌더되어(useSearchParams) 이전 타이머를 clear하고 재계산·재arm한다.
//
// 시퀀스(전부 play=1 유지):
//   board bp=k (k<boardPages)  --25s-->  board bp=k+1
//   board bp=boardPages        --25s-->  week(range=week)
//   week                       --120s--> board bp=1
// boardPages는 서버(layout)가 팀원 수로 계산해 prop으로 주입한다(ceil(count/2)).

export const SLIDE_BOARD_MS = 25_000;
export const SLIDE_SCHEDULE_MS = 120_000;

/** 보드 스텝 URL 파라미터. 항상 paged·play 유지, hc는 켜져 있으면 보존. */
function boardParams(page: number, hideCompleted: boolean): URLSearchParams {
  const p = new URLSearchParams();
  p.set("view", "board");
  p.set("bmode", "paged");
  p.set("bp", String(page));
  p.set("play", "1");
  if (hideCompleted) p.set("hc", "1");
  return p;
}

/** 스케줄 스텝 URL 파라미터(week 범위). */
function weekParams(): URLSearchParams {
  const p = new URLSearchParams();
  p.set("view", "week");
  p.set("range", "week");
  p.set("play", "1");
  return p;
}

export function SlideshowController({ boardPages }: { boardPages: number }) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const pages = Math.max(1, boardPages);
  const playing = searchParams.get("play") === "1";
  const view = searchParams.get("view") === "week" ? "week" : "board";
  const hideCompleted = searchParams.get("hc") === "1";

  const bpRaw = Number(searchParams.get("bp"));
  const bp =
    Number.isFinite(bpRaw) && bpRaw >= 1 ? Math.min(Math.floor(bpRaw), pages) : 1;

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    // 재-arm: 이전 타이머를 항상 정리하고(파라미터 변화·언마운트) 재계산한다.
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    if (!playing) return;

    let next: URLSearchParams;
    let delay: number;
    if (view === "week") {
      next = boardParams(1, hideCompleted);
      delay = SLIDE_SCHEDULE_MS;
    } else if (bp < pages) {
      next = boardParams(bp + 1, hideCompleted);
      delay = SLIDE_BOARD_MS;
    } else {
      next = weekParams();
      delay = SLIDE_BOARD_MS;
    }

    timerRef.current = setTimeout(() => {
      router.push(`?${next.toString()}`, { scroll: false });
    }, delay);

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [playing, view, bp, pages, hideCompleted, router]);

  const toggle = () => {
    if (playing) {
      // 정지: play·bp 제거(현재 뷰는 유지). 타이머는 재-arm effect가 정리한다.
      const params = new URLSearchParams(searchParams.toString());
      params.delete("play");
      params.delete("bp");
      router.push(`?${params.toString()}`, { scroll: false });
    } else {
      // 재생 시작: 보드 1페이지부터.
      router.push(`?${boardParams(1, hideCompleted).toString()}`, { scroll: false });
    }
  };

  return (
    <button
      type="button"
      onClick={toggle}
      aria-pressed={playing}
      aria-label={playing ? "슬라이드쇼 정지" : "슬라이드쇼 재생"}
      title={playing ? "슬라이드쇼 정지" : "슬라이드쇼 재생 (벽 디스플레이 자동 순회)"}
      className={cn(
        // 좌하단 플로팅. FAB(우하단)와 겹치지 않는다. 데이터/카드를 가리지 않게 코너 고정.
        "absolute bottom-8 left-8 flex size-16 items-center justify-center rounded-full text-white shadow-lg transition-colors",
        playing
          ? "bg-green-600 hover:bg-green-500"
          : "bg-neutral-900 hover:bg-neutral-700",
      )}
    >
      {playing ? (
        <Pause className="size-7" fill="currentColor" strokeWidth={0} />
      ) : (
        <Play className="size-7" fill="currentColor" strokeWidth={0} />
      )}
    </button>
  );
}
