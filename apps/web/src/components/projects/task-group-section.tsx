"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronDown, Plus, Lock, AlertTriangle } from "lucide-react";
import { TASK_STATUS_LABELS } from "@que/core";
import type { BoardColumn } from "@/lib/projects-data";
import { TONE_STYLE, COLUMN_TONE } from "@/lib/pm-columns";
import { IconButton } from "@/components/app/icon-button";
import { StatusBadge } from "@/components/app/status-badge";
import { PriorityBadge } from "./priority-badge";
import { MemberAvatars } from "./member-avatars";
import { TaskDoneToggle } from "./task-done-toggle";
import { TaskCardMenu } from "./task-card-menu";
import { AddTaskInline } from "./add-task-inline";
import { cn } from "@/lib/utils";

// 이름 | 마감일 | 우선순위 | 담당자 | ⋮.
// 좁은 폭(태블릿 세로): 마감일을 숨겨 가로 스크롤 없이 유지.
const GRID =
  "grid grid-cols-[minmax(0,1fr)_92px_84px_40px] items-center gap-3 md:grid-cols-[minmax(0,1.6fr)_170px_92px_84px_40px]";

export function TaskGroupSection({
  column,
  projectId,
  taskHref,
  onBlocked,
}: {
  column: BoardColumn;
  projectId: string;
  taskHref: (taskId: string) => string;
  onBlocked: (card: { taskId: string; taskTitle: string }) => void;
}) {
  const [open, setOpen] = useState(true);
  const [adding, setAdding] = useState(false);
  const tone = TONE_STYLE[COLUMN_TONE[column.key]];
  const showAdd = column.key === "scheduled";

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
          aria-label={`${column.label} 접기/펼치기`}
          className="flex size-8 items-center justify-center rounded-md text-[var(--que-text-secondary)] hover:bg-[var(--que-bg-muted)] focus-visible:outline-2 focus-visible:outline-[var(--que-brand)]"
        >
          <ChevronDown
            className={cn("size-4 transition-transform", !open && "-rotate-90")}
            aria-hidden
          />
        </button>
        <span className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: tone.dot }} aria-hidden />
        <span className="text-sm font-semibold text-[var(--que-text)]">{column.label}</span>
        <span className="text-sm text-[var(--que-text-tertiary)]">{column.count}</span>
        {showAdd && (
          <div className="ml-auto flex items-center">
            <IconButton
              label="예정 열에 태스크 추가"
              onClick={startAdding}
              className="size-10 text-[var(--que-text-secondary)]"
            >
              <Plus className="size-4" aria-hidden />
            </IconButton>
          </div>
        )}
      </div>

      {open && (
        <div>
          <div
            className={cn(
              GRID,
              "sticky top-11 z-10 border-b border-[var(--que-border)] bg-[var(--que-bg)] px-3 py-2 text-xs font-medium text-[var(--que-text-tertiary)]",
            )}
          >
            <span>이름</span>
            <span className="hidden md:block">마감일</span>
            <span>우선순위</span>
            <span className="text-right">담당자</span>
            <span className="sr-only">메뉴</span>
          </div>

          {column.cards.map((card) => {
            const done = card.status === "done";
            // 컬럼 라벨이 상태를 그대로 말해주는 status는 sr-only, 애매한 status만 시각 뱃지.
            const columnConveysStatus =
              card.status === "scheduled" ||
              card.status === "in_progress" ||
              card.status === "done";
            return (
              <div
                key={card.taskId}
                className={cn(
                  GRID,
                  "relative min-h-[52px] border-b border-[var(--que-border)] px-3 py-2.5 transition-colors hover:bg-[var(--que-bg-muted)]",
                )}
              >
                {/* 행 전체 클릭 → 상세 드로어(URL ?task). 체크박스·메뉴는 위로 올려 겹치지 않게. */}
                <Link
                  href={taskHref(card.taskId)}
                  scroll={false}
                  aria-label={`${card.title} 상세 열기`}
                  className="absolute inset-0 z-10 rounded-md focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[var(--que-brand)]"
                />
                <div className="flex min-w-0 items-center gap-2.5">
                  <TaskDoneToggle
                    taskId={card.taskId}
                    taskTitle={card.title}
                    done={done}
                    disabled={!card.canEdit}
                  />
                  <span
                    className={cn(
                      "min-w-0 truncate text-sm font-medium",
                      done
                        ? "text-[var(--que-text-tertiary)] line-through"
                        : "text-[var(--que-text)]",
                    )}
                  >
                    {card.title}
                  </span>
                  {columnConveysStatus ? (
                    <span className="sr-only">상태: {TASK_STATUS_LABELS[card.status]}</span>
                  ) : (
                    <span className="relative z-20 shrink-0">
                      <StatusBadge status={card.status} />
                    </span>
                  )}
                </div>
                <span
                  className={cn(
                    "hidden items-center gap-1 text-sm md:flex",
                    card.isOverdue
                      ? "font-medium text-[var(--que-error)]"
                      : "text-[var(--que-text-secondary)]",
                  )}
                >
                  {card.isOverdue ? (
                    <AlertTriangle className="size-3.5 shrink-0" aria-hidden />
                  ) : null}
                  {card.dueLabel ?? "-"}
                  {card.isOverdue ? <span className="sr-only">(기한 초과)</span> : null}
                </span>
                <span>
                  <PriorityBadge priority={card.priority} />
                </span>
                <div className="flex justify-end">
                  <MemberAvatars members={card.assignee ? [card.assignee] : []} />
                </div>
                <div className="flex justify-end">
                  {card.canEdit ? (
                    <TaskCardMenu
                      taskId={card.taskId}
                      taskTitle={card.title}
                      currentColumn={card.columnKey}
                      onBlocked={() => onBlocked({ taskId: card.taskId, taskTitle: card.title })}
                    />
                  ) : (
                    <span
                      className="relative z-20 flex size-10 items-center justify-center text-[var(--que-text-tertiary)]"
                      title="읽기 전용"
                      aria-label="읽기 전용"
                    >
                      <Lock className="size-3.5" aria-hidden />
                    </span>
                  )}
                </div>
              </div>
            );
          })}

          {column.cards.length === 0 && !adding && (
            <p className="px-3 py-6 text-center text-xs text-[var(--que-text-tertiary)]">
              태스크 없음
            </p>
          )}

          {adding && showAdd && (
            <AddTaskInline projectId={projectId} onClose={() => setAdding(false)} />
          )}
        </div>
      )}
    </section>
  );
}
