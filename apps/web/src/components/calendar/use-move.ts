"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  moveEventToDateAction,
  moveMilestoneToDateAction,
  moveTaskToDateAction,
} from "@/app/(app)/calendar/actions";
import type { DragPayload } from "./drag";

/** 드롭된 항목을 종류에 맞는 서버 액션으로 이동시키고 결과를 토스트로 알린다. */
export function useMoveItem() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const move = (payload: DragPayload, date: string, hour?: number) => {
    startTransition(async () => {
      const result =
        payload.kind === "task"
          ? await moveTaskToDateAction({ taskId: payload.id, date, hour })
          : payload.kind === "event"
            ? await moveEventToDateAction({ eventId: payload.id, date, hour })
            : await moveMilestoneToDateAction({ milestoneId: payload.id, date });

      if (result.ok) {
        toast.success("일정이 이동되어 변경 로그에 기록됐습니다.");
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  };

  return { move, pending };
}
