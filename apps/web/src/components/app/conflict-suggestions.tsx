"use client";

import { format } from "date-fns";
import { CalendarClock } from "lucide-react";
import { acceptConflictSuggestionAction } from "@/app/(app)/today/actions";
import { Button } from "@/components/ui/button";
import { josa } from "@/lib/korean";
import { useSafeAction } from "./use-safe-action";

export interface ConflictSuggestionView {
  taskId: string;
  taskTitle: string;
  blockerTitle: string;
  blockerRangeText: string;
  suggestedStartAt: string;
  suggestedEndAt: string;
  suggestedTimeText: string;
}

/** 일정 충돌 변경 제안 (기획: "회의가 있습니다. 시간을 변경할까요?"). 수락은 한 번의 클릭. */
export function ConflictSuggestions({ items }: { items: ConflictSuggestionView[] }) {
  const { run, pending } = useSafeAction();

  if (items.length === 0) return null;

  return (
    <div className="mb-4 flex flex-col gap-2">
      {items.map((item) => (
        <div
          key={`${item.taskId}-${item.suggestedStartAt}`}
          className="flex flex-wrap items-center gap-2 rounded-md border border-dashed px-3 py-2"
        >
          <CalendarClock className="size-4 shrink-0 text-muted-foreground" aria-hidden />
          <p className="min-w-0 flex-1 text-sm">
            <span className="font-medium">{item.taskTitle}</span>
            {josa(item.taskTitle, "이", "가")}{" "}
            <span className="font-medium">{item.blockerTitle}</span>({item.blockerRangeText})와
            겹칩니다. {item.suggestedTimeText}로 변경할까요?
          </p>
          <Button
            size="sm"
            className="h-10"
            disabled={pending}
            onClick={() =>
              run(
                () =>
                  acceptConflictSuggestionAction({
                    taskId: item.taskId,
                    startAt: item.suggestedStartAt,
                    endAt: item.suggestedEndAt,
                  }),
                { success: `"${item.taskTitle}"을(를) ${item.suggestedTimeText}로 옮겼습니다.` },
              )
            }
          >
            {format(new Date(item.suggestedStartAt), "HH:mm")}로 이동
          </Button>
        </div>
      ))}
    </div>
  );
}
