import type { Metadata } from "next";
import { format, startOfWeek } from "date-fns";
import { getViewBoard, getViewWeek, type ViewBoard, type ViewWeek } from "@/lib/view-data";
import { ViewHeader } from "@/components/view/view-header";
import { ViewAutoRefresh } from "@/components/view/view-auto-refresh";
import { BoardGrid } from "@/components/view/board-grid";
import { WeekGrid } from "@/components/view/week-grid";
import { ViewFab } from "@/components/view/view-fab";

// 공개 읽기전용 현황판 페이지(서버 컴포넌트).
// proxy가 view 호스트의 모든 경로를 여기로 rewrite한다. 인증 없음(조회 전용).
// searchParams: view=board|week(기본 board) · date=yyyy-MM-dd(board 기준일) · week=yyyy-MM-dd(주 시작) · hc=1(완료 숨김).
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
  searchParams: Promise<{ view?: string; date?: string; week?: string; hc?: string }>;
}) {
  const params = await searchParams;
  const mode: Mode = params.view === "week" ? "week" : "board";
  const hideCompleted = params.hc === "1";
  const now = new Date();
  const todayISO = format(now, "yyyy-MM-dd");

  const temperature = await getTemperature();

  let board: ViewBoard | undefined;
  let week: ViewWeek | undefined;
  let boardDate = now;

  if (mode === "week") {
    week = await getViewWeek(parseDate(params.week, now));
  } else {
    boardDate = parseDate(params.date, now);
    board = await getViewBoard(boardDate);
  }

  // FAB 전환 링크(현재 컨텍스트 보존). 상대 쿼리로 뷰 호스트 pathname 유지.
  const fab =
    mode === "board"
      ? {
          to: "week" as const,
          href: `?view=week&week=${format(startOfWeek(boardDate, { weekStartsOn: 1 }), "yyyy-MM-dd")}`,
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
      />

      {mode === "board" && board ? (
        <BoardGrid board={board} hideCompleted={hideCompleted} />
      ) : null}
      {mode === "week" && week ? <WeekGrid week={week} /> : null}

      <ViewFab to={fab.to} href={fab.href} />
    </div>
  );
}
