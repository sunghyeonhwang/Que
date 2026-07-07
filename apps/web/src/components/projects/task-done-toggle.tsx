"use client";

import { toggleTaskDoneAction } from "@/app/(app)/projects/pm-actions";
import { useSafeAction } from "@/components/app/use-safe-action";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";

/** 리스트 행 완료 체크박스 — done ↔ in_progress. 행 전체 상세 열기 Link 위(z-20)에서 전파를 차단한다. */
export function TaskDoneToggle({
  taskId,
  taskTitle,
  done,
  disabled,
  className,
}: {
  taskId: string;
  taskTitle: string;
  done: boolean;
  disabled?: boolean;
  className?: string;
}) {
  const { run, pending } = useSafeAction();

  const toggle = () => {
    run(() => toggleTaskDoneAction({ taskId, done: !done }), {
      success: done ? `"${taskTitle}" 완료 해제` : `"${taskTitle}" 완료`,
    });
  };

  return (
    <Checkbox
      checked={done}
      disabled={pending || disabled}
      onCheckedChange={toggle}
      onPointerDown={(event) => event.stopPropagation()}
      onClick={(event) => event.stopPropagation()}
      aria-label={`${taskTitle} 완료`}
      // 목록 행 완료 토글의 실제 터치 히트박스를 40px로 확대한다.
      // (ui/checkbox 기본 after:-inset-y-2=32px를 세로 -inset-y-3=40px로 덮어씀 — 전역 미변경)
      className={cn("relative z-20 shrink-0 after:-inset-y-3", className)}
    />
  );
}
