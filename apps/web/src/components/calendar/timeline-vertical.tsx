"use client";

import { format } from "date-fns";
import { Diamond } from "lucide-react";
import type { CalendarData, CalendarViewItem } from "@/lib/calendar-data";
import { cn } from "@/lib/utils";
import { DropCell } from "./drop-cell";
import { setDragPayload } from "./drag";
import {
  isUnitNow,
  milestoneIndex,
  placeItem,
  unitLabels,
  type TimelineMode,
} from "./timeline-shared";

interface Lane {
  key: string;
  type: "member" | "project";
  label: string;
  color?: string;
  ownerId?: string;
  items: CalendarViewItem[];
  milestones: CalendarData["milestones"];
}

/**
 * 타임라인 세로 뷰 — 위 헤더=멤버/프로젝트, 왼쪽 열=날짜/시간.
 * 하나의 CSS grid에 배경 셀과 막대를 함께 배치하고, 막대는 unit 행을 세로로 span한다.
 * 막대 컨테이너는 pointer-events-none이라 아래 DropCell이 드롭을 받고, 칩만 pointer-events-auto로 잡아 끈다.
 * 같은 레인에서 겹치는 막대는 서로 위에 쌓인다(드문 케이스, 읽기에는 지장 없음).
 * day 모드는 드래그로 날짜 이동 가능, hour 모드는 읽기 전용.
 */
