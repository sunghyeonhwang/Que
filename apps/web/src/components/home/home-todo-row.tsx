"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { toast } from "sonner";
import type { HomeTodoItem } from "@/lib/home-data";
import { toggleHomeTaskDoneAction } from "@/app/(app)/home/task-actions";
import { DoneCircle } from "@/components/app/done-circle";
import { reportError } from "@/lib/report-error";
import { UNEXPECTED_ERROR_MESSAGE } from "@/components/app/use-safe-action";
import { cn } from "@/lib/utils";

// 홈 '오늘 할 일' 행 — /today와 같은 DoneCircle(컨페티) 재사용 + **낙관적 즉시 반영**.
// 홈 refresh(전체 번들 재조립)는 느려서 안 쓴다: 클릭 즉시 절취선, 서버 커밋은 백그라운드,
// 실패 시에만 롤백+토스트. 완료해도 행은 사라지지 않는다(데이터가 완료분 포함 — 절취선 유지).

export function HomeTodoRow({ todo }: { todo: HomeTodoItem }) {
  const [done, setDone] = useState(todo.done);
  const [, startTransition] = useTransition();

  const toggle = (nextDone: boolean) => {
    setDone(nextDone); // 낙관적 — 컨페티는 DoneCircle이 즉시 발사
    startTransition(async () => {
      try {
        const result = await toggleHomeTaskDoneAction({ taskId: todo.id, done: nextDone });
        if (!result.ok) {
          setDone(!nextDone); // 도메인 규칙 거부 — 롤백
          toast.error(result.error);
        }
      } catch (error) {
        setDone(!nextDone);
        reportError(error, { source: "home-todo-toggle" });
        toast.error(UNEXPECTED_ERROR_MESSAGE);
      }
    });
  };

  return (
    <li className="flex min-h-11 items-center gap-2.5 rounded-lg border border-[var(--que-border)] px-3 py-2">
      <DoneCircle
        done={done}
        markLabel={`‘${todo.title}’ 완료로 표시`}
        unmarkLabel={`‘${todo.title}’ 완료 해제`}
        onToggle={toggle}
      />
      <Link
        href="/today"
        className={cn(
          "min-w-0 flex-1 truncate text-sm font-medium hover:underline",
          done ? "text-[var(--que-text-tertiary)] line-through" : "text-[var(--que-text)]",
        )}
      >
        {todo.title}
      </Link>
      {done ? (
        <span className="shrink-0 text-xs font-medium text-[var(--que-success)]">완료</span>
      ) : todo.overdue ? (
        <span className="shrink-0 text-xs font-medium text-[var(--que-error)]">기한 초과</span>
      ) : (
        todo.dueLabel && (
          <span className="shrink-0 text-xs text-[var(--que-text-tertiary)]">{todo.dueLabel}</span>
        )
      )}
    </li>
  );
}
