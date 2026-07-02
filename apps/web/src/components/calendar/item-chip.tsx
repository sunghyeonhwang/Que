"use client";

import { format } from "date-fns";
import { Lock } from "lucide-react";
import { TASK_STATUS_LABELS } from "@que/core";
import type { CalendarViewItem } from "@/lib/calendar-data";
import { cn } from "@/lib/utils";
import { setDragPayload } from "./drag";

/** 캘린더 셀 안의 항목 칩. movable 항목만 드래그 가능하고,
 *  회사/비공개 일정은 잠금 아이콘으로 읽기 전용임을 표시한다. */
export function ItemChip({
  item,
  showOwner = false,
  showTime = true,
}: {
  item: CalendarViewItem;
  showOwner?: boolean;
  showTime?: boolean;
}) {
  const statusText =
    item.kind === "task" && item.taskStatus ? TASK_STATUS_LABELS[item.taskStatus] : null;

  return (
    <div
      draggable={item.movable}
      onDragStart={
        item.movable
          ? (e) => setDragPayload(e, { kind: item.kind, id: item.id, ownerId: item.ownerId })
          : undefined
      }
      aria-label={`${item.title}${statusText ? `, ${statusText}` : ""}${item.movable ? ", 드래그로 이동 가능" : ", 읽기 전용"}`}
      className={cn(
        "flex min-h-10 w-full items-center gap-1.5 rounded-md border bg-card px-2 py-1 text-left text-xs",
        item.movable ? "cursor-grab active:cursor-grabbing" : "border-dashed opacity-80",
        item.taskStatus === "issue" && "border-destructive/50",
      )}
    >
      <span
        className="size-2 shrink-0 rounded-full"
        style={{ backgroundColor: item.ownerColor }}
        aria-hidden
      />
      <span className="min-w-0 flex-1">
        <span className="block truncate font-medium">
          {item.title}
          {item.recentlyChanged && (
            <span className="ml-1 rounded-sm bg-secondary px-1 py-px text-[9px] font-normal text-secondary-foreground">
              수정됨
            </span>
          )}
        </span>
        <span className="block truncate text-[10px] text-muted-foreground">
          {showTime && `${format(new Date(item.startAt), "HH:mm")} `}
          {showOwner && item.ownerName}
          {statusText && ` · ${statusText}`}
        </span>
      </span>
      {!item.movable && <Lock className="size-3 shrink-0 text-muted-foreground" aria-hidden />}
    </div>
  );
}