export function TimelineVertical({
  units,
  data,
  mode,
}: {
  units: Date[];
  data: CalendarData;
  mode: TimelineMode;
}) {
  const editable = mode === "day";

  const lanes: Lane[] = [
    ...data.users.map((u) => ({
      key: `u-${u.id}`,
      type: "member" as const,
      label: u.name,
      color: u.avatarColor,
      ownerId: u.id,
      items: data.items.filter((it) => it.ownerId === u.id),
      milestones: [] as CalendarData["milestones"],
    })),
    ...data.projects.map((p) => ({
      key: `p-${p.id}`,
      type: "project" as const,
      label: p.name,
      items: [] as CalendarViewItem[],
      milestones: data.milestones.filter((m) => m.projectId === p.id),
    })),
  ];

  const gridTemplateColumns = `5rem repeat(${lanes.length}, minmax(7rem, 1fr))`;
  const gridTemplateRows = `auto repeat(${units.length}, minmax(3rem, auto))`;

  return (
    <div className="max-h-[70vh] overflow-auto rounded-lg border">
      <div
        role="grid"
        aria-label="타임라인 캘린더 (세로)"
        className="grid min-w-[640px]"
        style={{ gridTemplateColumns, gridTemplateRows }}
      >
        {/* 좌상단 코너 */}
        <div
          className="sticky top-0 left-0 z-20 flex items-center border-b bg-background px-2 py-2 text-xs font-medium"
          style={{ gridColumn: 1, gridRow: 1 }}
        >
          {mode === "day" ? "날짜" : "시간"}
        </div>

        {/* 레인 헤더 (멤버 / 프로젝트) */}
        {lanes.map((lane, j) => (
          <div
            key={lane.key}
            style={{ gridColumn: j + 2, gridRow: 1 }}
            className={cn(
              "sticky top-0 z-10 flex min-h-11 items-center gap-1.5 border-b border-l px-2 py-2 text-sm",
              lane.type === "project" ? "bg-muted font-medium" : "bg-background",
            )}
          >
            {lane.color && (
              <span
                className="size-2.5 shrink-0 rounded-full"
                style={{ backgroundColor: lane.color }}
                aria-hidden
              />
            )}
            <span className="truncate">{lane.label}</span>
          </div>
        ))}

        {/* 좌측 날짜/시간 라벨 */}
        {units.map((unit, i) => {
          const { primary, secondary } = unitLabels(unit, mode);
          return (
            <div
              key={`lbl-${i}`}
              style={{ gridColumn: 1, gridRow: i + 2 }}
              className={cn(
                "sticky left-0 z-[8] border-b bg-background px-2 py-1 text-right text-[11px] tabular-nums",
                isUnitNow(unit, mode) && "bg-accent font-semibold",
              )}
            >
              {primary}
              {secondary && <span className="block text-[10px] text-muted-foreground">{secondary}</span>}
            </div>
          );
        })}

        {/* 배경 셀 (레인 × unit). 프로젝트 레인은 마일스톤 다이아몬드를 셀 안에 표시. */}
        {lanes.map((lane, j) =>
          units.map((unit, i) => {
            const now = isUnitNow(unit, mode);
            const cellClass = cn(
              "flex min-h-12 items-center justify-center border-b border-l p-1",
              now && "bg-accent/30",
            );
            const cellMilestones =
              lane.type === "project"
                ? lane.milestones.filter((m) => milestoneIndex(m.dueAt, mode, units) === i)
                : [];
            const content = cellMilestones.map((m) => (
              <div
                key={m.id}
                draggable={editable}
                onDragStart={
                  editable ? (e) => setDragPayload(e, { kind: "milestone", id: m.id }) : undefined
                }
                title={`${m.title} (${format(new Date(m.dueAt), "M/d")})`}
                aria-label={`마일스톤 ${m.title}${editable ? ", 드래그로 이동 가능" : ""}`}
                className={cn("flex items-center justify-center", editable && "cursor-grab active:cursor-grabbing")}
              >
                <Diamond
                  className={cn("size-4", m.riskStatus === "at_risk" ? "text-destructive" : "text-foreground")}
                  fill="currentColor"
                  aria-hidden
                />
              </div>
            ));

            const style = { gridColumn: j + 2, gridRow: i + 2 } as const;
            return editable ? (
              <DropCell
                key={`${lane.key}-${i}`}
                date={format(unit, "yyyy-MM-dd")}
                restrictOwnerId={lane.ownerId}
                ariaLabel={`${lane.label} ${format(unit, "M월 d일")}`}
                className={cellClass}
                style={style}
              >
                {content}
              </DropCell>
            ) : (
              <div
                key={`${lane.key}-${i}`}
                role="gridcell"
                aria-label={`${lane.label} ${unitLabels(unit, mode).primary}`}
                className={cellClass}
                style={style}
              >
                {content}
              </div>
            );
          }),
        )}

        {/* 멤버 막대 — unit 행을 세로로 span. 배경 셀 뒤에 렌더되어 위에 겹친다. */}
        {lanes.map((lane, j) =>
          lane.items.flatMap((item) => {
            const p = placeItem(item.startAt, item.endAt, mode, units);
            if (!p) return [];
            const draggable = editable && item.movable;
            return [
              <div
                key={`bar-${lane.key}-${item.kind}-${item.id}`}
                style={{ gridColumn: j + 2, gridRow: `${p.startIdx + 2} / span ${p.span}` }}
                className="pointer-events-none z-[2] flex items-start justify-stretch p-0.5"
              >
                <div
                  draggable={draggable}
                  onDragStart={
                    draggable
                      ? (e) => setDragPayload(e, { kind: item.kind, id: item.id, ownerId: item.ownerId })
                      : undefined
                  }
                  aria-label={`${item.title}${draggable ? ", 드래그로 시작일 이동 가능" : ", 읽기 전용"}`}
                  className={cn(
                    "pointer-events-auto flex h-full min-h-8 w-full min-w-0 flex-col overflow-hidden rounded-md border bg-card px-1.5 py-1 text-[11px]",
                    draggable ? "cursor-grab active:cursor-grabbing" : "border-dashed opacity-90",
                    item.taskStatus === "issue" && "border-destructive/60",
                  )}
                >
                  <span className="flex items-center gap-1">
                    <span
                      className="size-2 shrink-0 rounded-full"
                      style={{ backgroundColor: item.ownerColor }}
                      aria-hidden
                    />
                    <span className="truncate">{item.title}</span>
                  </span>
                </div>
              </div>,
            ];
          }),
        )}
      </div>
    </div>
  );
}
