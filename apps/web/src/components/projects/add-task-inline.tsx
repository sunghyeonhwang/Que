"use client";

import { useRef, useState, type KeyboardEvent } from "react";
import { Plus } from "lucide-react";
import { createTaskAction } from "@/app/(app)/projects/pm-actions";
import { useSafeAction } from "@/components/app/use-safe-action";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

/** 예정 열의 인라인 태스크 추가 입력행. 새 카드는 항상 예정(scheduled)으로 생성된다.
 *  Enter 제출(성공 시 비우고 포커스 유지 → 연속 입력) / Esc·빈 값 blur → 닫기. */
export function AddTaskInline({
  projectId,
  onClose,
  className,
}: {
  projectId: string;
  onClose: () => void;
  className?: string;
}) {
  const { run, pending } = useSafeAction();
  const [title, setTitle] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const submit = () => {
    const trimmed = title.trim();
    if (!trimmed || pending) return;
    run(() => createTaskAction({ projectId, title: trimmed }), {
      success: `"${trimmed}" 추가됨`,
      onSuccess: () => {
        setTitle("");
        inputRef.current?.focus();
      },
    });
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") {
      event.preventDefault();
      submit();
    } else if (event.key === "Escape") {
      event.preventDefault();
      onClose();
    }
  };

  return (
    <div
      className={cn(
        "flex min-h-[52px] items-center gap-2.5 border-b border-[var(--que-border)] px-3 py-2",
        className,
      )}
    >
      <Plus className="size-4 shrink-0 text-[var(--que-text-tertiary)]" aria-hidden />
      <Input
        ref={inputRef}
        autoFocus
        value={title}
        disabled={pending}
        placeholder="작업 이름 입력 후 Enter"
        aria-label="새 작업 이름"
        onChange={(event) => setTitle(event.target.value)}
        onKeyDown={onKeyDown}
        onBlur={() => {
          if (!title.trim()) onClose();
        }}
        className="h-9 flex-1"
      />
    </div>
  );
}
