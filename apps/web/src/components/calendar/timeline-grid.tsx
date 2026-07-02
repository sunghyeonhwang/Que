"use client";

import { differenceInCalendarDays, format, isSameDay, isToday } from "date-fns";
import { ko } from "date-fns/locale";
import { Diamond } from "lucide-react";
import type { CalendarData, CalendarViewItem } from "@/lib/calendar-data";
import { cn } from "@/lib/utils";
import { DropCell } from "./drop-cell";
import { setDragPayload } from "./drag";

/** 타임라인 뷰 — 날짜 가로축, 멤버/프로젝트 행. 여러 날짜에 걸친 작업은 막대로 표시. */
export function TimelineGrid({ days, data }: { days: Date[]; data: CalendarData }) {
  const cols = `8rem repeat(${days.length}, minmax(3.5rem, 1fr))`;

  return (
    <div className="overflow-x-auto rounded-lg border">
      <div role="grid" aria-label="타임라인 캘린더" className="min-w-[980px]">
        {/* 날짜 헤더 */}
        <div className="grid border-b" style={{ gridTemplateColumns: cols }}>
          <div className="sticky left-0 bg-background px-2 py-2 text-sm font-medium">
            멤버 / 프로젝트
          </div>
          {days.map((day) => (
            <div
              key={day.toISOString()}
              className={cn(
                "border-l px-1 py-2 text-center text-[11px]",
                isToday(day) && "bg-accent font-semibold",
              )}
            >
              {format(day, "M/d", { locale: ko })}
              <span className="block text-[10px] text-muted-foreground">
                {format(day, "EEE", { locale: ko })}
              </span>
            </div>
          ))}
        </div>

        {data.users.map((user) => (
          <TimelineRow
            key={user.id}
            label={user.name}
            labelColor={user.avatarColor}
            days={days}
            restrictOwnerId={user.id}
            items={data.items.filter((item) => item.ownerId === user.id)}
          />
        ))}

        {data.projects.map((project) => (
          <ProjectRow key={project.id} project={project} days={days} data={data} />
        ))}
      </div>
    </div>
  );
}

function TimelineRow({
  label,
  labelColor,
  days,
  items,
  restrictOwnerId,
}: {
  label: string;
  labelColor?: string;
  days: Date[];
  items: CalendarViewItem[];
  restrictOwnerId?: string;
}) {
  const cols = `8rem repeat(${days.length}, minmax(3.5rem, 1fr))`;
  const rangeStart = days[0];
  const rangeEnd = days[days.length - 1];

  const bars = items.flatMap((item) => {
    const start = new Date(item.startAt);
    const end = new Date(item.endAt);
    if (end < rangeStart || start > rangeEnd) return [];
    const startIdx = Math.max(0, differenceInCalendarDays(start, rangeStart));
    const endIdx = Math.min(days.length - 1, differenceInCalendarDays(end, rangeStart));
    return [{ item, startIdx, span: Math.max(1, endIdx - startIdx + 1) }];
  });

  return (
    <div className="relative border-b">
      {/* 드롭 셀 레이어 */}
      <div className="grid" style={{ gridTemplateColumns: cols }}>
        <div className="sticky left-0 z-[5] flex min-h-16 items-center gap-2 bg-background px-2 text-sm">
          {labelColor && (
            <span
              className="size-2.5 shrink-0 rounded-full"
              style={{ backgroundColor: labelColor }}
              aria-hidden
            />
          )}
          <span className="truncate">{label}</span>
        </div>
        {days.map((day) => (
          <DropCell
            key={day.toISOString()}
            date={format(day, "yyyy-MM-dd")}
            restrictOwnerId={restrictOwnerId}
            ariaLabel={`${label} ${format(day, "M월 d일")}`}
            className={cn("min-h-16 border-l", isToday(day) && "bg-accent/30")}
          />
        ))}
      </div>
      {/* 막대 레이어 — 8rem 라벨 폭을 제외한 영역 위에 겹친다 */}
      <div
        className="pointer-events-none absolute inset-y-0 right-0 left-32 grid items-start gap-y-1 py-1.5"
        style={{ gridTemplateColumns: `repeat(${days.length}, minmax(3.5rem, 1fr))` }}
      >
        {bars.map(({ item, startIdx, span }) => (
          <div
            key={`${item.kind}-${item.id}`}
            draggable={item.movable}
            onDragStart={
              item.movable
                ? (e) => setDragPayload(e, { kind: item.kind, id: item.id, ownerId: item.ownerId })
                : undefined
            }
            style={{ gridColumn: `${startIdx + 1} / span ${span}`, gridRow: "auto" }}
            aria-label={`${item.title}${item.movable ? ", 드래그로 시작일 이동 가능" : ", 읽기 전용"}`}
            className={cn(
              "pointer-events-auto flex h-8 min-w-0 items-center gap-1 truncate rounded-md border bg-card px-2 text-[11px]",
              item.movable ? "cursor-grab active:cursor-grabbing" : "border-dashed opacity-80",
              item.taskStatus === "issue" && "border-destructive/60",
            )}
          >
            <span
              className="size-2 shrink-0 rounded-full"
              style={{ backgroundColor: item.ownerColor }}
              aria-hidden
            />
            <span className="truncate">{item.title}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function ProjectRow({
  project,
  days,
  data,
}: {
  project: CalendarData["projects"][number];
  days: Date[];
  data: CalendarData;
}) {
  const cols = `8rem repeat(${days.length}, minmax(3.5rem, 1fr))`;
  const milestones = data.milestones.filter((m) => m.projectId === project.id);

  return (
    <div className="grid border-b bg-muted/30" style={{ gridTemplateColumns: cols }}>
      <div className="sticky left-0 z-[5] flex min-h-12 items-center bg-muted px-2 text-sm font-medium">
        {project.name}
      </div>
      {days.map((day) => {
        const dayMilestones = milestones.filter((m) => isSameDay(new Date(m.dueAt), day));
        return (
          <DropCell
            key={day.toISOString()}
            date={format(day, "yyyy-MM-dd")}
            ariaLabel={`${project.name} ${format(day, "M월 d일")}`}
            className={cn("flex min-h-12 items-center justify-center border-l", isToday(day) && "bg-accent/30")}
          >
            {dayMilestones.map((m) => (
              <div
                key={m.id}
                draggable
                onDragStart={(e) => setDragPayload(e, { kind: "milestone", id: m.id })}
                title={`${m.title} (${format(new Date(m.dueAt), "M/d")})`}
                aria-label={`마일스톤 ${m.title}, 드래그로 이동 가능`}
                className="cursor-grab active:cursor-grabbing"
              >
                <Diamond
                  className={cn(
                    "size-4",
                    m.riskStatus === "at_risk" ? "text-destructive" : "text-foreground",
                  )}
                  fill="currentColor"
                  aria-hidden
                />
              </div>
            ))}
          </DropCell>
        );
      })}
    </div>
  );
}
