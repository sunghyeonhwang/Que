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

/** 히트맵(멤버×일) — 초록 강도 그리드 + 멤버별 부하 막대. heatmap-data 재사용.
 *  히트맵(어디 몰렸나) 아래에 부하 막대(누가 많나)를 붙여 한 화면에서 보완한다.
 *  셀 클릭 시 그 날짜의 일정(일 뷰)으로 이동한다. */
export function PerformanceHeatmap({
  data,
  gridOnly = false,
}: {
  data: HeatmapData;
  /** true=그리드(+범례)만 렌더 — 홈 '날짜별 업무 집중도'처럼 부하 표가 따로 있는 화면에서
   *  멤버별 부하 막대 중복을 피한다. 성과 화면은 기본(false)으로 막대 포함. */
  gridOnly?: boolean;
}) {
  const overloaded = new Set(data.overloaded);
  const relaxed = new Set(data.relaxed);

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

      {gridOnly ? null : (
      <>
      {/* 멤버별 부하 막대 — 누가 얼마나 몰렸나(정렬 아님, 배분 조정용).
          막대 길이 = totalScore(예상 시간 + 문제/홀드/마감 임박 가중), 라벨 = 실제 예상 시간. */}
      <div className="flex flex-col gap-2 border-t border-[var(--que-border)] pt-3">
        <p className="text-xs text-[var(--que-text-tertiary)]">
          멤버별 부하 — 막대 길이는 예상 시간에 문제·홀드·마감 임박 가중을 더한 값입니다. 개인 평가가
          아니라 업무 배분 조정용입니다.
        </p>
        {data.rows.map(({ user, totalScore, totalHours, issueOrHold }) => {
          const isOver = overloaded.has(user.name);
          const isRelaxed = relaxed.has(user.name);
          return (
            <div key={user.id} className="flex items-center gap-2">
              <span className="flex w-20 shrink-0 items-center gap-1.5 text-sm text-[var(--que-text)]">
                <span
                  className="size-2 shrink-0 rounded-full"
                  style={{ backgroundColor: user.avatarColor }}
                  aria-hidden
                />
                <span className="truncate">{user.name}</span>
              </span>
              <span
                className="h-4 rounded-sm"
                style={{
                  width: `${(totalScore / data.maxTotal) * 100}%`,
                  minWidth: totalScore ? "0.5rem" : "0",
                  backgroundColor: isOver
                    ? "var(--que-warning)"
                    : "var(--que-text-tertiary)",
                }}
                aria-hidden
              />
              <span className="whitespace-nowrap text-xs tabular-nums text-[var(--que-text-secondary)]">
                {totalHours}h
                {issueOrHold > 0 && (
                  <span className="text-[var(--que-error)]"> · 막힘 {issueOrHold}</span>
                )}
                {isOver && <span className="text-[var(--que-warning)]"> · 과부하</span>}
                {isRelaxed && !isOver && (
                  <span className="text-[var(--que-text-tertiary)]"> · 여유</span>
                )}
              </span>
            </div>
          );
        })}
      </div>
      </>
      )}
    </div>
  );
}
