"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import type { ProjectMeta } from "@/lib/projects-data";
import { createTaskAction } from "@/app/(app)/projects/pm-actions";
import { useSafeAction } from "@/components/app/use-safe-action";
import {
  ASSIGNEE_ME,
  TaskFormFields,
  emptyTaskFormValue,
  taskFormErrors,
  taskFormEstimatedHours,
  taskFormToIso,
  type TaskFormValue,
} from "@/components/app/task-form-fields";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

/**
 * 태스크 생성 Dialog — 공통 필드(task-form-fields)를 쓴다. 프로젝트는 현재 스코프로 고정이라
 * 셀렉트를 숨긴다. 새 카드는 항상 예정(scheduled)으로 생성. 담당자 미지정 시 core가 본인 배정.
 * 시작일을 함께 받으므로 간트에서 기간 막대로 그려진다(마감만 넣으면 하루 막대).
 */
export function CreateTaskDialog({ projectId, meta }: { projectId: string; meta: ProjectMeta }) {
  const { run, pending } = useSafeAction();
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState<TaskFormValue>(emptyTaskFormValue());
  // blur 없이도 제출 시도 후에는 필수 에러를 노출한다(입력 전 침묵).
  const [submitAttempted, setSubmitAttempted] = useState(false);

  const errors = taskFormErrors(value);
  const canSubmit = !errors.title && !errors.range && !pending;

  const reset = () => {
    setValue(emptyTaskFormValue());
    setSubmitAttempted(false);
  };

  const submit = () => {
    setSubmitAttempted(true);
    if (!canSubmit) return;
    const { startAt, endAt } = taskFormToIso(value);
    run(
      () =>
        createTaskAction({
          projectId,
          title: value.title.trim(),
          description: value.description.trim() || undefined,
          startAt,
          endAt,
          priority: value.priority,
          assigneeId: value.assigneeId === ASSIGNEE_ME ? undefined : value.assigneeId,
          estimatedHours: taskFormEstimatedHours(value),
        }),
      {
        success: `"${value.title.trim()}" 작업을 추가했습니다.`,
        onSuccess: () => {
          reset();
          setOpen(false);
        },
      },
    );
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) reset();
      }}
    >
      <DialogTrigger
        render={
          <Button className="h-10 gap-1.5 rounded-lg bg-[var(--que-brand)] px-3.5 text-[var(--que-on-brand)] hover:bg-[var(--que-brand-hover)]" />
        }
      >
        <Plus className="size-4" aria-hidden />
        새로 추가
      </DialogTrigger>
      <DialogContent className="max-h-[calc(100dvh-3rem)] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>새 작업</DialogTitle>
          <DialogDescription>작업 정보를 입력해 예정 열에 추가합니다.</DialogDescription>
        </DialogHeader>

        <TaskFormFields
          value={value}
          onChange={setValue}
          members={meta.members}
          idPrefix="ct"
          autoFocusTitle
          showTitleError={submitAttempted}
          onSubmit={submit}
        />

        <DialogFooter>
          <Button variant="outline" className="h-10" onClick={() => setOpen(false)}>
            취소
          </Button>
          <Button
            className="h-10 bg-[var(--que-brand)] text-[var(--que-on-brand)] hover:bg-[var(--que-brand-hover)]"
            disabled={!canSubmit}
            onClick={submit}
          >
            {pending ? "추가 중…" : "추가"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
