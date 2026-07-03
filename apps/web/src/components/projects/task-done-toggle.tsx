"use client";

import { toggleTaskDoneAction } from "@/app/(app)/projects/pm-actions";
import { useSafeAction } from "@/components/app/use-safe-action";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";

/** 리스트 행 완료 체크박스 — 제어형. 행 전체 상세 열기 Link 위(z-20)에서 전파를 차단한다. */
export function TaskDoneToggle({
  taskId,
  taskName,
  done,
  className,
}: {
  taskId: string;
  taskName: string;
  done: boolean;
  className?: string;
}) {
  const { run, pending } = useSafeAction();

  const toggle = () => {
    run(() => toggleTaskDoneAction(taskId, !done), {
      success: done ? `"${taskName}" 완료 해제` : `"${taskName}" 완료`,
    });
  };

  return (
    <Checkbox
      checked={done}
      disabled={pending}
      onCheckedChange={toggle}
      onPointerDown={(event) => event.stopPropagation()}
      onClick={(event) => event.stopPropagation()}
      aria-label={`${taskName} 완료`}
      className={cn("relative z-20 shrink-0", className)}
    />
  );
}
