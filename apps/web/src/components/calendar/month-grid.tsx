"use client";

import { format, isSameDay, isSameMonth, isToday } from "date-fns";
import { Diamond } from "lucide-react";
import type { CalendarData } from "@/lib/calendar-data";
import { cn } from "@/lib/utils";
import { DropCell } from "./drop-cell";
import { ItemChip } from "./item-chip";
import { setDragPayload } from "./drag";

const MAX_CHIPS = 3;

/** 기본형 뷰의 월간 모드 — 날짜 셀 그리드, 드래그로 날짜 이동. */
export function MonthGrid({
  weeks,
  anchor,
  data,
}: {
  weeks: Date[][];
  anchor: Date;
  data: CalendarData;
}) {
  return (
    <div className="overflow-x-auto rounded-lg border">
      <div role="grid" aria-label="월간 캘린더" className="grid min-w-[840px] grid-cols-7">
        {["월", "화", "수", "목", "금", "토", "일"].map((label) => (
          <div key={label} className="border-b px-2 py-2 text-center text-sm font-medium">
            {label}
          </div>
        ))}
        {weeks.flat().map((day) => {
          const dayItems = data.items.filter((item) => isSameDay(new Date(item.startAt), day));
          const dayMilestones = data.milestones.filter((m) => isSameDay(new Date(m.dueAt), day));
          const hidden = dayItems.length - MAX_CHIPS;
          return (
            <DropCell
              key={day.toISOString()}
              date={format(day, "yyyy-MM-dd")}
              ariaLabel={format(day, "M월 d일")}
              className={cn(
                "min-h-28 border-b border-l p-1",
                !isSameMonth(day, anchor) && "bg-muted/40 text-muted-foreground",
                isToday(day) && "bg-accent/30",
              )}
            >
              <div className="flex items-center justify-between px-1">
                <span className={cn("text-xs tabular-nums", isToday(day) && "font-semibold")}>
                  {format(day, "d")}
                </span>
                <span className="flex gap-0.5">
                  {dayMilestones.map((m) => (
                    <span
                      key={m.id}
                      draggable
                      onDragStart={(e) => setDragPayload(e, { kind: "milestone", id: m.id })}
                      title={`${m.projectName} · ${m.title}`}
                      aria-label={`마일스톤 ${m.title}, 드래그로 이동 가능`}
                      className="cursor-grab active:cursor-grabbing"
                    >
                      <Diamond
                        className={cn(
                          "size-3",
                          m.riskStatus === "at_risk" ? "text-destructive" : "text-foreground",
                        )}
                        fill="currentColor"
                        aria-hidden
                      />
                    </span>
                  ))}
                </span>
              </div>
              <div className="mt-1 flex flex-col gap-1">
                {dayItems.slice(0, MAX_CHIPS).map((item) => (
                  <ItemChip key={`${item.kind}-${item.id}`} item={item} showOwner showTime={false} />
                ))}
                {hidden > 0 && (
                  <span className="px-1 text-[10px] text-muted-foreground">+{hidden}개 더</span>
                )}
              </div>
            </DropCell>
          );
        })}
      </div>
    </div>
  );
}
