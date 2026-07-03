"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronDown, Plus, MoreHorizontal } from "lucide-react";
import type { ListViewGroup } from "@/lib/pm-data";
import { IconButton } from "@/components/app/icon-button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { PriorityBadge } from "./priority-badge";
import { MemberAvatars } from "./member-avatars";
import { TaskDoneToggle } from "./task-done-toggle";
import { TaskCardMenu, type GroupOption } from "./task-card-menu";
import { AddTaskInline } from "./add-task-inline";
import { cn } from "@/lib/utils";

// 이름 | 설명 | 마감일 | 우선순위 | 사람들 | ⋮.
// 좁은 폭(태블릿 세로): 설명·마감일을 숨겨 가로 스크롤 없이 유지.
const GRID =
  "grid grid-cols-[minmax(0,1fr)_84px_40px] items-center gap-3 md:grid-cols-[minmax(0,1.4fr)_minmax(0,1.7fr)_170px_92px_84px_40px]";

export function TaskGroupSection({
  group,
  taskHref,
  allGroups,
}: {
  group: ListViewGroup;
  taskHref: (taskId: string) => string;
  /** 카드 ⋮ '이동' 대상 목록. project-view가 meta.groups(=data.groups)를 흘려준다. */
  allGroups?: GroupOption[];
}) {
  const [open, setOpen] = useState(true);
  const [adding, setAdding] = useState(false);

  const moveTargets: GroupOption[] =
    allGroups ?? [{ id: group.id, name: group.name, color: group.color }];

  const startAdding = () => {
    setOpen(true);
    setAdding(true);
  };

  return (
    <section className="mb-2">
      <div className="sticky top-0 z-20 flex h-11 items-center gap-2 rounded-lg bg-[var(--que-bg-muted)] pr-1.5 pl-2">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-label={`${group.name} 접기/펼치기`}
          className="flex size-8 items-center justify-center rounded-md text-[var(--que-text-secondary)] hover:bg-black/5 focus-visible:outline-2 focus-visible:outline-[var(--que-brand)]"
        >
          <ChevronDown
            className={cn("size-4 transition-transform", !open && "-rotate-90")}
            aria-hidden
          />
        </button>
        <span
          className="size-2.5 shrink-0 rounded-full"
          style={{ backgroundColor: group.color }}
          aria-hidden
        />
        <span className="text-sm font-semibold text-[var(--que-text)]">{group.name}</span>
        <span className="text-sm text-[var(--que-text-tertiary)]">{group.count}</span>
        <div className="ml-auto flex items-center">
          <IconButton
            label="태스크 추가"
            onClick={startAdding}
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
              <DropdownMenuItem onClick={startAdding}>
                <Plus className="size-4" aria-hidden />
                태스크 추가
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {open && (
        <div>
          <div
            className={cn(
              GRID,
              "sticky top-11 z-10 border-b border-[var(--que-border)] bg-white px-3 py-2 text-xs font-medium text-[var(--que-text-tertiary)]",
            )}
          >
            <span>이름</span>
            <span className="hidden md:block">설명</span>
            <span className="hidden md:block">마감일</span>
            <span>우선순위</span>
            <span className="text-right">사람들</span>
            <span className="sr-only">메뉴</span>
          </div>

          {group.tasks.map((task) => (
            <div
              key={task.id}
              className={cn(
                GRID,
                "relative min-h-[52px] border-b border-[var(--que-border)] px-3 py-2.5 transition-colors hover:bg-[var(--que-bg-muted)]",
              )}
            >
              {/* 행 전체 클릭 → 상세 드로어(URL ?task). 체크박스·메뉴는 위로 올려 겹치지 않게. */}
              <Link
                href={taskHref(task.id)}
                scroll={false}
                aria-label={`${task.name} 상세 열기`}
                className="absolute inset-0 z-10 rounded-md focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[var(--que-brand)]"
              />
              <div className="flex min-w-0 items-center gap-2.5">
                <TaskDoneToggle taskId={task.id} taskName={task.name} done={task.done} />
                <span
                  className={cn(
                    "min-w-0 truncate text-sm font-medium",
                    task.done
                      ? "text-[var(--que-text-tertiary)] line-through"
                      : "text-[var(--que-text)]",
                  )}
                >
                  {task.name}
                </span>
              </div>
              <p className="hidden min-w-0 text-sm text-[var(--que-text-secondary)] md:line-clamp-2">
                {task.description}
              </p>
              <span className="hidden text-sm text-[var(--que-text-secondary)] md:block">
                {task.dueLabel ?? "-"}
              </span>
              <span>
                <PriorityBadge priority={task.priority} />
              </span>
              <div className="flex justify-end">
                <MemberAvatars members={task.assignees} />
              </div>
              <div className="flex justify-end">
                <TaskCardMenu
                  taskId={task.id}
                  taskName={task.name}
                  currentGroupId={group.id}
                  groups={moveTargets}
                />
              </div>
            </div>
          ))}

          {adding && (
            <AddTaskInline groupId={group.id} onClose={() => setAdding(false)} />
          )}
        </div>
      )}
    </section>
  );
}
