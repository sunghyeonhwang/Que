import Link from "next/link";
import { format } from "date-fns";
import { ko } from "date-fns/locale";
import { PageHeader } from "@/components/app/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { getHeatmapData } from "@/lib/heatmap-data";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

// 강도별 배경 — 색상만으로 구분하지 않도록 셀 안에 시간 수치를 함께 표기한다
const INTENSITY_BG = [
  "bg-transparent",
  "bg-foreground/10",
  "bg-foreground/25",
  "bg-foreground/45",
  "bg-foreground/70 text-background",
];

export default async function HeatmapPage() {
  const data = getHeatmapData();

  return (
    <div>
      <PageHeader
        title="히트맵"
        subtitle="멤버별 작업량 편차 — 평가가 아니라 업무 배분과 병목 조정용입니다"
      />

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,24rem)]">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">멤버 × 날짜 작업량 (예상 시간 + 문제/홀드/마감 가중)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <div
                role="grid"
                aria-label="작업량 히트맵"
                className="grid min-w-[620px]"
                style={{ gridTemplateColumns: `6rem repeat(${data.days.length}, minmax(0,1fr))` }}
              >
                <div />
                {data.days.map((date) => (
                  <div key={date} className="px-1 py-1 text-center text-xs text-muted-foreground">
                    {format(new Date(`${date}T00:00:00`), "M/d (EEE)", { locale: ko })}
                  </div>
                ))}
                {data.rows.map(({ user, cells }) => (
                  <HeatRowView key={user.id} user={user} cells={cells} />
                ))}
              </div>
            </div>
            <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
              강도:
              {INTENSITY_BG.map((bg, i) => (
                <span key={i} className="flex items-center gap-1">
                  <span className={cn("size-4 rounded-sm border", bg)} aria-hidden />
                  {i === 0 ? "없음" : i === 4 ? "과부하" : i}
                </span>
              ))}
              <span className="ml-2">셀 숫자는 예상 시간(h) — 셀을 누르면 해당 날짜의 전체 멤버 캘린더로 이동</span>
            </div>
          </CardContent>
        </Card>

        <div className="flex flex-col gap-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">멤버별 총 작업량 (7일)</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-2">
              {data.rows.map(({ user, totalScore, totalHours, issueOrHold }) => (
                <div key={user.id} className="flex items-center gap-2">
                  <span className="w-16 shrink-0 text-sm">{user.name}</span>
                  <Progress value={(totalScore / data.maxTotal) * 100} className="h-2 flex-1" />
                  <span className="w-24 shrink-0 text-right text-xs tabular-nums text-muted-foreground">
                    {totalHours}h{issueOrHold > 0 ? ` · 병목 ${issueOrHold}` : ""}
                  </span>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">배분 요약</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-2 text-sm">
              <p>
                <span className="font-medium">과부하:</span>{" "}
                {data.overloaded.length ? data.overloaded.join(", ") : "없음"}
              </p>
              <p>
                <span className="font-medium">여유:</span>{" "}
                {data.relaxed.length ? data.relaxed.join(", ") : "없음"}
              </p>
              <p className="text-xs text-muted-foreground">
                과부하 멤버의 작업을 여유 멤버에게 재배분하거나 마감을 조정하세요. 문제/홀드
                작업은 가중치 2/1로 반영됩니다.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function HeatRowView({
  user,
  cells,
}: {
  user: { id: string; name: string; avatarColor: string };
  cells: { date: string; hours: number; taskCount: number; intensity: number }[];
}) {
  return (
    <>
      <div className="flex items-center gap-2 px-1 py-1 text-sm">
        <span
          className="size-2.5 shrink-0 rounded-full"
          style={{ backgroundColor: user.avatarColor }}
          aria-hidden
        />
        <span className="truncate">{user.name}</span>
      </div>
      {cells.map((cell) => (
        <Link
          key={cell.date}
          href={`/calendar?view=members&date=${cell.date}`}
          aria-label={`${user.name} ${cell.date} 작업 ${cell.taskCount}건 ${cell.hours}시간`}
          className={cn(
            "m-0.5 flex min-h-10 items-center justify-center rounded-sm border text-xs tabular-nums transition-transform hover:scale-[1.03]",
            INTENSITY_BG[cell.intensity],
          )}
        >
          {cell.hours > 0 ? `${cell.hours}h` : ""}
        </Link>
      ))}
    </>
  );
}
