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

/** 마일스톤 스트립 스텝 URL. */
function milestoneParams(): URLSearchParams {
  const p = new URLSearchParams();
  p.set("view", "milestones");
  p.set("play", "1");
  return p;
}

/** 위험 보드(문제·홀드) 스텝 URL. */
function riskParams(): URLSearchParams {
  const p = new URLSearchParams();
  p.set("view", "risk");
  p.set("play", "1");
  return p;
}

/** 순회 스톱 종류(설정에서 활성화된 페이지들). 순서 고정: 보드→스케줄→마일스톤→위험. */
type StopKind = "board" | "schedule" | "milestones" | "risk";

export function SlideshowController({ boardPages }: { boardPages: number }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const settings = useViewSettings();

  const pages = Math.max(1, boardPages);
  const playing = searchParams.get("play") === "1";
  const rawView = searchParams.get("view");
  const current: StopKind =
    rawView === "week"
      ? "schedule"
      : rawView === "milestones"
        ? "milestones"
        : rawView === "risk"
          ? "risk"
          : "board";
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
    includeMilestones,
    includeRisk,
  } = settings;

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    // 재-arm: 이전 타이머를 항상 정리하고(파라미터/설정 변화·언마운트) 재계산한다.
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    if (!playing) return;

    const boardMs = boardSeconds * 1000;
    const scheduleMs = scheduleSeconds * 1000;

    // 활성화된 순회 스톱을 고정 순서로 만든다.
    const stops: StopKind[] = [];
    if (includeBoard) stops.push("board");
    if (includeSchedule) stops.push("schedule");
    if (includeMilestones) stops.push("milestones");
    if (includeRisk) stops.push("risk");
    if (stops.length === 0) return; // 방어: 순회 대상 없음 → 무동작.

    // 각 스톱 진입 URL.
    const enterStop = (kind: StopKind): URLSearchParams => {
      switch (kind) {
        case "board":
          return boardMode === "all"
            ? boardAllParams(hideCompleted)
            : boardPagedParams(1, hideCompleted);
        case "schedule":
          return scheduleParams(scheduleRange);
        case "milestones":
          return milestoneParams();
        case "risk":
          return riskParams();
      }
    };
    // 현재 스톱을 얼마나 보여준 뒤 넘어갈지(표시 시간). 단일 정보 페이지는 보드 시간 재사용.
    const durationOf = (kind: StopKind): number =>
      kind === "schedule" ? scheduleMs : boardMs;

    let next: URLSearchParams | null = null;
    let delay = 0;

    if (
      current === "board" &&
      includeBoard &&
      boardMode === "paged" &&
      bp < pages
    ) {
      // 보드(2명/페이지) 하위 페이지 순회.
      next = boardPagedParams(bp + 1, hideCompleted);
      delay = boardMs;
    } else {
      const idx = stops.indexOf(current);
      if (idx === -1) {
        // 현재 뷰가 비활성(설정에서 방금 꺼짐 등) → 첫 활성 스톱으로 빠르게 이동.
        next = enterStop(stops[0]);
        delay = 300;
      } else if (stops.length === 1) {
        // 단일 스톱: 보드·paged면 페이지 순환, 그 외(보드-all·스케줄·마일스톤·위험)는 정적 유지.
        if (current === "board" && boardMode === "paged") {
          next = boardPagedParams(1, hideCompleted);
          delay = boardMs;
        } else {
          return; // 타이머 없음(정적 단일 페이지).
        }
      } else {
        // 다음 스톱으로 순환.
        next = enterStop(stops[(idx + 1) % stops.length]);
        delay = durationOf(current);
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
    current,
    bp,
    pages,
    hideCompleted,
    boardSeconds,
    scheduleSeconds,
    scheduleRange,
    boardMode,
    includeBoard,
    includeSchedule,
    includeMilestones,
    includeRisk,
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

/** 재생 시작 스텝: 활성화된 첫 스톱(보드→스케줄→마일스톤→위험). 전부 없으면 null. */
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
  if (settings.includeMilestones) {
    return milestoneParams();
  }
  if (settings.includeRisk) {
    return riskParams();
  }
  return null;
}
