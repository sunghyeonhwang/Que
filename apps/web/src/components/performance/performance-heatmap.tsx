import { format } from "date-fns";
import { ko } from "date-fns/locale";
import Link from "next/link";
import type { HeatmapData } from "@/lib/heatmap-data";
import { ScrollAffordance } from "@/components/performance/scroll-affordance";
import { cn } from "@/lib/utils";

// 초록 강도 5단계(0~4) + 수치 병기 — 색 단독 구분을 피한다(접근성).
// 팔레트는 globals.css의 --heat-* 토큰(테마 대응: 라이트=파스텔, 다크=진초록)을 참조한다.
const GREEN = [
  { bg: "bg-[var(--que-bg)]", fg: "text-transparent", label: "없음" },
  { bg: "bg-[var(--heat-1-bg)]", fg: "text-[var(--heat-1-fg)]", label: "낮음" },
  { bg: "bg-[var(--heat-2-bg)]", fg: "text-[var(--heat-2-fg)]", label: "" },
  { bg: "bg-[var(--heat-3-bg)]", fg: "text-[var(--heat-3-fg)]", label: "" },
  { bg: "bg-[var(--heat-4-bg)]", fg: "text-[var(--heat-4-fg)]", label: "높음" },
];

/** 히트맵(멤버×일) — 초록 강도 그리드 + 범례. heatmap-data 재사용.
 *  "누가 얼마나 몰렸나"는 별도 업무 부하 표(WorkloadTable)가 담당한다 — 여기선 "언제/어디에
 *  몰렸나"만 보여준다. 셀 클릭 시 그 날짜의 일정(일 뷰)으로 이동한다. */
export function PerformanceHeatmap({ data }: { data: HeatmapData }) {
  return (
    <div className="flex flex-col gap-4">
      <ScrollAffordance>
        <div
          role="grid"
          aria-label="멤버별 일자별 작업량 히트맵"
          className="grid"
          style={{
            // 셀이 링크(터치 대상)라 컬럼 최소폭 2.75rem(44px) 보장 — m-0.5(4px) 제외 실 터치 40px.
            // 월 그리드(N≈31)는 좁은 태블릿에서 가로 스크롤(overflow-x-auto)로 흘린다.
            gridTemplateColumns: `5rem repeat(${data.days.length}, minmax(2.75rem,1fr))`,
            minWidth: `${5 + data.days.length * 2.75}rem`,
          }}
        >
          {/* 교차 코너(이름 헤더) — 가로·세로 동시 sticky, 가장 높은 z (RPT-4) */}
          <div className="sticky left-0 top-0 z-30 bg-[var(--que-bg)]" />
          {data.days.map((date) => (
            <div
              key={date}
              className="sticky top-0 z-20 bg-[var(--que-bg)] px-1 pb-1 text-center text-xs text-[var(--que-text-tertiary)]"
            >
              {format(new Date(`${date}T00:00:00`), "M/d", { locale: ko })}
            </div>
          ))}
          {data.rows.map(({ user, cells }) => (
            <div key={user.id} className="contents">
              {/* 이름 컬럼 — 가로 스크롤 시 좌측 고정 (RPT-4 / DESIGN.md §11) */}
              <div className="sticky left-0 z-10 flex items-center gap-2 bg-[var(--que-bg)] py-1 pr-2 text-sm text-[var(--que-text)]">
                <span
                  className="size-2.5 shrink-0 rounded-full"
                  style={{ backgroundColor: user.avatarColor }}
                  aria-hidden
                />
                <span className="truncate">{user.name}</span>
              </div>
              {cells.map((cell) => {
                const level = GREEN[cell.intensity];
                const dateLabel = format(new Date(`${cell.date}T00:00:00`), "M월 d일", {
                  locale: ko,
                });
                return (
                  <Link
                    key={cell.date}
                    href={`/schedule?range=day&date=${cell.date}`}
                    role="gridcell"
                    aria-label={`${user.name} ${dateLabel} 작업 ${cell.taskCount}건 ${cell.hours}시간 · 일정 보기`}
                    className={cn(
                      "m-0.5 flex min-h-10 items-center justify-center rounded-md border border-[var(--que-border)] text-xs tabular-nums transition-shadow",
                      "outline-none hover:border-[var(--que-border-strong)] hover:shadow-sm focus-visible:ring-2 focus-visible:ring-[var(--que-brand)]",
                      level.bg,
                      level.fg,
                    )}
                  >
                    {cell.hours > 0 ? cell.hours : ""}
                  </Link>
                );
              })}
            </div>
          ))}
        </div>
      </ScrollAffordance>

      <div className="flex items-center gap-2 text-xs text-[var(--que-text-tertiary)]">
        <span>적음</span>
        {GREEN.map((g, i) => (
          <span
            key={i}
            className={cn("size-4 rounded-[3px] border border-[var(--que-border)]", g.bg)}
            aria-hidden
          />
        ))}
        <span>많음</span>
        <span className="ml-1">셀 = 예상 시간(h) · 클릭 시 그날 일정</span>
      </div>
    </div>
  );
}
