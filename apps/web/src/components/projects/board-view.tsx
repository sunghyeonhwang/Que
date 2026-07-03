"use client";

import { useState, type DragEvent } from "react";
import Link from "next/link";
import { Plus, MoreHorizontal, CalendarDays, MessageSquare, FileText } from "lucide-react";
import type { BoardViewGroup, BoardViewTask } from "@/lib/pm-data";
import { moveTaskAction } from "@/app/(app)/projects/pm-actions";
import { useSafeAction } from "@/components/app/use-safe-action";
import { IconButton } from "@/components/app/icon-button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { PriorityBadge } from "./priority-badge";
import { MemberAvatars } from "./member-avatars";
import { TaskCardMenu, type GroupOption } from "./task-card-menu";
import { AddTaskInline } from "./add-task-inline";
import { cn } from "@/lib/utils";

/** 그룹 색(hex)에 알파를 붙여 옅은 틴트로. 8자리 hex(#rrggbbaa). */
function tint(hex: string, alpha: string): string {
  return `${hex}${alpha}`;
}

const DRAG_MIME = "application/x-que-task";

type DragState = { taskId: string; taskName: string; fromGroup: string } | null;

/** 보드(칸반) 뷰 — 그룹=열(가로 스크롤), 태스크=카드(세로 스크롤).
 *  카드 클릭 → 상세 드로어. 이동: 데스크톱 HTML5 드래그 + 모든 기기 공용 ⋮ 메뉴. */
export function BoardView({
  groups,
  taskHref,
}: {
  groups: BoardViewGroup[];
  taskHref: (taskId: string) => string;
}) {
  const { run } = useSafeAction();
  const [drag, setDrag] = useState<DragState>(null);

  // 모든 그룹 목록(카드 ⋮ '이동' 대상). 보드 데이터에 이미 전부 있으므로 그걸 사용.
  const allGroups: GroupOption[] = groups.map((g) => ({
    id: g.id,
    name: g.name,
    color: g.color,
  }));

  const move = (taskId: string, toGroupId: string, taskName: string, toGroupName: string) => {
    if (!taskId || !toGroupId) return;
    run(() => moveTaskAction(taskId, toGroupId), {
      success: `"${taskName}" → ${toGroupName}`,
    });
  };

  return (
    <div className="-mx-4 min-h-0 flex-1 overflow-x-auto px-4 pt-3 md:-mx-5 md:px-5 xl:-mx-6 xl:px-6">
      <div className="flex h-full min-h-0 gap-4">
        {groups.map((group) => (
          <BoardColumn
            key={group.id}
            group={group}
            taskHref={taskHref}
            allGroups={allGroups}
            drag={drag}
            onDragStart={setDrag}
            onDragEnd={() => setDrag(null)}
            onDropTask={(taskId, taskName) => move(taskId, group.id, taskName, group.name)}
          />
        ))}
      </div>
    </div>
  );
}

function BoardColumn({
  group,
  taskHref,
  allGroups,
  drag,
  onDragStart,
  onDragEnd,
  onDropTask,
}: {
  group: BoardViewGroup;
  taskHref: (taskId: string) => string;
  allGroups: GroupOption[];
  drag: DragState;
  onDragStart: (state: DragState) => void;
  onDragEnd: () => void;
  onDropTask: (taskId: string, taskName: string) => void;
}) {
  const [adding, setAdding] = useState(false);
  const [isOver, setIsOver] = useState(false);

  // 다른 그룹에서 온 카드만 드롭 대상으로 취급(같은 그룹 재정렬은 미지원).
  const canDrop = drag !== null && drag.fromGroup !== group.id;

  const onDragOver = (event: DragEvent) => {
    if (!canDrop) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
    if (!isOver) setIsOver(true);
  };

  const onDrop = (event: DragEvent) => {
    setIsOver(false);
    if (!canDrop || !drag) return;
    event.preventDefault();
    const taskId = event.dataTransfer.getData(DRAG_MIME) || drag.taskId;
    onDropTask(taskId, drag.taskName);
  };

  return (
    <section
      onDragOver={onDragOver}
      onDragLeave={() => setIsOver(false)}
      onDrop={onDrop}
      className={cn(
        "flex h-full min-h-0 w-[318px] shrink-0 flex-col rounded-xl border transition-colors sm:w-[340px]",
        isOver
          ? "border-[var(--que-brand)] ring-2 ring-[var(--que-brand)]/30"
          : "border-[var(--que-border)]",
      )}
      style={{ backgroundColor: tint(group.color, "0f") }}
    >
      <header className="flex h-14 shrink-0 items-center gap-2 pr-1.5 pl-3.5">
        <span
          className="size-2.5 shrink-0 rounded-full"
          style={{ backgroundColor: group.color }}
          aria-hidden
        />
        <h2 className="text-sm font-semibold text-[var(--que-text)]">{group.name}</h2>
        <span
          className="flex h-5 min-w-5 items-center justify-center rounded-full bg-white/70 px-1.5 text-xs font-medium text-[var(--que-text-secondary)]"
          aria-label={`${group.count}개`}
        >
          {group.count}
        </span>
        <div className="ml-auto flex items-center">
          <IconButton
            label={`${group.name} 태스크 추가`}
            onClick={() => setAdding(true)}
            className="size-10 text-[var(--que-text-secondary)]"
          >
            <Plus className="size-4" aria-hidden />
          </IconButton>
          <DropdownMenu>
            <DropdownMenuTrigger
              aria-label={`${group.name} 메뉴`}
              className="inline-flex size-10 items-center justify-center rounded-lg text-[var(--que-text-secondary)] transition-colors hover:bg-black/5 focus-visible:outline-2 focus-visible:outline-[var(--que-brand)] data-[popup-open]:bg-black/5"
            >
              <MoreHorizontal className="size-4" aria-hidden />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44">
              <DropdownMenuItem onClick={() => setAdding(true)}>
                <Plus className="size-4" aria-hidden />
                태스크 추가
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      <div className="flex min-h-0 flex-1 flex-col gap-2.5 overflow-y-auto px-2.5 pt-0.5 pb-3">
        {adding && (
          <div className="rounded-xl border border-[var(--que-border)] bg-white p-2">
            <AddTaskInline
              groupId={group.id}
              onClose={() => setAdding(false)}
              className="min-h-0 border-b-0 px-0 py-0"
            />
          </div>
        )}
        {group.tasks.length === 0 ? (
          <p className="px-1 py-6 text-center text-xs text-[var(--que-text-tertiary)]">
            {isOver ? "여기에 놓기" : "태스크 없음"}
          </p>
        ) : (
          group.tasks.map((task) => (
            <BoardCard
              key={task.id}
              task={task}
              href={taskHref(task.id)}
              groupId={group.id}
              allGroups={allGroups}
              onDragStart={onDragStart}
              onDragEnd={onDragEnd}
            />
          ))
        )}
      </div>
    </section>
  );
}

