"use client";

import { useState } from "react";
import type { StatusDetail } from "@que/core";
import type { BoardColumn } from "@/lib/projects-data";
import { moveTaskAction } from "@/app/(app)/projects/pm-actions";
import { useSafeAction } from "@/components/app/use-safe-action";
import { TaskGroupSection } from "./task-group-section";
import { BlockedStatusDialog, type BlockedStatus } from "./blocked-status-dialog";

type BlockedTarget = { taskId: string; taskTitle: string } | null;

/** 목록 뷰 — 보드와 동일한 4열을 세로 섹션으로. 홀드·문제 이동은 공용 사유 Dialog를 거친다. */
export function ListView({
  columns,
  projectId,
  taskHref,
  showProject = false,
  allowCreate = true,
}: {
  columns: BoardColumn[];
  projectId: string;
  taskHref: (taskId: string) => string;
  /** 전체 보기: 각 행에 소속 프로젝트명 라벨 표시. */
  showProject?: boolean;
  /** 태스크 추가(+) 노출 여부. 전체 보기에선 대상 프로젝트가 없어 false. */
  allowCreate?: boolean;
}) {
  const { run, pending } = useSafeAction();
  const [blocked, setBlocked] = useState<BlockedTarget>(null);

  const confirmBlocked = (to: BlockedStatus, detail: StatusDetail) => {
    if (!blocked) return;
    const target = blocked;
    run(() => moveTaskAction({ taskId: target.taskId, to, detail }), {
      success: `"${target.taskTitle}" 이동됨`,
      onSuccess: () => setBlocked(null),
    });
  };

  return (
    <div className="-mx-4 min-h-0 flex-1 overflow-y-auto px-4 pt-3 md:-mx-5 md:px-5 xl:-mx-6 xl:px-6">
      {columns.map((column) => (
        <TaskGroupSection
          key={column.key}
          column={column}
          projectId={projectId}
          taskHref={taskHref}
          showProject={showProject}
          allowCreate={allowCreate}
          onBlocked={(card) => setBlocked(card)}
        />
      ))}

      <BlockedStatusDialog
        open={blocked !== null}
        onOpenChange={(next) => {
          if (!next) setBlocked(null);
        }}
        taskTitle={blocked?.taskTitle ?? ""}
        pending={pending}
        onConfirm={confirmBlocked}
      />
    </div>
  );
}
