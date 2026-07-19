import { CalendarClock } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ViewNextDayPreview } from "@/lib/view-data";
import { ddayLabel, milestoneRiskDot, milestoneRiskText, scale } from "./view-format";

// 다음 영업일 미리보기 패널. 주말/야간(18시 이후)/빈 보드일 때 빈 보드 중앙에 카드 1장.
// 운영 톤 — 장식 없음. 내용: 다음 영업일 날짜 + 마감 예정 N건 + 첫 회의(private면 "일정") +
// 다가오는 마일스톤 최대 3(D-day·risk 점). 노출 데이터는 모두 view 마스킹 규칙을 통과한 값.

export function ViewNextDayPreview({ preview }: { preview: ViewNextDayPreview }) {
  const { dateLabel, dueCount, firstMeeting, milestones } = preview;

  return (
    <div className="flex min-h-0 flex-1 items-center justify-center p-8">
      <div
        className={cn(
          "w-full rounded-3xl border border-neutral-200 bg-white shadow-sm",
          scale("max-w-2xl p-8", "max-w-3xl p-10", "max-w-4xl p-14", "max-w-5xl p-20"),
        )}
      >
        <div className="flex items-center gap-3 text-neutral-500">
          <CalendarClock className={scale("size-6", "size-7", "size-9", "size-11")} />
          <span className={cn("font-medium", scale("text-lg", "text-xl", "text-3xl", "text-4xl"))}>
            다음 영업일 미리보기
          </span>
        </div>

        <p
          className={cn(
            "mt-2 font-bold text-neutral-900",
            scale("text-4xl", "text-5xl", "text-7xl", "text-8xl"),
          )}
        >
          {dateLabel}
        </p>

        <dl
          className={cn(
            "mt-8 grid gap-x-10 gap-y-6 sm:grid-cols-2",
            scale("text-lg", "text-xl", "text-3xl", "text-4xl"),
          )}
        >
          <div>
            <dt className="font-medium text-neutral-500">마감 예정</dt>
            <dd className="mt-1 font-bold tabular-nums text-neutral-900">{dueCount}건</dd>
          </div>
          <div className="min-w-0">
            <dt className="font-medium text-neutral-500">첫 회의</dt>
            <dd className="mt-1 min-w-0 font-bold text-neutral-900">
              {firstMeeting ? (
                <span className="flex flex-wrap items-baseline gap-x-3">
                  <span className="tabular-nums text-blue-600">{firstMeeting.timeLabel}</span>
                  <span className="min-w-0 truncate">{firstMeeting.title}</span>
                </span>
              ) : (
                <span className="text-neutral-400">없음</span>
              )}
            </dd>
          </div>
        </dl>

        {milestones.length > 0 ? (
          <div className="mt-8 border-t border-neutral-100 pt-6">
            <p
              className={cn(
                "font-medium text-neutral-500",
                scale("text-base", "text-lg", "text-2xl", "text-3xl"),
              )}
            >
              다가오는 마일스톤
            </p>
            <ul className="mt-3 space-y-3">
              {milestones.map((m) => (
                <li key={`${m.title}-${m.dday}`} className="flex items-center gap-3">
                  <span
                    aria-hidden
                    className={cn(
                      "inline-block shrink-0 rounded-full",
                      milestoneRiskDot(m.riskStatus),
                      scale("size-3", "size-4", "size-5", "size-6"),
                    )}
                  />
                  <span
                    className={cn(
                      "min-w-0 flex-1 truncate font-semibold text-neutral-800",
                      scale("text-lg", "text-xl", "text-3xl", "text-4xl"),
                    )}
                  >
                    {m.title}
                  </span>
                  <span
                    className={cn(
                      "shrink-0 font-bold tabular-nums",
                      milestoneRiskText(m.riskStatus),
                      scale("text-lg", "text-xl", "text-3xl", "text-4xl"),
                    )}
                  >
                    {ddayLabel(m.dday)}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>
    </div>
  );
}
