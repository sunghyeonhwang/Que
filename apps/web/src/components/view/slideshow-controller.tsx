"use client";

import { useEffect, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Pause, Play } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  useViewSettings,
  type ViewSettings,
  type ViewSlideScheduleRange,
} from "@/lib/view-settings";

// 벽 디스플레이용 슬라이드쇼(자동 순회) 컨트롤러.
// - (view)/layout.tsx에 배치되어 소프트 내비(router.push)·10분 auto-refresh에도 언마운트되지 않는다.
// - 상태를 URL 파라미터 ?play=1로 둔다 → 전체 리로드/키오스크 재시작에도 순회가 URL만 보고 재개된다.
// - "무상태 재-arm": 현재 URL(view/bp)에서 다음 스텝과 지연을 계산해 setTimeout → router.push.
//   URL이 바뀌면 이 컴포넌트가 다시 렌더되어(useSearchParams) 이전 타이머를 clear하고 재계산·재arm한다.
//
// 타이밍·뷰·순회 포함은 설정(useViewSettings, localStorage)에서 읽는다(하드코딩 상수 제거).
// 설정 변경 시 effect deps로 재-arm되어 "다음 스텝부터" 새 설정이 반영된다.
//
// 시퀀스(설정에 따라 분기, 전부 play=1 유지):
//   · 보드·스케줄 둘 다 + boardMode=paged:
//       board bp=k(k<pages) --boardS--> bp=k+1 --...--> bp=pages --boardS--> schedule --scheduleS--> bp=1
//   · 둘 다 + boardMode=all:
//       board(all 단일화면) --boardS--> schedule --scheduleS--> board(all)
//   · 보드만 + paged: 보드 페이지 무한 순회. all: 단일 화면 정적 유지(타이머 없음).
//   · 스케줄만: 스케줄 정적 유지(타이머 없음).
//   · 둘 다 해제: 무동작.
// boardPages는 서버(layout)가 팀원 수로 계산해 prop으로 주입한다(ceil(count/2)).

/** 보드(2명/페이지) 스텝 URL. bp·bmode=paged·play 유지, hc 보존. */
function boardPagedParams(page: number, hideCompleted: boolean): URLSearchParams {
  const p = new URLSearchParams();
  p.set("view", "board");
  p.set("bmode", "paged");
  p.set("bp", String(page));
  p.set("play", "1");
  if (hideCompleted) p.set("hc", "1");
  return p;
}

/** 보드(전체 8명 한 화면) 스텝 URL. bp 없음, bmode=all·play 유지, hc 보존. */
function boardAllParams(hideCompleted: boolean): URLSearchParams {
  const p = new URLSearchParams();
  p.set("view", "board");
  p.set("bmode", "all");
  p.set("play", "1");
  if (hideCompleted) p.set("hc", "1");
  return p;
}

/** 스케줄 스텝 URL(설정 range). 1day는 사람 열, 3day는 날짜 열. */
function scheduleParams(range: ViewSlideScheduleRange): URLSearchParams {
  const p = new URLSearchParams();
  p.set("view", "week");
  p.set("range", range);
  p.set("play", "1");
  return p;
}

