import type { Metadata } from "next";
import { format } from "date-fns";
import {
  getViewBoard,
  getViewDay,
  getViewMilestoneStrip,
  getViewNextDayPreview,
  getViewRiskBoard,
  getViewSchedule,
  getViewSignals,
  getViewStandupStrip,
  shouldShowNextDayPreview,
  type ViewBoard,
  type ViewDay,
  type ViewMilestoneStripItem,
  type ViewNextDayPreview as ViewNextDayPreviewData,
  type ViewRiskItem,
  type ViewWeek,
} from "@/lib/view-data";
import { ViewHeader } from "@/components/view/view-header";
import { BoardViewProvider } from "@/components/view/board-view-context";
import { ViewAutoRefresh } from "@/components/view/view-auto-refresh";
import { BoardGrid } from "@/components/view/board-grid";
import { WeekGrid } from "@/components/view/week-grid";
import { DayGrid } from "@/components/view/day-grid";
import { ViewFab } from "@/components/view/view-fab";
import { ViewStandupStrip } from "@/components/view/view-standup-strip";
import { ViewNextDayPreview } from "@/components/view/view-next-day-preview";
import { MilestoneStripGrid } from "@/components/view/milestone-strip-grid";
import { RiskBoardGrid } from "@/components/view/risk-board-grid";

// 공개 읽기전용 현황판 페이지(서버 컴포넌트).
// proxy가 view 호스트의 모든 경로를 여기로 rewrite한다. 인증 없음(조회 전용).
// searchParams 계약:
// - view=board|week|milestones|risk (기본 board)
//   · milestones=슬라이드쇼 마일스톤 스트립 페이지, risk=슬라이드쇼 위험 보드(문제·홀드) 페이지.
//     둘 다 슬라이드쇼(play=1) 순회 전용 페이지다(고정 date/range 없음, 헤더 컨트롤 미표시).
// - date=yyyy-MM-dd — board 모드=기준일, week 모드=스케줄 앵커일 (기본 오늘). 두 모드 공용.
// - range=3day|1day — week 모드에서만 유효. 기본 3day(앵커일 포함 연속 3칸).
//   1day=앵커일 하루를 "팀원(전원)을 열"로 보여준다(날짜 열이 아니라 사람 열).
//   prev/next 이동 폭: 3day=3일, 1day=1일 (frontend가 URL로 계산).
// - hc=1 — 완료 숨김(board 모드).
// - bmode=all|paged — board 모드 레이아웃. all=8명 한 화면(기본), paged=2명/페이지(자동순환).
// 외부 fetch는 open-meteo 기온 하나뿐(공개·무인증). 데이터는 view-data(loadReadOnlyDb)에서만 온다.
//
// 헤더 신호 티커·오전 스탠드업 스트립·다음 영업일 미리보기의 시간대 판정은 전부 서버(now, KST)에서
// 계산한다(클라 시계 의존 금지). 10분 auto-refresh(RSC 갱신)로 시간대가 자연 반영된다.

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

type Mode = "board" | "week" | "milestones" | "risk";

function parseDate(value: string | undefined, fallback: Date): Date {
  if (!value) return fallback;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!m) return fallback;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return Number.isNaN(d.getTime()) ? fallback : d;
}

/** 서울 현재 기온(°C). 실패 시 undefined(화면 필수 아님). */
async function getTemperature(): Promise<number | undefined> {
  try {
    const res = await fetch(
      "https://api.open-meteo.com/v1/forecast?latitude=37.5665&longitude=126.978&current=temperature_2m",
      { next: { revalidate: 600 } },
    );
    if (!res.ok) return undefined;
    const data = (await res.json()) as { current?: { temperature_2m?: number } };
    const t = data.current?.temperature_2m;
    return typeof t === "number" ? t : undefined;
  } catch {
    return undefined;
  }
}

