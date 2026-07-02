"use client";

import { format, isSameDay, isToday } from "date-fns";
import { ko } from "date-fns/locale";
import { Diamond } from "lucide-react";
import type { CalendarData } from "@/lib/calendar-data";
import { cn } from "@/lib/utils";
import { DropCell } from "./drop-cell";
import { ItemChip } from "./item-chip";
import { setDragPayload } from "./drag";

const HOURS = Array.from({ length: 12 }, (_, i) => 8 + i); // 08:00–19:00

/** 기본형 뷰 — 시간축 격자. days가 1개면 일간, 7개면 주간. */
export function WeekGrid({ days, data }: { days: Date[]; data: CalendarData }) {
  return (
    <div className="overflow-x-auto rounded-lg border">
      <div
        role="grid"
        aria-label="시간축 캘린더"
        className="grid min-w-[720px]"
        style={{ gridTemplateColumns: `4rem repeat(${days.length}, minmax(0, 1fr))` }}
      >
        {/* 요일 헤더 */}
        <div className="sticky top-0 z-10 border-b bg-background" />
        {days.map((day) => (
          <div
            key={day.toISOString()}
            className={cn(
              "sticky top-0 z-10 border-b border-l bg-background px-2 py-2 text-center text-sm font-medium",
              isToday(day) && "bg-accent",
            )}
          >
            {format(day, "M/d (EEE)", { locale: ko })}
          </div>
        ))}

        {/* 마일스톤 밴드 */}
        <div className="flex items-center border-b bg-muted/40 px-2 py-1 text-[10px] text-muted-foreground">
          마일스톤
        </div>
        {days.map((day) => {
          const dayMilestones = data.milestones.filter((m) => isSameDay(new Date(m.dueAt), day));
          return (
            <DropCell
              key={`ms-${day.toISOString()}`}
              date={format(day, "yyyy-MM-dd")}
              ariaLabel={`${format(day, "M월 d일")} 마일스톤`}
              className="min-h-10 border-b border-l bg-muted/40 p-1"
            >
              {dayMilestones.map((m) => (
                <div
                  key={m.id}
                  draggable
                  onDragStart={(e) => setDragPayload(e, { kind: "milestone", id: m.id })}
                  className="flex min-h-8 cursor-grab items-center gap-1 rounded-md border bg-card px-1.5 text-[11px] active:cursor-grabbing"
                  aria-label={`마일스톤 ${m.title}, 드래그로 이동 가능`}
                >
                  <Diamond
                    className={cn(
                      "size-3 shrink-0",
                      m.riskStatus === "at_risk" && "text-destructive",
                    )}
                    aria-hidden
                  />
                  <span className="truncate">{m.projectName} · {m.title}</span>
                </div>
              ))}
            </DropCell>
          );
        })}

        {/* 시간 행 */}
        {HOURS.map((hour) => (
          <TimeRow key={hour} hour={hour} days={days} data={data} />
        ))}
      </div>
    </div>
  );
}

function TimeRow({ hour, days, data }: { hour: number; days: Date[]; data: CalendarData }) {
  return (
    <>
      <div className="sticky left-0 z-[5] border-b bg-background px-2 py-1 text-right text-[11px] tabular-nums text-muted-foreground">
        {String(hour).padStart(2, "0")}:00
      </div>
      {days.map((day) => {
        const cellItems = data.items.filter((item) => {
          const start = new Date(item.startAt);
          return isSameDay(start, day) && start.getHours() === hour;
        });
        return (
          <DropCell
            key={`${hour}-${day.toISOString()}`}
            date={format(day, "yyyy-MM-dd")}
            hour={hour}
            ariaLabel={`${format(day, "M월 d일")} ${hour}시`}
            className={cn(
              "min-h-11 border-b border-l p-1",
              isToday(day) && "bg-accent/30",
            )}
          >
            <div className="flex flex-col gap-1">
              {cellItems.map((item) => (
                <ItemChip key={`${item.kind}-${item.id}`} item={item} showOwner />
              ))}
            </div>
          </DropCell>
        );
      })}
    </>
  );
}
