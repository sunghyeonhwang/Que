import type { Metadata } from "next";
import { format } from "date-fns";
import {
  getViewBoard,
  getViewDay,
  getViewSchedule,
  type ViewBoard,
  type ViewDay,
  type ViewWeek,
} from "@/lib/view-data";
import { ViewHeader } from "@/components/view/view-header";
import { BoardViewProvider } from "@/components/view/board-view-context";
import { ViewAutoRefresh } from "@/components/view/view-auto-refresh";
import { BoardGrid } from "@/components/view/board-grid";
import { WeekGrid } from "@/components/view/week-grid";
import { DayGrid } from "@/components/view/day-grid";
import { ViewFab } from "@/components/view/view-fab";

// 공개 읽기전용 현황판 페이지(서버 컴포넌트).
// proxy가 view 호스트의 모든 경로를 여기로 rewrite한다. 인증 없음(조회 전용).
// searchParams 계약:
// - view=board|week (기본 board)
// - date=yyyy-MM-dd — board 모드=기준일, week 모드=스케줄 앵커일 (기본 오늘). 두 모드 공용.
// - range=3day|1day — week 모드에서만 유효. 기본 3day(앵커일 포함 연속 3칸).
//   1day=앵커일 하루를 "팀원(전원)을 열"로 보여준다(날짜 열이 아니라 사람 열).
//   prev/next 이동 폭: 3day=3일, 1day=1일 (frontend가 URL로 계산).
// - hc=1 — 완료 숨김(board 모드).
// - bmode=all|paged — board 모드 레이아웃. all=8명 한 화면(기본), paged=2명/페이지(자동순환).
// 외부 fetch는 open-meteo 기온 하나뿐(공개·무인증). 데이터는 view-data(loadReadOnlyDb)에서만 온다.

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

type Mode = "board" | "week";

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
  const mode: Mode = params.view === "week" ? "week" : "board";
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

  const temperature = await getTemperature();

  let board: ViewBoard | undefined;
  let week: ViewWeek | undefined;
  let day: ViewDay | undefined;
  let boardDate = now;

  if (mode === "week") {
    if (rangeParam === "1day") {
      // 1day=사람 열. date=앵커일(기본 오늘). prev/next는 ±1일(frontend가 URL 계산).
      day = await getViewDay(parseDate(params.date, now));
    } else {
      // date=앵커일(기본 오늘). getViewSchedule이 앵커일부터 3칸.
      week = await getViewSchedule(parseDate(params.date, now));
    }
  } else {
    boardDate = parseDate(params.date, now);
    board = await getViewBoard(boardDate);
  }

  // FAB 전환 링크(현재 컨텍스트 보존). 상대 쿼리로 뷰 호스트 pathname 유지.
  // board→week: 보고 있던 날짜를 앵커로 넘긴다(range는 기본 3day).
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

  return (
    <BoardViewProvider initialHideCompleted={hideCompleted}>
      <div className="relative flex min-h-0 flex-1 flex-col">
        <ViewAutoRefresh intervalMs={600_000} />
        <ViewHeader
          mode={mode}
          now={now}
          temperature={temperature}
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

        {mode === "board" && board ? (
          <BoardGrid
            board={board}
            mode={boardMode}
            play={isPlaying}
            bp={boardPage}
          />
        ) : null}
        {mode === "week" && week ? <WeekGrid week={week} /> : null}
        {mode === "week" && day ? <DayGrid day={day} /> : null}

        <ViewFab to={fab.to} href={fab.href} />
      </div>
    </BoardViewProvider>
  );
}
