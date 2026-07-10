"use client";

import { Check, Circle } from "lucide-react";
import { toggleHomeTaskDoneAction } from "@/app/(app)/home/task-actions";
import { useSafeAction } from "@/components/app/use-safe-action";
import { cn } from "@/lib/utils";

// 홈 '오늘 할 일' 완료 토글 — core changeTaskStatus 경유(권한·ChangeLog는 서버가 강제).
// 성공 시 useSafeAction이 router.refresh로 홈을 다시 그린다(완료 항목이 목록에서 빠짐).

/** 원형 완료 버튼. done=false(오늘 할 일은 전부 미완료)에서 눌러 done 처리한다. */
export function HomeTodoToggle({ taskId, title }: { taskId: string; title: string }) {
  const { run, pending } = useSafeAction();

  const toggle = () => {
    if (pending) return;
    run(() => toggleHomeTaskDoneAction({ taskId, done: true }), {
      success: "완료로 표시했습니다.",
    });
  };

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={pending}
      aria-label={`‘${title}’ 완료로 표시`}
      className={cn(
        "group flex size-10 shrink-0 items-center justify-center rounded-full border border-[var(--que-border)] text-[var(--que-text-tertiary)] transition-colors",
        "hover:border-[var(--que-success)] hover:bg-[var(--que-success-bg)] hover:text-[var(--que-success)]",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50",
      )}
    >
      <Circle className="size-5 group-hover:hidden" aria-hidden />
      <Check className="hidden size-5 group-hover:block" aria-hidden />
    </button>
  );
}
