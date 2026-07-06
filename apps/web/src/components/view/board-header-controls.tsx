"use client";

import { addDays, format, parseISO } from "date-fns";
import { useBoardView } from "./board-view-context";
import { HideCompletedToggle } from "./hide-completed-toggle";
import { SegLink, DateNav, dayLabel } from "./view-nav";

// 보드 모드 상단 컨트롤 묶음(클라이언트 경계).
// 급소: 세그먼트([전체][2명])·날짜이동 Link의 href에 담기는 hc는 서버 렌더 시점 prop이 아니라
//   useBoardView()의 "라이브 hc"여야 한다. HideCompletedToggle이 replaceState로 hc만 바꾼 뒤
//   이 Link를 누르면 옛 hc로 이동해 URL의 hc가 어긋나던 버그를 막는다(하드 리로드에도 hc 유지).
// - HideCompletedToggle 자체는 이미 context를 쓰므로 무변경 재사용.
// - SegLink/DateNav/dayLabel은 view-nav(universal)에서 재사용.

type BoardMode = "all" | "paged";

/** 보드 상대 쿼리 링크. bmode·hc를 항상 보존한다(벽 디스플레이 새로고침 유지). */
function boardHref(dateISO: string, mode: BoardMode, hideCompleted: boolean): string {
  const hc = hideCompleted ? "&hc=1" : "";
  return `?view=board&date=${dateISO}&bmode=${mode}${hc}`;
}

function BoardModeToggle({
  mode,
  boardISO,
  hideCompleted,
}: {
  mode: BoardMode;
  boardISO: string;
  hideCompleted: boolean;
}) {
  return (
    <div className="flex items-center gap-1 rounded-full border border-neutral-200 p-1">
      <SegLink href={boardHref(boardISO, "all", hideCompleted)} active={mode === "all"}>
        전체
      </SegLink>
      <SegLink href={boardHref(boardISO, "paged", hideCompleted)} active={mode === "paged"}>
        2명
      </SegLink>
    </div>
  );
}

export function BoardHeaderControls({
  boardISO,
  boardMode,
  todayISO,
  boardDate,
}: {
  /** 현재 보고 있는 기준일 ISO(yyyy-MM-dd). */
  boardISO: string;
  boardMode: BoardMode;
  todayISO: string;
  /** 라벨용 기준일. */
  boardDate: Date;
}) {
  // 라이브 hc: 토글 직후에도 Link href가 현재 hc를 담게 한다(서버 prop 대신 context).
  const { hideCompleted } = useBoardView();
  const anchor = parseISO(boardISO);

  return (
    <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
      <BoardModeToggle mode={boardMode} boardISO={boardISO} hideCompleted={hideCompleted} />
      <HideCompletedToggle />
      <DateNav
        label={dayLabel(boardDate)}
        prevHref={boardHref(format(addDays(anchor, -1), "yyyy-MM-dd"), boardMode, hideCompleted)}
        todayHref={boardHref(todayISO, boardMode, hideCompleted)}
        nextHref={boardHref(format(addDays(anchor, 1), "yyyy-MM-dd"), boardMode, hideCompleted)}
      />
    </div>
  );
}
