"use client";

import { useState } from "react";
import { TASK_STATUS_LABELS, type TaskStatus } from "@que/core";
import { changeTaskStatusAction } from "@/app/(app)/today/actions";
import { DoneCircle } from "./done-circle";
import { useOptimisticAction } from "./use-optimistic-action";

/** 작업 목록 행 우측의 원형 완료 버튼.
 *  공용 DoneCircle(빈 원 → green 채움 + 체크마크 + 폭죽)을 작업 상태 변경에 연결한다.
 *  체크: 완료(done). 다시 누르면 진행 중(in_progress)으로 재개. 변경은 ChangeLog에 기록된다.
 *  - 완료로 갈 때만 폭죽(되돌리기엔 생략) — DoneCircle 내부에서 처리.
 *  - 행 전체 클릭(상세 Sheet)과 겹치지 않도록 호출부에서 z-10 래핑, 여기선 stopPropagation. */
export function TaskDoneCircle({
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
  // 클릭 즉시 원을 채우고(컨페티는 DoneCircle이 발사) 서버는 백그라운드로 커밋 — 실패 시 롤백.
  const [done, setDone] = useState(status === "done");
  const { run } = useOptimisticAction();

  const onToggle = (nextDone: boolean) => {
    const to: TaskStatus = nextDone ? "done" : "in_progress";
    run(() => changeTaskStatusAction({ taskId, to }), {
      apply: () => setDone(nextDone),
      rollback: () => setDone(!nextDone),
      success: `"${title}" → ${TASK_STATUS_LABELS[to]}`,
      source: "task-done-toggle",
    });
  };

  return (
    <DoneCircle
      done={done}
      markLabel={`${title} 완료로 표시`}
      unmarkLabel={`${title} 완료 해제`}
      onToggle={onToggle}
      className={className}
    />
  );
}
