import { format } from "date-fns";
import { ko } from "date-fns/locale";
import type { HeatmapData } from "@/lib/heatmap-data";
import { cn } from "@/lib/utils";

// 초록 강도 5단계(0~4) + 수치 병기 — 색 단독 구분을 피한다(접근성).
const GREEN = [
  { bg: "bg-[var(--que-bg)]", fg: "text-transparent", label: "없음" },
  { bg: "bg-[#dcfce7]", fg: "text-[#166534]", label: "낮음" },
  { bg: "bg-[#86efac]", fg: "text-[#14532d]", label: "" },
  { bg: "bg-[#22c55e]", fg: "text-white", label: "" },
  { bg: "bg-[#15803d]", fg: "text-white", label: "높음" },
];

/** 히트맵(멤버×일) — 초록 강도 그리드. heatmap-data 재사용. 내부 가로 스크롤. */
export function PerformanceHeatmap({ data }: { data: HeatmapData }) {
  return (
    <div className="flex flex-col gap-3">
      <div className="overflow-x-auto">
        <div
          role="grid"
          aria-label="멤버별 일자별 작업량 히트맵"
          className="grid"
          style={{
            gridTemplateColumns: `5rem repeat(${data.days.length}, minmax(0,1fr))`,
            minWidth: `${5 + data.days.length * 1.6}rem`,
          }}
        >
          <div />
          {data.days.map((date) => (
            <div
              key={date}
              className="px-1 pb-1 text-center text-xs text-[var(--que-text-tertiary)]"
            >
              {format(new Date(`${date}T00:00:00`), "M/d", { locale: ko })}
            </div>
          ))}
          {data.rows.map(({ user, cells }) => (
            <div key={user.id} className="contents">
              <div className="flex items-center gap-2 py-1 pr-2 text-sm text-[var(--que-text)]">
                <span
                  className="size-2.5 shrink-0 rounded-full"
                  style={{ backgroundColor: user.avatarColor }}
                  aria-hidden
                />
                <span className="truncate">{user.name}</span>
              </div>
              {cells.map((cell) => {
                const level = GREEN[cell.intensity];
                return (
                  <div
                    key={cell.date}
                    role="gridcell"
                    aria-label={`${user.name} ${cell.date} 작업 ${cell.taskCount}건 ${cell.hours}시간`}
                    className={cn(
                      "m-0.5 flex min-h-10 items-center justify-center rounded-md border border-[var(--que-border)] text-xs tabular-nums",
                      level.bg,
                      level.fg,
                    )}
                  >
                    {cell.hours > 0 ? cell.hours : ""}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
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
        <span className="ml-1">셀 숫자 = 예상 시간(h)</span>
      </div>
    </div>
  );
}
