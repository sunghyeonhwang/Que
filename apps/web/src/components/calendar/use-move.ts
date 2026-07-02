"use client";

import {
  moveEventToDateAction,
  moveMilestoneToDateAction,
  moveTaskToDateAction,
} from "@/app/(app)/calendar/actions";
import { useSafeAction } from "@/components/app/use-safe-action";
import type { DragPayload } from "./drag";

/** 드롭된 항목을 종류에 맞는 서버 액션으로 이동시키고 결과를 토스트로 알린다. */
export function useMoveItem() {
  const { run, pending } = useSafeAction();

  const move = (payload: DragPayload, date: string, hour?: number) => {
    run(
      () =>
        payload.kind === "task"
          ? moveTaskToDateAction({ taskId: payload.id, date, hour })
          : payload.kind === "event"
            ? moveEventToDateAction({ eventId: payload.id, date, hour })
            : moveMilestoneToDateAction({ milestoneId: payload.id, date }),
      { success: "일정이 이동되어 변경 로그에 기록됐습니다." },
    );
  };

  return { move, pending };
}
