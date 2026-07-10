import type { HomeTodoItem } from "@/lib/home-data";
import { HomeTodoRow } from "@/components/home/home-todo-row";

/** 오늘 할 일 — 내 오늘/기한초과 작업(완료 포함 — 절취선 유지). 행 = [완료 토글] 제목 … 우측 라벨 한 줄. */
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
        <HomeTodoRow key={todo.id} todo={todo} />
      ))}
    </ul>
  );
}
