"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  TASK_STATUS_LABELS,
  type StatusDetail,
  type TaskStatus,
} from "@que/core";
import { changeTaskStatusAction } from "@/app/(app)/today/actions";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { StatusBadge } from "./status-badge";
import { StatusDetailForm } from "./status-detail-form";

/** 상태 변경 버튼 순서 — 기획서 "작업 상세 패널"의 주요 상태 버튼 기준 */
const STATUS_CHOICES: TaskStatus[] = [
  "in_progress",
  "done",
  "needs_reschedule",
  "on_hold",
  "issue",
  "cancelled",
];

const NEEDS_DETAIL: TaskStatus[] = ["issue", "on_hold"];

export interface TaskRowData {
  id: string;
  title: string;
  status: TaskStatus;
  timeText: string;
  metaText?: string;
}

/** 작업 row 클릭 → 상세 Sheet에서 원터치 상태 변경. 문제발생/홀드는 사유 입력. */
export function TaskStatusSheet({
  task,
  children,
}: {
  task: TaskRowData;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [detailFor, setDetailFor] = useState<TaskStatus | null>(null);

  const change = (to: TaskStatus, detail?: StatusDetail) => {
    startTransition(async () => {
      const result = await changeTaskStatusAction({ taskId: task.id, to, detail });
      if (result.ok) {
        toast.success(`"${task.title}" → ${TASK_STATUS_LABELS[to]}`);
        setDetailFor(null);
        setOpen(false);
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  };

  return (
    <Sheet
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setDetailFor(null);
      }}
    >
      <SheetTrigger
        render={
          <button
            type="button"
            className="w-full rounded-md text-left focus-visible:outline-2 focus-visible:outline-ring"
            aria-label={`${task.title} 상세 열기`}
          />
        }
      >
        {children}
      </SheetTrigger>
      <SheetContent side="right" className="w-full max-w-md overflow-y-auto p-5">
        <SheetHeader className="p-0 pb-4 text-left">
          <SheetTitle>{task.title}</SheetTitle>
          <SheetDescription>
            {task.timeText}
            {task.metaText ? ` · ${task.metaText}` : ""}
          </SheetDescription>
        </SheetHeader>

        <div className="mb-4 flex items-center gap-2 text-sm">
          현재 상태 <StatusBadge status={task.status} />
        </div>

        <div className="grid grid-cols-3 gap-2" role="group" aria-label="상태 변경">
          {STATUS_CHOICES.map((status) => (
            <Button
              key={status}
              variant={
                status === "issue" || status === "cancelled" ? "destructive" : "outline"
              }
              className="h-10"
              disabled={pending || status === task.status}
              onClick={() => {
                if (NEEDS_DETAIL.includes(status)) {
                  setDetailFor((current) => (current === status ? null : status));
                } else {
                  change(status);
                }
              }}
            >
              {TASK_STATUS_LABELS[status]}
            </Button>
          ))}
        </div>

        {detailFor && (
          <div className="mt-4 rounded-md border p-3">
            <StatusDetailForm
              submitLabel={`${TASK_STATUS_LABELS[detailFor]}(으)로 변경`}
              pending={pending}
              onSubmit={(detail) => change(detailFor, detail)}
            />
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