export default async function ViewPage({
  searchParams,
}: {
  searchParams: Promise<{
    view?: string;
    date?: string;
    range?: string;
    hc?: string;
    bmode?: string;
    // 슬라이드쇼(자동 순회) 상태. SlideshowController가 주도. bp=1-based 페이지.
    play?: string;
    bp?: string;
  }>;
}) {
  const params = await searchParams;
  const mode: Mode =
    params.view === "week"
      ? "week"
      : params.view === "milestones"
        ? "milestones"
        : params.view === "risk"
          ? "risk"
          : "board";
  // week 모드의 서브 range. 1day는 사람 열(ViewDay), 3day는 날짜 열(ViewWeek). 기본 3day.
  const rangeParam: "3day" | "1day" =
    params.range === "1day" ? "1day" : "3day";
  const hideCompleted = params.hc === "1";
  // board 모드: 전체(8명 한 화면)/2명 페이지. 기본 all(한눈에 8명 우선).
  const boardMode: "all" | "paged" = params.bmode === "paged" ? "paged" : "all";
  // 슬라이드쇼 주도 페이징: play=1 또는 bp 지정 시 board가 해당 페이지를 고정 표시하고 자체 15초 순환을 끈다.
  const isPlaying = params.play === "1";
  const bpParsed = Number(params.bp);
  const boardPage =
    Number.isFinite(bpParsed) && bpParsed >= 1 ? Math.floor(bpParsed) : undefined;
  const now = new Date();
  const todayISO = format(now, "yyyy-MM-dd");

  // 헤더 티커·오전 스탠드업 스트립은 모든 모드에서 공용(시간대 판정은 서버 now/KST).
  const [temperature, signals, standupStrip] = await Promise.all([
    getTemperature(),
    getViewSignals(now),
    getViewStandupStrip(now),
  ]);

  let board: ViewBoard | undefined;
  let week: ViewWeek | undefined;
  let day: ViewDay | undefined;
  let milestoneItems: ViewMilestoneStripItem[] | undefined;
  let riskItems: ViewRiskItem[] | undefined;
  let preview: ViewNextDayPreviewData | undefined;
  let boardDate = now;

  if (mode === "week") {
    if (rangeParam === "1day") {
      // 1day=사람 열. date=앵커일(기본 오늘). prev/next는 ±1일(frontend가 URL 계산).
      day = await getViewDay(parseDate(params.date, now));
    } else {
      // date=앵커일(기본 오늘). getViewSchedule이 앵커일부터 3칸.
      week = await getViewSchedule(parseDate(params.date, now));
    }
  } else if (mode === "milestones") {
    milestoneItems = await getViewMilestoneStrip(now);
  } else if (mode === "risk") {
    riskItems = await getViewRiskBoard();
  } else {
    boardDate = parseDate(params.date, now);
    board = await getViewBoard(boardDate);
    // 다음 영업일 미리보기 표시 조건: 주말 · 18시 이후 · 오늘 전원 일정 0건.
    const totalBoardCards = board.columns.reduce((n, c) => n + c.totalCount, 0);
    if (shouldShowNextDayPreview(now, totalBoardCards)) {
      preview = await getViewNextDayPreview(now);
    }
  }

  // FAB 전환 링크(현재 컨텍스트 보존). 상대 쿼리로 뷰 호스트 pathname 유지.
  // board→week: 보고 있던 날짜를 앵커로 넘긴다(range는 기본 3day). 그 외 모드→board 복귀.
  const fab =
    mode === "board"
      ? {
          to: "week" as const,
          href: `?view=week&date=${format(boardDate, "yyyy-MM-dd")}`,
        }
      : {
          to: "board" as const,
          href: `?view=board&date=${format(now, "yyyy-MM-dd")}`,
        };

  // 슬라이드쇼 전용 페이지(milestones/risk)는 날짜/범위 컨트롤이 없는 헤더로 렌더한다.
  const headerMode: "board" | "week" = mode === "week" ? "week" : "board";

  return (
    <BoardViewProvider initialHideCompleted={hideCompleted}>
      <div className="relative flex min-h-0 flex-1 flex-col">
        <ViewAutoRefresh intervalMs={600_000} />
        <ViewHeader
          mode={headerMode}
          now={now}
          temperature={temperature}
          signals={signals}
          boardDate={mode === "board" ? boardDate : undefined}
          boardMode={boardMode}
          todayISO={todayISO}
          weekRange={mode === "week" ? rangeParam : undefined}
          weekAnchorISO={
            mode === "week"
              ? // 이동/라벨 기준 앵커. 1day=사람 열(day.dateISO), 3day=날짜 열(week.weekStartISO).
                rangeParam === "1day"
                ? day?.dateISO
                : week?.weekStartISO
              : undefined
          }
        />

        {/* 오전 스탠드업 스트립(영업일 09:30~11:30에만 데이터 존재). 헤더 바로 아래. */}
        {standupStrip ? <ViewStandupStrip strip={standupStrip} /> : null}

        {mode === "board" && board ? (
          preview ? (
            // 빈 보드/야간/주말: 보드 대신 다음 영업일 미리보기 중앙 패널.
            <ViewNextDayPreview preview={preview} />
          ) : (
            <BoardGrid
              board={board}
              mode={boardMode}
              play={isPlaying}
              bp={boardPage}
            />
          )
        ) : null}
        {mode === "week" && week ? <WeekGrid week={week} /> : null}
        {mode === "week" && day ? <DayGrid day={day} /> : null}
        {mode === "milestones" && milestoneItems ? (
          <MilestoneStripGrid items={milestoneItems} />
        ) : null}
        {mode === "risk" && riskItems ? <RiskBoardGrid items={riskItems} /> : null}

        <ViewFab to={fab.to} href={fab.href} />
      </div>
    </BoardViewProvider>
  );
}
