import { cn } from "@/lib/utils";
import type { ViewStandupStrip } from "@/lib/view-data";
import { avatarInitials, scale } from "./view-format";

// 오전 스탠드업 스트립(헤더 아래 얇은 띠). 영업일 09:30~11:30에만 렌더된다(데이터가 null이면 미표시).
// 공개 화면 요약 수준: 제출 인원수 + 제출자 아바타 점 + (11시 이후) AI 팀 요약 첫 문장 1줄.
// focus 등 개인 서술은 노출하지 않는다.

export function ViewStandupStrip({ strip }: { strip: ViewStandupStrip }) {
  const { submittedCount, totalCount, submitters, summaryLine } = strip;

  return (
    <div
      className={cn(
        "flex shrink-0 items-center gap-x-5 gap-y-2 border-b border-violet-100 bg-violet-50/60",
        "flex-wrap text-neutral-700",
        scale("px-8 py-2.5", "px-12 py-3", "px-16 py-4", "px-24 py-5"),
      )}
    >
      <span
        className={cn(
          "flex shrink-0 items-center gap-2 font-semibold text-violet-700",
          scale("text-base", "text-lg", "text-2xl", "text-3xl"),
        )}
      >
        데일리 스탠드업
        <span className="tabular-nums">
          {submittedCount}/{totalCount} 제출
        </span>
      </span>

      {submitters.length > 0 ? (
        <span className="flex shrink-0 items-center -space-x-1.5">
          {submitters.map((u) => (
            <span
              key={u.id}
              title={u.name}
              className={cn(
                "flex items-center justify-center rounded-full font-semibold text-white ring-2 ring-white",
                scale("size-7 text-[11px]", "size-9 text-sm", "size-11 text-base", "size-13 text-lg"),
              )}
              style={{ backgroundColor: u.avatarColor }}
            >
              {avatarInitials(u.name)}
            </span>
          ))}
        </span>
      ) : null}

      {summaryLine ? (
        <span
          className={cn(
            "min-w-0 flex-1 truncate text-neutral-600",
            scale("text-sm", "text-base", "text-xl", "text-2xl"),
          )}
        >
          {summaryLine}
        </span>
      ) : null}
    </div>
  );
}
