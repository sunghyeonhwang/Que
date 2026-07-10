import Link from "next/link";
import type { HomeTodoItem } from "@/lib/home-data";
import { HomeTodoToggle } from "@/components/home/home-todo-toggle";

/** 오늘 할 일 — 내 오늘/기한초과 작업. Figma 계약: 행 = [완료 토글] 제목 … (우측) 마감/기한초과 라벨
 *  **한 줄**. 프로젝트 칩·담당 아바타는 홈에서 뺀다(줄바꿈 원인 — 상세는 /today에서). */
export function HomeTodoList({ todos }: { todos: HomeTodoItem[] }) {
  if (todos.length === 0) {
    return (
      <div className="flex min-h-[220px] items-center justify-center rounded-lg border border-dashed border-[var(--que-border)] text-sm text-[var(--que-text-tertiary)]">
        오늘 마감이거나 기한이 지난 작업이 없습니다.
      </div>
    );
  }

  return (
    <ul className="flex max-h-[420px] flex-col gap-1.5 overflow-y-auto pr-0.5">
      {todos.map((todo) => (
        <li
          key={todo.id}
          className="flex min-h-11 items-center gap-2.5 rounded-lg border border-[var(--que-border)] px-3 py-2"
        >
          <HomeTodoToggle taskId={todo.id} title={todo.title} />
          <Link
            href="/today"
            className="min-w-0 flex-1 truncate text-sm font-medium text-[var(--que-text)] hover:underline"
          >
            {todo.title}
          </Link>
          {todo.overdue ? (
            <span className="shrink-0 text-xs font-medium text-[var(--que-error)]">기한 초과</span>
          ) : (
            todo.dueLabel && (
              <span className="shrink-0 text-xs text-[var(--que-text-tertiary)]">{todo.dueLabel}</span>
            )
          )}
        </li>
      ))}
    </ul>
  );
}
