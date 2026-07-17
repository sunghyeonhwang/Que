"use client";

import { ArrowRight } from "lucide-react";
import { deferTaskToTomorrowAction } from "@/app/(app)/today/actions";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { nextBusinessDayLabel } from "@/lib/business-day";
import { useSafeAction } from "./use-safe-action";

/** 작업 행의 원탭 "내일로" 버튼 — 시작 시각을 다음 영업일로 옮긴다(하루 마감의 DayWrap과 동일 액션).
 *  startAt이 있는 내 작업·미완료 행에서만 노출한다(호출부가 판정). 아이콘 전용이라 aria-label + Tooltip 필수. */
export function DeferTaskButton({
  taskId,
  title,
  startAt,
}: {
  taskId: string;
  title: string;
  /** 이동 기준 시각. 없는 작업은 서버가 거부하므로 버튼을 아예 노출하지 않는다. */
  startAt: string;
}) {
  const { run, pending } = useSafeAction();
  const label = nextBusinessDayLabel(startAt);

  const defer = () => {
    run(() => deferTaskToTomorrowAction(taskId), {
      // 실제 이동 날짜(다음 영업일)를 병기 — 주말이면 월요일이 되므로.
      success: `"${title}" 작업을 ${label}로 옮기고 변경 로그에 기록했습니다.`,
    });
  };

  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button
            variant="ghost"
            aria-label={`내일로 미루기: ${title}`}
            disabled={pending}
            onClick={defer}
            className="size-10 rounded-lg text-[var(--que-text-tertiary)]"
          />
        }
      >
        <ArrowRight className="size-4" aria-hidden />
      </TooltipTrigger>
      <TooltipContent>내일로 미루기 ({label})</TooltipContent>
    </Tooltip>
  );
}
