import { format, isSameDay, isSameMonth, isToday } from "date-fns";
import type { CalendarViewItem } from "@/lib/calendar-data";
import { cn } from "@/lib/utils";
import { eventSwatch } from "./event-color";

const WEEKDAYS = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"];

/** 월간 뷰 — 최소 동작. 각 날짜 칸에 이벤트를 파스텔 칩으로 표시(시간순, 최대 3개 + 더보기). */
export function MonthView({
  weeks,
  anchor,
  items,
}: {
  weeks: Date[][];
  anchor: Date;
  items: CalendarViewItem[];
}) {
  return (
    <div className="flex h-[calc(100dvh-13rem)] flex-col overflow-hidden rounded-xl border border-[var(--que-border)] bg-[var(--que-bg)]">
      <div className="min-h-0 flex-1 overflow-auto">
        <div className="grid h-full min-w-[760px] grid-cols-7 grid-rows-[auto_repeat(6,minmax(6.5rem,1fr))]">
          {WEEKDAYS.map((wd) => (
            <div
              key={wd}
              className="sticky top-0 z-10 border-b border-l border-[var(--que-border)] bg-[var(--que-bg)] px-2 py-2 text-center text-[11px] font-semibold uppercase tracking-wide text-[var(--que-text-tertiary)] first:border-l-0"
            >
              {wd}
            </div>
          ))}
          {weeks.map((week) =>
            week.map((day) => {
              const dayItems = items
                .filter((it) => isSameDay(new Date(it.startAt), day))
                .sort((a, b) => a.startAt.localeCompare(b.startAt));
              const outside = !isSameMonth(day, anchor);
              const today = isToday(day);
              return (
                <div
                  key={day.toISOString()}
                  className={cn(
                    "min-h-[6.5rem] border-b border-l border-[var(--que-border)] p-1.5 [&:nth-child(7n+1)]:border-l-0",
                    outside && "bg-[var(--que-bg-muted)]/50",
                    today && "bg-[var(--que-brand-subtle)]/50",
                  )}
                >
                  <div
                    className={cn(
                      "mb-1 text-right text-xs font-semibold",
                      outside
                        ? "text-[var(--que-placeholder)]"
                        : today
                          ? "text-[var(--que-brand)]"
                          : "text-[var(--que-text-secondary)]",
                    )}
                  >
                    {format(day, "d")}
                  </div>
                  <div className="flex flex-col gap-1">
                    {dayItems.slice(0, 3).map((it) => {
                      const swatch = eventSwatch(it);
                      return (
                        <div
                          key={`${it.kind}-${it.id}`}
                          aria-label={`${it.title}, ${format(new Date(it.startAt), "h:mm a")}`}
                          className="flex items-center gap-1 truncate rounded border px-1.5 py-0.5 text-[11px] font-medium"
                          style={{
                            backgroundColor: swatch.bg,
                            borderColor: swatch.border,
                            color: swatch.text,
                          }}
                        >
                          <span className="tabular-nums" style={{ color: swatch.accent }}>
                            {format(new Date(it.startAt), "H:mm")}
                          </span>
                          <span className="truncate">{it.title}</span>
                        </div>
                      );
                    })}
                    {dayItems.length > 3 && (
                      <span className="px-1 text-[10px] text-[var(--que-text-tertiary)]">
                        +{dayItems.length - 3}개 더
                      </span>
                    )}
                  </div>
                </div>
              );
            }),
          )}
        </div>
      </div>
    </div>
  );
}
