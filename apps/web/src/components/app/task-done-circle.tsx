"use client";

import type { MouseEvent } from "react";
import { TASK_STATUS_LABELS, type TaskStatus } from "@que/core";
import { changeTaskStatusAction } from "@/app/(app)/today/actions";
import { cn } from "@/lib/utils";
import { useSafeAction } from "./use-safe-action";

/** 작업 목록 행 우측의 원형 완료 버튼.
 *  TaskDoneCheckbox와 같은 상태 변경 액션(changeTaskStatusAction)을 재사용한다.
 *  체크: 완료(done). 다시 누르면 진행 중(in_progress)으로 재개. 변경은 ChangeLog에 기록된다.
 *  - 미완료: 빈 원(테두리) / 완료: green 채움 + 체크마크.
 *  - 채움·체크마크 그리기 전환은 globals.css의 .que-done-circle CSS로 처리한다(reduced-motion 존중).
 *  - 행 전체 클릭(상세 Sheet)과 겹치지 않도록 z-10 + stopPropagation. */
export function TaskDoneCircle({
  taskId,
  title,
  status,
  className,
}: {
  taskId: string;
  title: string;
  status: TaskStatus;
  className?: string;
}) {
  const { run, pending } = useSafeAction();
  const done = status === "done";

  const toggle = (event: MouseEvent<HTMLButtonElement>) => {
    // 부모 행의 상세 Sheet 트리거로 이벤트가 전파되지 않게 막는다.
    event.stopPropagation();
    const to: TaskStatus = done ? "in_progress" : "done";
    run(() => changeTaskStatusAction({ taskId, to }), {
      success: `"${title}" → ${TASK_STATUS_LABELS[to]}`,
    });
  };

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={pending}
      aria-pressed={done}
      aria-label={done ? `${title} 완료 해제` : `${title} 완료로 표시`}
      data-done={done ? "" : undefined}
      className={cn(
        "que-done-circle relative flex size-10 shrink-0 items-center justify-center rounded-full outline-none",
        "focus-visible:ring-2 focus-visible:ring-[var(--que-brand)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--que-bg)]",
        "disabled:cursor-not-allowed disabled:opacity-60",
        className,
      )}
    >
      <span className="que-done-circle-ring flex size-6 items-center justify-center rounded-full">
        <svg viewBox="0 0 24 24" className="size-4" aria-hidden focusable="false">
          <path className="que-done-circle-mark" d="M5 12.5 L10 17.5 L19 7.5" />
        </svg>
      </span>
    </button>
  );
}
