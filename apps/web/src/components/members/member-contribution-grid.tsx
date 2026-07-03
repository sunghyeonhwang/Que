import { format } from "date-fns";
import { ko } from "date-fns/locale";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { MemberDetail } from "@/lib/members-data";
import { cn } from "@/lib/utils";

// 히트맵(서버, 정적) — 초록 강도 5단계 그리드. 태블릿 우선(hover 없음)·색약 대응을 위해
// 색 단독이 아니라 기여 수치(count)를 셀 안에 함께 표기하고 하단 범례를 둔다.
// 팔레트는 performance-heatmap과 동일하게 맞춘다.
const GREEN = [
  { bg: "bg-white", fg: "text-transparent" },
  { bg: "bg-[#dcfce7]", fg: "text-[#166534]" },
  { bg: "bg-[#86efac]", fg: "text-[#14532d]" },
  { bg: "bg-[#22c55e]", fg: "text-white" },
  { bg: "bg-[#15803d]", fg: "text-white" },
];

const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];

export function MemberContributionGrid({ heatmap }: { heatmap: MemberDetail["heatmap"] }) {
  const { cells, monthLabel, totalCount } = heatmap;
  // 첫 셀의 요일만큼 앞을 비워 7열(요일) 정렬을 맞춘다.
  const firstDay = cells.length > 0 ? new Date(`${cells[0].date}T00:00:00`).getDay() : 0;

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between">
        <CardTitle>히트맵</CardTitle>
        <span className="text-sm text-[var(--que-text-tertiary)]">{monthLabel}</span>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <div className="overflow-x-auto">
          <div className="grid min-w-[280px] grid-cols-7 gap-1.5">
            {WEEKDAYS.map((label) => (
              <div
                key={label}
                className="pb-1 text-center text-xs text-[var(--que-text-tertiary)]"
              >
                {label}
              </div>
            ))}
            {Array.from({ length: firstDay }).map((_, i) => (
              <div key={`pad-${i}`} aria-hidden />
            ))}
            {cells.map((cell) => {
              const d = new Date(`${cell.date}T00:00:00`);
              const label = `${format(d, "M월 d일", { locale: ko })} ${cell.count}개 기여`;
              const level = GREEN[cell.intensity];
              return (
                <div
                  key={cell.date}
                  title={label}
                  aria-label={label}
                  className={cn(
                    "flex aspect-square min-h-8 items-center justify-center rounded-md border border-[var(--que-border)] text-xs font-medium tabular-nums",
                    level.bg,
                    level.fg,
                  )}
                >
                  {cell.count > 0 ? cell.count : ""}
                </div>
              );
            })}
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm text-[var(--que-text-secondary)]">
            {monthLabel}에 {totalCount}개 기여
          </p>
          <div className="flex items-center gap-1.5 text-xs text-[var(--que-text-tertiary)]">
            <span>적음</span>
            {GREEN.map((g, i) => (
              <span
                key={i}
                className={cn(
                  "size-4 rounded-[3px] border border-[var(--que-border)]",
                  g.bg,
                )}
                aria-hidden
              />
            ))}
            <span>많음</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
