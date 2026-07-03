"use client";

import { format } from "date-fns";
import { Diamond } from "lucide-react";
import type { CalendarData, CalendarViewItem } from "@/lib/calendar-data";
import { cn } from "@/lib/utils";
import { DropCell } from "./drop-cell";
import { setDragPayload } from "./drag";
import { TimelineVertical } from "./timeline-vertical";
import {
  isUnitNow,
  milestoneIndex,
  placeItem,
  unitLabels,
  type TimelineMode,
  type TimelineOrientation,
} from "./timeline-shared";

/** 타임라인 뷰 — 방향(가로/세로)과 축 단위(day/hour)에 따라 렌더를 분기. */
export function TimelineGrid({
  units,
  data,
  mode = "day",
  orientation = "h",
}: {
  units: Date[];
  data: CalendarData;
  mode?: TimelineMode;
  orientation?: TimelineOrientation;
}) {
  if (orientation === "v") return <TimelineVertical units={units} data={data} mode={mode} />;
  return <TimelineHorizontal units={units} data={data} mode={mode} />;
}

/** 가로 타임라인 — 행=멤버/프로젝트, 열=라벨(8rem)+축 단위. 막대가 열을 span. */
function TimelineHorizontal({
  units,
  data,
  mode,
}: {
  units: Date[];
  data: CalendarData;
  mode: TimelineMode;
}) {
  const editable = mode === "day";
  const cols = `8rem repeat(${units.length}, minmax(3.5rem, 1fr))`;

  return (
    <div className="overflow-x-auto rounded-lg border">
      <div role="grid" aria-label="타임라인 캘린더" className="min-w-[980px]">
        {/* 축 헤더 */}
        <div className="grid border-b" style={{ gridTemplateColumns: cols }}>
          <div className="sticky left-0 bg-background px-2 py-2 text-sm font-medium">
            멤버 / 프로젝트
          </div>
          {units.map((unit, i) => {
            const { primary, secondary } = unitLabels(unit, mode);
            return (
              <div
                key={i}
                className={cn(
                  "border-l px-1 py-2 text-center text-[11px]",
                  isUnitNow(unit, mode) && "bg-accent font-semibold",
                )}
              >
                {primary}
                {secondary && (
                  <span className="block text-[10px] text-muted-foreground">{secondary}</span>
                )}
              </div>
            );
          })}
        </div>

        {data.users.map((user) => (
          <TimelineRow
            key={user.id}
            label={user.name}
            labelColor={user.avatarColor}
            units={units}
            mode={mode}
            editable={editable}
            restrictOwnerId={user.id}
            items={data.items.filter((item) => item.ownerId === user.id)}
          />
        ))}

        {data.projects.map((project) => (
          <ProjectRow
            key={project.id}
            project={project}
            units={units}
            mode={mode}
            editable={editable}
            data={data}
          />
        ))}
      </div>
    </div>
  );
}

function TimelineRow({
  label,
  labelColor,
  units,
  mode,
  editable,
  items,
  restrictOwnerId,
}: {
  label: string;
  labelColor?: string;
  units: Date[];
  mode: TimelineMode;
  editable: boolean;
  items: CalendarViewItem[];
  restrictOwnerId?: string;
}) {
  const cols = `8rem repeat(${units.length}, minmax(3.5rem, 1fr))`;

  const bars = items.flatMap((item) => {
    const p = placeItem(item.startAt, item.endAt, mode, units);
    return p ? [{ item, startIdx: p.startIdx, span: p.span }] : [];
  });

  return (
    <div className="relative border-b">
      {/* 드롭 셀(또는 읽기 전용 셀) 레이어 */}
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
        {units.map((unit, i) => {
          const cellClass = cn("min-h-16 border-l", isUnitNow(unit, mode) && "bg-accent/30");
          return editable ? (
            <DropCell
              key={i}
              date={format(unit, "yyyy-MM-dd")}
              restrictOwnerId={restrictOwnerId}
              ariaLabel={`${label} ${format(unit, "M월 d일")}`}
              className={cellClass}
            />
          ) : (
            <div
              key={i}
              role="gridcell"
              aria-label={`${label} ${unitLabels(unit, mode).primary}`}
              className={cellClass}
            />
          );
        })}
      </div>
      {/* 막대 레이어 — 8rem 라벨 폭을 제외한 영역 위에 겹친다 */}
      <div
        className="pointer-events-none absolute inset-y-0 right-0 left-32 grid items-start gap-y-1 py-1.5"
        style={{ gridTemplateColumns: `repeat(${units.length}, minmax(3.5rem, 1fr))` }}
      >
        {bars.map(({ item, startIdx, span }) => {
          const draggable = editable && item.movable;
          return (
            <div
              key={`${item.kind}-${item.id}`}
              draggable={draggable}
              onDragStart={
                draggable
                  ? (e) => setDragPayload(e, { kind: item.kind, id: item.id, ownerId: item.ownerId })
                  : undefined
              }
              style={{ gridColumn: `${startIdx + 1} / span ${span}`, gridRow: "auto" }}
              aria-label={`${item.title}${draggable ? ", 드래그로 시작일 이동 가능" : ", 읽기 전용"}`}
              className={cn(
                "pointer-events-auto flex h-8 min-w-0 items-center gap-1 truncate rounded-md border bg-card px-2 text-[11px]",
                draggable ? "cursor-grab active:cursor-grabbing" : "border-dashed opacity-80",
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
          );
        })}
      </div>
    </div>
  );
}

function ProjectRow({
  project,
  units,
  mode,
  editable,
  data,
}: {
  project: CalendarData["projects"][number];
  units: Date[];
  mode: TimelineMode;
  editable: boolean;
  data: CalendarData;
}) {
  const cols = `8rem repeat(${units.length}, minmax(3.5rem, 1fr))`;
  const milestones = data.milestones.filter((m) => m.projectId === project.id);

  return (
    <div className="grid border-b bg-muted/30" style={{ gridTemplateColumns: cols }}>
      <div className="sticky left-0 z-[5] flex min-h-12 items-center bg-muted px-2 text-sm font-medium">
        {project.name}
      </div>
      {units.map((unit, i) => {
        const cellMilestones = milestones.filter((m) => milestoneIndex(m.dueAt, mode, units) === i);
        const cellClass = cn(
          "flex min-h-12 items-center justify-center border-l",
          isUnitNow(unit, mode) && "bg-accent/30",
        );
        const content = cellMilestones.map((m) => (
          <div
            key={m.id}
            draggable={editable}
            onDragStart={
              editable ? (e) => setDragPayload(e, { kind: "milestone", id: m.id }) : undefined
            }
            title={`${m.title} (${format(new Date(m.dueAt), "M/d")})`}
            aria-label={`마일스톤 ${m.title}${editable ? ", 드래그로 이동 가능" : ""}`}
            className={cn(editable && "cursor-grab active:cursor-grabbing")}
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
        ));

        return editable ? (
          <DropCell
            key={i}
            date={format(unit, "yyyy-MM-dd")}
            ariaLabel={`${project.name} ${format(unit, "M월 d일")}`}
            className={cellClass}
          >
            {content}
          </DropCell>
        ) : (
          <div
            key={i}
            role="gridcell"
            aria-label={`${project.name} ${unitLabels(unit, mode).primary}`}
            className={cellClass}
          >
            {content}
          </div>
        );
      })}
    </div>
  );
}
