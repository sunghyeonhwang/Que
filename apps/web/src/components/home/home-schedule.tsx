import type { HomeScheduleItem } from "@/lib/home-data";

/** 개인 일정 — 오늘 내 작업·이벤트 시간순 요약. 내부 세로 스크롤. */
export function HomeSchedule({
  items,
  dateLabel,
}: {
  items: HomeScheduleItem[];
  dateLabel: string;
}) {
  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm font-medium text-[var(--que-text-secondary)]">{dateLabel}</p>
      {items.length === 0 ? (
        <div className="flex min-h-[120px] items-center justify-center rounded-lg border border-dashed border-[var(--que-border)] text-sm text-[var(--que-text-tertiary)]">
          오늘 등록된 일정이 없습니다.
        </div>
      ) : (
        <ul className="flex max-h-[280px] flex-col overflow-y-auto pr-0.5">
          {items.map((item) => (
            <li key={`${item.kind}-${item.id}`} className="flex items-stretch gap-3 py-2">
              <span
                className="mt-0.5 w-16 shrink-0 text-xs tabular-nums text-[var(--que-text-tertiary)]"
              >
                {item.timeLabel.split(" - ")[0]}
              </span>
              <span
                className="w-1 shrink-0 rounded-full"
                style={{ backgroundColor: item.color }}
                aria-hidden
              />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-[var(--que-text)]">
                  {item.title}
                </p>
                <p className="text-xs tabular-nums text-[var(--que-text-tertiary)]">
                  {item.timeLabel}
                </p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
