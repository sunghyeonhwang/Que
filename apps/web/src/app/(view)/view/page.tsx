import type { Metadata } from "next";
import { format } from "date-fns";
import {
  getViewBoard,
  getViewSchedule,
  type ViewBoard,
  type ViewScheduleRange,
  type ViewWeek,
} from "@/lib/view-data";
import { ViewHeader } from "@/components/view/view-header";
import { ViewAutoRefresh } from "@/components/view/view-auto-refresh";
import { BoardGrid } from "@/components/view/board-grid";
import { WeekGrid } from "@/components/view/week-grid";
import { ViewFab } from "@/components/view/view-fab";

// 공개 읽기전용 현황판 페이지(서버 컴포넌트).
// proxy가 view 호스트의 모든 경로를 여기로 rewrite한다. 인증 없음(조회 전용).
// searchParams 계약:
// - view=board|week (기본 board)
// - date=yyyy-MM-dd — board 모드=기준일, week 모드=스케줄 앵커일 (기본 오늘). 두 모드 공용.
// - range=week|3day — week 모드에서만 유효. 기본 week(월~금 5칸). 3day=앵커일 포함 연속 3칸.
//   prev/next 이동 폭: week=7일, 3day=3일 (frontend가 URL로 계산).
// - hc=1 — 완료 숨김(board 모드).
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
  searchParams: Promise<{ view?: string; date?: string; range?: string; hc?: string }>;
}) {
  const params = await searchParams;
  const mode: Mode = params.view === "week" ? "week" : "board";
  const scheduleRange: ViewScheduleRange = params.range === "3day" ? "3day" : "week";
  const hideCompleted = params.hc === "1";
  const now = new Date();
  const todayISO = format(now, "yyyy-MM-dd");

  const temperature = await getTemperature();

  let board: ViewBoard | undefined;
  let week: ViewWeek | undefined;
  let boardDate = now;

  if (mode === "week") {
    // date=앵커일(기본 오늘). getViewSchedule이 week면 월요일 정규화, 3day면 앵커부터.
    week = await getViewSchedule(parseDate(params.date, now), scheduleRange);
  } else {
    boardDate = parseDate(params.date, now);
    board = await getViewBoard(boardDate);
  }

  // FAB 전환 링크(현재 컨텍스트 보존). 상대 쿼리로 뷰 호스트 pathname 유지.
  // board→week: 보고 있던 날짜를 앵커로 넘긴다(range는 기본 week).
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
    <div className="relative flex min-h-0 flex-1 flex-col">
      <ViewAutoRefresh intervalMs={600_000} />
      <ViewHeader
        mode={mode}
        now={now}
        temperature={temperature}
        boardDate={mode === "board" ? boardDate : undefined}
        todayISO={todayISO}
        hideCompleted={hideCompleted}
        weekAnchorISO={mode === "week" && week ? week.weekStartISO : undefined}
        weekRange={mode === "week" && week ? week.range : undefined}
      />

      {mode === "board" && board ? (
        <BoardGrid board={board} hideCompleted={hideCompleted} />
      ) : null}
      {mode === "week" && week ? <WeekGrid week={week} /> : null}

      <ViewFab to={fab.to} href={fab.href} />
    </div>
  );
}