export function SlideshowController({ boardPages }: { boardPages: number }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const settings = useViewSettings();

  const pages = Math.max(1, boardPages);
  const playing = searchParams.get("play") === "1";
  const view = searchParams.get("view") === "week" ? "week" : "board";
  const hideCompleted = searchParams.get("hc") === "1";

  const bpRaw = Number(searchParams.get("bp"));
  const bp =
    Number.isFinite(bpRaw) && bpRaw >= 1 ? Math.min(Math.floor(bpRaw), pages) : 1;

  const {
    boardSeconds,
    scheduleSeconds,
    scheduleRange,
    boardMode,
    includeBoard,
    includeSchedule,
  } = settings;

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    // 재-arm: 이전 타이머를 항상 정리하고(파라미터/설정 변화·언마운트) 재계산한다.
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    if (!playing) return;
    if (!includeBoard && !includeSchedule) return; // 방어: 순회 대상 없음 → 무동작.

    const boardMs = boardSeconds * 1000;
    const scheduleMs = scheduleSeconds * 1000;
    // 보드 진입 스텝: 모드에 따라 전체 화면 또는 1페이지.
    const boardEnter = () =>
      boardMode === "all"
        ? boardAllParams(hideCompleted)
        : boardPagedParams(1, hideCompleted);

    let next: URLSearchParams | null = null;
    let delay = 0;

    if (view === "week") {
      // 현재 스케줄. 스케줄 제외 상태로 여기 있으면 보드로 복귀, 아니면 다음 스텝.
      if (!includeSchedule) {
        if (!includeBoard) return; // 방어(도달 불가): 둘 다 없음.
        next = boardEnter();
        delay = 300;
      } else if (includeBoard) {
        next = boardEnter();
        delay = scheduleMs;
      } else {
        return; // 스케줄만: 정적 유지(타이머 없음).
      }
    } else {
      // 현재 보드.
      if (!includeBoard) {
        // 보드 제외인데 보드에 있음 → 스케줄로.
        next = scheduleParams(scheduleRange);
        delay = 300;
      } else if (boardMode === "paged") {
        if (bp < pages) {
          next = boardPagedParams(bp + 1, hideCompleted);
          delay = boardMs;
        } else if (includeSchedule) {
          next = scheduleParams(scheduleRange);
          delay = boardMs;
        } else {
          next = boardPagedParams(1, hideCompleted); // 보드만: 페이지 순환.
          delay = boardMs;
        }
      } else {
        // boardMode=all: 단일 화면.
        if (includeSchedule) {
          next = scheduleParams(scheduleRange);
          delay = boardMs;
        } else {
          return; // 보드만 + 전체: 정적 유지(순회할 페이지 없음).
        }
      }
    }

    if (!next) return;
    const target = next;
    timerRef.current = setTimeout(() => {
      router.push(`?${target.toString()}`, { scroll: false });
    }, delay);

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [
    playing,
    view,
    bp,
    pages,
    hideCompleted,
    boardSeconds,
    scheduleSeconds,
    scheduleRange,
    boardMode,
    includeBoard,
    includeSchedule,
    router,
  ]);

  const toggle = () => {
    if (playing) {
      // 정지: play·bp 제거(현재 뷰는 유지). 타이머는 재-arm effect가 정리한다.
      const params = new URLSearchParams(searchParams.toString());
      params.delete("play");
      params.delete("bp");
      router.push(`?${params.toString()}`, { scroll: false });
      return;
    }
    // 재생 시작: 포함된 첫 스텝으로 진입.
    const start = startParams(settings, hideCompleted);
    if (!start) return; // 둘 다 해제: 무동작.
    router.push(`?${start.toString()}`, { scroll: false });
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
        // 재생 중엔 반투명(0.5)으로 물러난다 — TV 상시 표시에서 화면을 가리지 않게(2026-07-11).
        "absolute bottom-8 left-8 flex size-16 items-center justify-center rounded-full text-white shadow-lg transition-[background-color,opacity]",
        playing
          ? "bg-green-600 opacity-50 hover:bg-green-500 hover:opacity-100"
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

/** 재생 시작 스텝: 보드 포함이면 보드, 아니면 스케줄. 둘 다 없으면 null. */
function startParams(
  settings: ViewSettings,
  hideCompleted: boolean,
): URLSearchParams | null {
  if (settings.includeBoard) {
    return settings.boardMode === "all"
      ? boardAllParams(hideCompleted)
      : boardPagedParams(1, hideCompleted);
  }
  if (settings.includeSchedule) {
    return scheduleParams(settings.scheduleRange);
  }
  return null;
}
