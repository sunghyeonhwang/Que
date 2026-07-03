"use client";

import { TASK_STATUS_LABELS, type TaskStatus } from "@que/core";
import { changeTaskStatusAction } from "@/app/(app)/today/actions";
import { Checkbox } from "@/components/ui/checkbox";
import { useSafeAction } from "./use-safe-action";

/** 작업 목록 행 체크박스 — 기존 상태 변경 액션으로 완료/재개.
 *  체크: 완료(done). 체크 해제: 진행 중(in_progress)으로 재개. 변경은 ChangeLog에 기록된다. */
export function TaskDoneCheckbox({
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

  const toggle = () => {
    const to: TaskStatus = done ? "in_progress" : "done";
    run(() => changeTaskStatusAction({ taskId, to }), {
      success: `"${title}" → ${TASK_STATUS_LABELS[to]}`,
    });
  };

  return (
    <Checkbox
      checked={done}
      disabled={pending}
      onCheckedChange={toggle}
      aria-label={`${title} 완료 표시`}
      className={className}
    />
  );
}
