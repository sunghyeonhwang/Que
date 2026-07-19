import { cn } from "@/lib/utils";
import type { ViewMilestoneStripItem } from "@/lib/view-data";
import { ddayLabel, milestoneRiskDot, milestoneRiskText, scale } from "./view-format";

// 슬라이드쇼: 마일스톤 스트립 페이지. 다가오는 순 최대 8을 큰 타이포 가로 스트립으로.
// 각 행: risk 색 점 · 제목 · 프로젝트명 · D-day. 노출은 프로젝트 공개 정보(제목·프로젝트·D-day·risk)뿐.

export function MilestoneStripGrid({ items }: { items: ViewMilestoneStripItem[] }) {
  if (items.length === 0) {
    return (
      <div className="flex min-h-0 flex-1 items-center justify-center">
        <div className="flex items-center gap-4 text-neutral-400">
          <span className={cn("inline-block rounded-full bg-green-500", scale("size-4", "size-5", "size-7", "size-9"))} />
          <span className={cn("font-semibold", scale("text-3xl", "text-4xl", "text-6xl", "text-7xl"))}>
            다가오는 마일스톤 없음
          </span>
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "min-h-0 flex-1 overflow-auto",
        scale("px-8 py-6", "px-12 py-8", "px-16 py-12", "px-24 py-16"),
      )}
    >
      <ul className={cn("flex h-full flex-col justify-center", scale("gap-3", "gap-4", "gap-6", "gap-8"))}>
        {items.map((m) => (
          <li
            key={m.id}
            className={cn(
              "flex items-center gap-5 rounded-2xl border border-neutral-200 bg-neutral-50",
              scale("px-6 py-4", "px-8 py-5", "px-12 py-7", "px-16 py-10"),
            )}
          >
            <span
              aria-hidden
              className={cn(
                "inline-block shrink-0 rounded-full",
                milestoneRiskDot(m.riskStatus),
                scale("size-4", "size-5", "size-7", "size-9"),
              )}
            />
            <div className="min-w-0 flex-1">
              <p
                className={cn(
                  "truncate font-bold text-neutral-900",
                  m.critical && "text-red-700",
                  scale("text-2xl", "text-3xl", "text-5xl", "text-6xl"),
                )}
              >
                {m.title}
              </p>
              {m.projectLabel ? (
                <p
                  className={cn(
                    "truncate text-neutral-500",
                    scale("text-base", "text-lg", "text-2xl", "text-3xl"),
                  )}
                >
                  {m.projectLabel}
                </p>
              ) : null}
            </div>
            <span
              className={cn(
                "shrink-0 font-bold tabular-nums",
                milestoneRiskText(m.riskStatus),
                scale("text-3xl", "text-4xl", "text-6xl", "text-7xl"),
              )}
            >
              {ddayLabel(m.dday)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
