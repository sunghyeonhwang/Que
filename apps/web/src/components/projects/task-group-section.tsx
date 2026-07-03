"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronDown, Plus, MoreHorizontal } from "lucide-react";
import type { ListViewGroup } from "@/lib/pm-data";
import { Checkbox } from "@/components/ui/checkbox";
import { IconButton } from "@/components/app/icon-button";
import { PriorityBadge } from "./priority-badge";
import { MemberAvatars } from "./member-avatars";
import { cn } from "@/lib/utils";

// 이름 | 설명 | 마감일 | 우선순위 | 사람들.
// 좁은 폭(태블릿 세로): 설명·마감일을 숨겨 가로 스크롤 없이 유지.
const GRID =
  "grid grid-cols-[minmax(0,1fr)_100px_84px] items-center gap-3 md:grid-cols-[minmax(0,1.4fr)_minmax(0,1.7fr)_170px_100px_92px]";

export function TaskGroupSection({
  group,
  taskHref,
}: {
  group: ListViewGroup;
  taskHref: (taskId: string) => string;
}) {
  const [open, setOpen] = useState(true);

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
          <IconButton label="태스크 추가" className="size-10 text-[var(--que-text-secondary)]">
            <Plus className="size-4" aria-hidden />
          </IconButton>
          <IconButton label="그룹 메뉴" className="size-10 text-[var(--que-text-secondary)]">
            <MoreHorizontal className="size-4" aria-hidden />
          </IconButton>
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
          </div>

          {group.tasks.map((task) => (
            <div
              key={task.id}
              className={cn(
                GRID,
                "relative min-h-[52px] border-b border-[var(--que-border)] px-3 py-2.5 transition-colors hover:bg-[var(--que-bg-muted)]",
              )}
            >
              {/* 행 전체 클릭 → 상세 드로어(URL ?task). 체크박스만 위로 올려 겹치지 않게. */}
              <Link
                href={taskHref(task.id)}
                scroll={false}
                aria-label={`${task.name} 상세 열기`}
                className="absolute inset-0 z-10 rounded-md focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[var(--que-brand)]"
              />
              <div className="flex min-w-0 items-center gap-2.5">
                <Checkbox
                  defaultChecked={task.done}
                  aria-label={`${task.name} 완료`}
                  className="relative z-20 shrink-0"
                />
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
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
