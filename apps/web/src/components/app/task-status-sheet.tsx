"use client";

import { useState } from "react";
import {
  TASK_STATUS_LABELS,
  type StatusDetail,
  type TaskStatus,
} from "@que/core";
import { changeTaskStatusAction } from "@/app/(app)/today/actions";
import { moveTaskToDateAction } from "@/app/(app)/calendar/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field, FieldLabel } from "@/components/ui/field";
import { Separator } from "@/components/ui/separator";
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
import { useSafeAction } from "./use-safe-action";

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
  /** 일정 변경 폼 프리필용 시작 시각 (ISO) */
  startAt?: string;
}

/** 작업 row 클릭 → 상세 Sheet에서 원터치 상태 변경. 문제발생/홀드는 사유 입력. */
export function TaskStatusSheet({
  task,
  children,
}: {
  task: TaskRowData;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const { run, pending } = useSafeAction();
  const [detailFor, setDetailFor] = useState<TaskStatus | null>(null);

  const change = (to: TaskStatus, detail?: StatusDetail) => {
    run(() => changeTaskStatusAction({ taskId: task.id, to, detail }), {
      success: `"${task.title}" → ${TASK_STATUS_LABELS[to]}`,
      onSuccess: () => {
        setDetailFor(null);
        setOpen(false);
      },
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

        <Separator className="my-5" />
        <ScheduleMoveForm
          taskId={task.id}
          taskTitle={task.title}
          startAt={task.startAt}
          onDone={() => setOpen(false)}
        />
      </SheetContent>
    </Sheet>
  );
}

/** 드래그가 어려운 터치 환경용 날짜/시간 변경 폼 (DESIGN.md 11장). */
function ScheduleMoveForm({
  taskId,
  taskTitle,
  startAt,
  onDone,
}: {
  taskId: string;
  taskTitle: string;
  startAt?: string;
  onDone: () => void;
}) {
  const initial = startAt ? new Date(startAt) : new Date();
  const [date, setDate] = useState(
    `${initial.getFullYear()}-${String(initial.getMonth() + 1).padStart(2, "0")}-${String(initial.getDate()).padStart(2, "0")}`,
  );
  const [time, setTime] = useState(
    `${String(initial.getHours()).padStart(2, "0")}:${String(initial.getMinutes()).padStart(2, "0")}`,
  );
  const { run, pending } = useSafeAction();

  const submit = () => {
    const hour = Number(time.split(":")[0]);
    run(() => moveTaskToDateAction({ taskId, date, hour }), {
      success: `"${taskTitle}" 일정이 변경되어 로그에 기록됐습니다.`,
      onSuccess: onDone,
    });
  };

  return (
    <div>
      <h3 className="mb-2 text-sm font-medium">날짜/시간 변경</h3>
      <div className="grid grid-cols-2 gap-3">
        <Field>
          <FieldLabel htmlFor="move-date">날짜</FieldLabel>
          <Input
            id="move-date"
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="move-time">시작 시간</FieldLabel>
          <Input
            id="move-time"
            type="time"
            value={time}
            onChange={(e) => setTime(e.target.value)}
          />
        </Field>
      </div>
      <Button
        variant="secondary"
        className="mt-3 h-10 w-full"
        disabled={pending || !date}
        onClick={submit}
      >
        {pending ? "변경 중…" : "일정 변경"}
      </Button>
    </div>
  );
}
