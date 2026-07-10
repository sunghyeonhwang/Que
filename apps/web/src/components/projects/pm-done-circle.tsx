"use client";

import { useState } from "react";
import { toggleTaskDoneAction } from "@/app/(app)/projects/pm-actions";
import { DoneCircle } from "@/components/app/done-circle";
import { useOptimisticAction } from "@/components/app/use-optimistic-action";

/** /projects 목록·보드 행/카드의 원형 완료 버튼.
 *  공용 DoneCircle(빈 원 → green 채움 + 체크마크 + 폭죽)을 PM 완료 토글(pm-actions)에 연결한다.
 *  체크: 완료(done). 다시 누르면 진행 중(in_progress)으로 재개. 변경은 core가 ChangeLog(via:web)로 기록.
 *  - 완료로 갈 때만 폭죽(되돌리기엔 생략) — DoneCircle 내부에서 처리.
 *  - 행/카드 전체 클릭(상세 Link)과 겹치지 않도록 호출부에서 z 래핑, 여기선 stopPropagation(DoneCircle 내장). */
export function PmDoneCircle({
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
  // 클릭 즉시 완료 표시(컨페티) 후 서버 백그라운드 커밋 — 실패 시 롤백.
  const [localDone, setLocalDone] = useState(done);
  const { run } = useOptimisticAction();

  const onToggle = (nextDone: boolean) => {
    run(() => toggleTaskDoneAction({ taskId, done: nextDone }), {
      apply: () => setLocalDone(nextDone),
      rollback: () => setLocalDone(!nextDone),
      success: nextDone ? `"${taskTitle}" 완료` : `"${taskTitle}" 완료 해제`,
      source: "pm-done-toggle",
    });
  };

  return (
    <DoneCircle
      done={localDone}
      pending={disabled}
      markLabel={`${taskTitle} 완료로 표시`}
      unmarkLabel={`${taskTitle} 완료 해제`}
      onToggle={onToggle}
      className={className}
    />
  );
}
