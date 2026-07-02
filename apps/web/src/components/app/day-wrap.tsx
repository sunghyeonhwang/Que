"use client";

import { format } from "date-fns";
import { ArrowRight, Check } from "lucide-react";
import type { Task } from "@que/core";
import { deferTaskToTomorrowAction } from "@/app/(app)/today/actions";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "./status-badge";
import { useSafeAction } from "./use-safe-action";

/** 하루 마감 요약 — 오늘 완료/미완료를 정리하고, 미완료를 내일로 넘긴다. */
export function DayWrap({
  doneToday,
  unfinished,
}: {
  doneToday: Task[];
  unfinished: Task[];
}) {
  const { run, pending } = useSafeAction();

  const defer = (task: Task) => {
    run(() => deferTaskToTomorrowAction(task.id), {
      success: `"${task.title}" 작업을 내일로 옮기고 변경 로그에 기록했습니다.`,
    });
  };

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-muted-foreground">
        <Check className="mr-1 inline size-3.5" aria-hidden />
        오늘 완료 {doneToday.length}건
        {unfinished.length > 0 ? ` · 미완료 ${unfinished.length}건` : " · 미완료 없음"}
      </p>
      {unfinished.map((task) => (
        <div key={task.id} className="flex min-h-10 items-center gap-2 rounded-md border px-3 py-1.5">
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm">{task.title}</span>
            {task.startAt && (
              <span className="block text-xs tabular-nums text-muted-foreground">
                {format(new Date(task.startAt), "HH:mm")} 시작 예정이었음
              </span>
            )}
          </span>
          <StatusBadge status={task.status} />
          <Button
            variant="outline"
            size="sm"
            className="h-9"
            disabled={pending || !task.startAt}
            onClick={() => defer(task)}
          >
            내일로 <ArrowRight className="size-3.5" aria-hidden />
          </Button>
        </div>
      ))}
      {unfinished.length === 0 && doneToday.length > 0 && (
        <p className="text-sm">오늘 몫을 전부 끝냈습니다. 수고하셨어요.</p>
      )}
    </div>
  );
}
