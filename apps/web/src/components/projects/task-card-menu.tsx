"use client";

import { MoreHorizontal, ArrowRightLeft } from "lucide-react";
import type { BoardColumnKey } from "@/lib/projects-data";
import { COLUMN_LABEL, COLUMN_ORDER, SIMPLE_COLUMN_STATUS, TONE_STYLE, COLUMN_TONE } from "@/lib/pm-columns";
import { moveTaskAction } from "@/app/(app)/projects/pm-actions";
import { useSafeAction } from "@/components/app/use-safe-action";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

/** 태스크 카드/행 공용 ⋮ 메뉴 — 현재 열을 제외한 다른 열로 이동.
 *  예정/진행중/완료는 즉시 이동, 홀드·문제는 사유 입력이 필요해 onBlocked로 위임한다.
 *  트리거는 상세 열기 Link 위(z-20)에 두고 pointer 이벤트를 막아 링크와 충돌하지 않게 한다. */
export function TaskCardMenu({
  taskId,
  taskTitle,
  currentColumn,
  onBlocked,
  className,
}: {
  taskId: string;
  taskTitle: string;
  currentColumn: BoardColumnKey;
  /** 홀드·문제 열로 이동 요청 — 부모가 사유 Dialog를 연다. */
  onBlocked: () => void;
  className?: string;
}) {
  const { run, pending } = useSafeAction();
  const targets = COLUMN_ORDER.filter((key) => key !== currentColumn);

  const moveTo = (key: BoardColumnKey) => {
    if (key === "blocked") {
      onBlocked();
      return;
    }
    run(() => moveTaskAction({ taskId, to: SIMPLE_COLUMN_STATUS[key] }), {
      success: `"${taskTitle}" → ${COLUMN_LABEL[key]}`,
    });
  };

  // 트리거를 Link 위로 올리고 클릭/포인터 전파를 차단한다.
  const stop = (event: { stopPropagation: () => void }) => event.stopPropagation();

  return (
    <DropdownMenu>
      <Tooltip>
        <TooltipTrigger
          render={
            <DropdownMenuTrigger
              disabled={pending}
              aria-label={`${taskTitle} 메뉴`}
              onPointerDown={stop}
              onClick={stop}
              className={cn(
                "relative z-20 inline-flex size-10 items-center justify-center rounded-lg text-[var(--que-text-secondary)] transition-colors hover:bg-[var(--que-bg-muted)] focus-visible:outline-2 focus-visible:outline-[var(--que-brand)] data-[popup-open]:bg-[var(--que-bg-muted)]",
                className,
              )}
            />
          }
        >
          <MoreHorizontal className="size-4" aria-hidden />
        </TooltipTrigger>
        <TooltipContent>메뉴</TooltipContent>
      </Tooltip>
      <DropdownMenuContent align="end" className="w-44" onClick={stop}>
        <DropdownMenuSub>
          <DropdownMenuSubTrigger>
            <ArrowRightLeft className="size-4" aria-hidden />
            이동
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent className="min-w-40">
            {targets.map((key) => (
              <DropdownMenuItem key={key} onClick={() => moveTo(key)}>
                <span
                  className="size-2.5 shrink-0 rounded-full"
                  style={{ backgroundColor: TONE_STYLE[COLUMN_TONE[key]].dot }}
                  aria-hidden
                />
                {COLUMN_LABEL[key]}
              </DropdownMenuItem>
            ))}
          </DropdownMenuSubContent>
        </DropdownMenuSub>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
