import { AlertTriangle, PauseCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ViewRiskItem } from "@/lib/view-data";
import { avatarInitials, scale } from "./view-format";

// 슬라이드쇼: 위험 보드 페이지. 현재 문제(issue)/홀드(on_hold) 작업 목록.
// 노출: 제목·담당자 이름·상태 뱃지(기존 보드가 이미 노출하는 동급). 사유·다음 액션 등 상세는 제외.
// 0건이면 "현재 막힘 없음" green 한 장.

const STATUS_META = {
  issue: { label: "문제", chip: "bg-red-100 text-red-700", Icon: AlertTriangle },
  on_hold: { label: "홀드", chip: "bg-amber-100 text-amber-700", Icon: PauseCircle },
} as const;

export function RiskBoardGrid({ items }: { items: ViewRiskItem[] }) {
  if (items.length === 0) {
    return (
      <div className="flex min-h-0 flex-1 items-center justify-center">
        <div className="flex flex-col items-center gap-6 text-green-600">
          <span
            className={cn(
              "flex items-center justify-center rounded-full bg-green-100",
              scale("size-24", "size-28", "size-40", "size-52"),
            )}
          >
            <span className={cn("rounded-full bg-green-500", scale("size-8", "size-10", "size-14", "size-20"))} />
          </span>
          <span className={cn("font-bold", scale("text-4xl", "text-5xl", "text-7xl", "text-8xl"))}>
            현재 막힘 없음
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
      <ul className={cn("flex flex-col", scale("gap-3", "gap-4", "gap-6", "gap-8"))}>
        {items.map((t) => {
          const meta = STATUS_META[t.status];
          const border = t.status === "issue" ? "border-l-red-500" : "border-l-amber-500";
          return (
            <li
              key={t.id}
              className={cn(
                "flex items-center gap-5 rounded-2xl border border-neutral-200 border-l-4 bg-white",
                border,
                scale("px-6 py-4", "px-8 py-5", "px-12 py-7", "px-16 py-10"),
              )}
            >
              <span
                className={cn(
                  "flex shrink-0 items-center gap-2 rounded-full font-bold",
                  meta.chip,
                  scale("px-3 py-1 text-base", "px-4 py-1.5 text-lg", "px-5 py-2 text-2xl", "px-7 py-2.5 text-3xl"),
                )}
              >
                <meta.Icon className={scale("size-4", "size-5", "size-7", "size-9")} />
                {meta.label}
              </span>

              <div className="min-w-0 flex-1">
                <p
                  className={cn(
                    "truncate font-bold text-neutral-900",
                    scale("text-2xl", "text-3xl", "text-5xl", "text-6xl"),
                  )}
                >
                  {t.title}
                </p>
                {t.clientLabel ? (
                  <p
                    className={cn(
                      "truncate text-neutral-500",
                      scale("text-base", "text-lg", "text-2xl", "text-3xl"),
                    )}
                  >
                    {t.clientLabel}
                  </p>
                ) : null}
              </div>

              <span className="flex shrink-0 items-center gap-3">
                <span
                  className={cn(
                    "flex items-center justify-center rounded-full font-semibold text-white",
                    scale("size-10 text-sm", "size-12 text-base", "size-16 text-2xl", "size-20 text-3xl"),
                  )}
                  style={{ backgroundColor: t.ownerColor }}
                >
                  {avatarInitials(t.ownerName)}
                </span>
                <span
                  className={cn(
                    "font-semibold text-neutral-700",
                    scale("text-xl", "text-2xl", "text-4xl", "text-5xl"),
                  )}
                >
                  {t.ownerName}
                </span>
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
