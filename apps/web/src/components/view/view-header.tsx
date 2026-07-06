import { addDays, format, parseISO } from "date-fns";
import { cn } from "@/lib/utils";
import { ViewClock } from "./view-clock";
import { BoardHeaderControls } from "./board-header-controls";
import { SegLink, DateNav, rangeLabel, type WeekRange } from "./view-nav";
import {
  formatKoreanDate,
  formatKoreanWeekday,
  scale,
} from "./view-format";

// 현황판 상단 바(모든 뷰 공통, 서버 컴포넌트).
// 좌: 오늘 날짜 · 요일 · 라이브 시계 · 기온(벽시계용 '오늘' 실시간).
// 우: 뷰 스위처 + 완료 숨김(보드) + "지금 보고 있는 날짜" 라벨 + 날짜이동(‹ 이전 · Today · 다음 ›).
//     날짜이동은 board·스케줄 모두 이 상단 헤더에 통일 배치한다(하단 WeekNav 제거).
//
// 급소(item 1): 보고 있는 날짜 라벨을 상단에 노출한다.
//   기존엔 좌측이 항상 '오늘'만 보여줘, board에서 이전/다음을 눌러 date 쿼리가 바뀌어도
//   화면상 날짜 피드백이 없어 "이동이 안 된다"고 오인됐다(링크·파라미터 자체는 정상).
//   이동 폭: board=±1일, 3day=±3, 1day=±1. 전부 상대 쿼리 Link(proxy pathname 보존).
//
// board 모드 컨트롤은 BoardHeaderControls(클라)로 분리 — hc(완료 숨김) Link href를
//   context의 "라이브 hc"로 빌드해 토글 후에도 URL hc가 정합하도록 한다.

type BoardMode = "all" | "paged";

interface ViewHeaderProps {
  mode: "board" | "week";
  now: Date;
  temperature?: number;
  todayISO: string;
  /** 보드 모드: 현재 보고 있는 기준일. */
  boardDate?: Date;
  /** 보드 모드: 전체(8명)/2명 페이지 토글 상태. */
  boardMode?: BoardMode;
  /** 주간 모드: 현재 범위(3day=날짜 열, 1day=사람 열). */
  weekRange?: WeekRange;
  /** 주간 모드: prev/next/today·범위 라벨 계산의 기준 앵커일 ISO. */
  weekAnchorISO?: string;
}

export function ViewHeader({
  mode,
  now,
  temperature,
  todayISO,
  boardDate,
  boardMode = "all",
  weekRange,
  weekAnchorISO,
}: ViewHeaderProps) {
  return (
    <header
      className={cn(
        // 좁은 폭(예: 768)에서 컨트롤이 잘리지 않게 wrap. view는 가로 디스플레이 전용이라 보조용.
        "flex shrink-0 flex-wrap items-center justify-between gap-x-6 gap-y-3 border-b border-neutral-200",
        scale("px-8", "px-12", "px-16", "px-24"),
        scale("py-5", "py-6", "py-8", "py-10"),
      )}
    >
      <div
        className={cn(
          "flex items-center gap-3 font-medium text-neutral-800",
          scale("text-xl", "text-2xl", "text-3xl", "text-4xl"),
        )}
      >
        <span>{formatKoreanDate(now)}</span>
        <Dot />
        <span>{formatKoreanWeekday(now)}</span>
        <Dot />
        <ViewClock />
        {temperature !== undefined ? (
          <>
            <Dot />
            <span className="font-semibold">{Math.round(temperature)}°</span>
          </>
        ) : null}
      </div>

      {mode === "board" && boardDate ? (
        <BoardHeaderControls
          boardISO={format(boardDate, "yyyy-MM-dd")}
          boardMode={boardMode}
          todayISO={todayISO}
          boardDate={boardDate}
        />
      ) : null}

      {mode === "week" && weekRange && weekAnchorISO ? (
        <WeekModeControls
          range={weekRange}
          anchorISO={weekAnchorISO}
          todayISO={todayISO}
        />
      ) : null}
    </header>
  );
}

// ---------- 주간 모드: [1Day][3day] 토글 + 날짜이동 ----------

function WeekModeControls({
  range,
  anchorISO,
  todayISO,
}: {
  range: WeekRange;
  anchorISO: string;
  todayISO: string;
}) {
  // 범위 전환은 앵커일을 유지한다(1day↔3day 왕복 시 보던 날짜 보존).
  const step = range === "3day" ? 3 : 1;
  const anchor = parseISO(anchorISO);
  const prevISO = format(addDays(anchor, -step), "yyyy-MM-dd");
  const nextISO = format(addDays(anchor, step), "yyyy-MM-dd");

  return (
    <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
      <div className="flex items-center gap-1 rounded-full border border-neutral-200 p-1">
        <SegLink href={`?view=week&range=1day&date=${anchorISO}`} active={range === "1day"}>
          1Day
        </SegLink>
        <SegLink href={`?view=week&range=3day&date=${anchorISO}`} active={range === "3day"}>
          3day
        </SegLink>
      </div>
      <DateNav
        label={rangeLabel(anchor, range)}
        prevHref={`?view=week&range=${range}&date=${prevISO}`}
        todayHref={`?view=week&range=${range}&date=${todayISO}`}
        nextHref={`?view=week&range=${range}&date=${nextISO}`}
      />
    </div>
  );
}

function Dot() {
  return <span className="text-neutral-300">·</span>;
}