function BoardCard({
  task,
  href,
  groupId,
  allGroups,
  onDragStart,
  onDragEnd,
}: {
  task: BoardViewTask;
  href: string;
  groupId: string;
  allGroups: GroupOption[];
  onDragStart: (state: DragState) => void;
  onDragEnd: () => void;
}) {
  const [dragging, setDragging] = useState(false);

  const handleDragStart = (event: DragEvent) => {
    event.dataTransfer.setData(DRAG_MIME, task.id);
    event.dataTransfer.effectAllowed = "move";
    setDragging(true);
    onDragStart({ taskId: task.id, taskName: task.name, fromGroup: groupId });
  };

  const handleDragEnd = () => {
    setDragging(false);
    onDragEnd();
  };

  return (
    <div
      draggable
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      className={cn(
        "relative rounded-xl border border-[var(--que-border)] bg-white p-3.5 shadow-sm transition-shadow hover:shadow-md",
        dragging ? "cursor-grabbing opacity-50" : "cursor-grab",
      )}
    >
      {/* 카드 전체 클릭 → 상세 드로어. 링크는 native drag 비활성(카드 컨테이너 draggable 우선). */}
      <Link
        href={href}
        scroll={false}
        draggable={false}
        aria-label={`${task.name} 상세 열기`}
        className="absolute inset-0 z-10 rounded-xl focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[var(--que-brand)]"
      />

      <div className="flex items-start justify-between gap-2">
        <PriorityBadge priority={task.priority} />
        <TaskCardMenu
          taskId={task.id}
          taskName={task.name}
          currentGroupId={groupId}
          groups={allGroups}
          className="-mt-1.5 -mr-1.5"
        />
      </div>
      <h3 className="mt-1.5 text-sm leading-snug font-semibold text-[var(--que-text)]">
        {task.name}
      </h3>
      <p className="mt-1 line-clamp-2 text-sm leading-snug text-[var(--que-text-secondary)]">
        {task.description}
      </p>

      <div className="mt-3 flex items-center gap-1.5 text-xs text-[var(--que-text-tertiary)]">
        <CalendarDays className="size-3.5 shrink-0" aria-hidden />
        <span>{task.dueLabel ?? "마감일 미정"}</span>
      </div>

      <div className="mt-3 flex items-center justify-between gap-2">
        <MemberAvatars members={task.assignees} size={26} />
        <div className="flex items-center gap-3 text-xs text-[var(--que-text-tertiary)]">
          <span className="flex items-center gap-1" aria-label={`댓글 ${task.commentCount}개`}>
            <MessageSquare className="size-3.5 shrink-0" aria-hidden />
            {task.commentCount}
          </span>
          <span className="flex items-center gap-1" aria-label={`첨부 ${task.attachmentCount}개`}>
            <FileText className="size-3.5 shrink-0" aria-hidden />
            {task.attachmentCount}
          </span>
        </div>
      </div>
    </div>
  );
}
