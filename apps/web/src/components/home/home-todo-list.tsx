import Link from "next/link";
import { Clock, Folder } from "lucide-react";
import type { HomeTodoItem } from "@/lib/home-data";
import { MemberAvatars } from "@/components/projects/member-avatars";
import { HomeTodoToggle } from "@/components/home/home-todo-toggle";

/** 오늘 할 일 — 내 오늘/기한초과 작업. 내부 세로 스크롤. 행 클릭은 작업 목록으로. */
export function HomeTodoList({ todos }: { todos: HomeTodoItem[] }) {
  if (todos.length === 0) {
    return (
      <div className="flex min-h-[220px] items-center justify-center rounded-lg border border-dashed border-[var(--que-border)] text-sm text-[var(--que-text-tertiary)]">
        오늘 마감이거나 기한이 지난 작업이 없습니다.
      </div>
    );
  }

  return (
    <ul className="flex max-h-[420px] flex-col gap-2 overflow-y-auto pr-0.5">
      {todos.map((todo) => (
        <li
          key={todo.id}
          className="rounded-lg border border-[var(--que-border)] p-3"
        >
          <div className="flex items-start gap-2">
            <HomeTodoToggle taskId={todo.id} title={todo.title} />
            <p className="flex-1 pt-1.5 text-sm font-medium text-[var(--que-text)]">
              {todo.title}
            </p>
            {todo.overdue ? (
              <span className="shrink-0 rounded-full bg-[var(--que-error-bg)] px-2 py-0.5 text-xs font-medium text-[var(--que-error)]">
                기한 초과
              </span>
            ) : (
              <span className="shrink-0 rounded-full bg-[var(--que-brand-subtle)] px-2 py-0.5 text-xs font-medium text-[var(--que-brand)]">
                {todo.statusLabel}
              </span>
            )}
          </div>

          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1.5">
            {todo.category && (
              <span className="inline-flex items-center gap-1.5 rounded-md border border-[var(--que-border)] px-2 py-1 text-xs text-[var(--que-text-secondary)]">
                <Folder className="size-3.5 text-[var(--que-text-tertiary)]" aria-hidden />
                {todo.category}
              </span>
            )}
            {todo.dueLabel && (
              <span className="inline-flex items-center gap-1.5 text-xs text-[var(--que-text-tertiary)]">
                <Clock className="size-3.5" aria-hidden />
                {todo.dueLabel}
              </span>
            )}
          </div>

          <div className="mt-3 flex items-center justify-between border-t border-[var(--que-border)] pt-2.5">
            <MemberAvatars members={todo.assignees} size={24} />
            <Link
              href="/today"
              className="flex min-h-9 items-center text-xs font-medium text-[var(--que-brand)] hover:underline"
            >
              자세히 보기
            </Link>
          </div>
        </li>
      ))}
    </ul>
  );
}
