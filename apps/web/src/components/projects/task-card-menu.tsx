"use client";

import { MoreHorizontal, ArrowRightLeft } from "lucide-react";
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

export type GroupOption = { id: string; name: string; color: string };

/** 태스크 카드/행 공용 ⋮ 메뉴 — 현재 그룹을 제외한 다른 그룹으로 이동.
 *  트리거는 상세 열기 Link 위(z-20)에 두고 pointer 이벤트를 막아 링크와 충돌하지 않게 한다. */
export function TaskCardMenu({
  taskId,
  taskName,
  currentGroupId,
  groups,
  className,
}: {
  taskId: string;
  taskName: string;
  currentGroupId: string;
  groups: GroupOption[];
  className?: string;
}) {
  const { run, pending } = useSafeAction();
  const targets = groups.filter((g) => g.id !== currentGroupId);

  const move = (target: GroupOption) => {
    run(() => moveTaskAction(taskId, target.id), {
      success: `"${taskName}" → ${target.name}`,
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
              aria-label={`${taskName} 메뉴`}
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
          <DropdownMenuSubTrigger disabled={targets.length === 0}>
            <ArrowRightLeft className="size-4" aria-hidden />
            이동
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent className="min-w-40">
            {targets.length === 0 ? (
              <DropdownMenuItem disabled>다른 그룹 없음</DropdownMenuItem>
            ) : (
              targets.map((target) => (
                <DropdownMenuItem key={target.id} onClick={() => move(target)}>
                  <span
                    className="size-2.5 shrink-0 rounded-full"
                    style={{ backgroundColor: target.color }}
                    aria-hidden
                  />
                  {target.name}
                </DropdownMenuItem>
              ))
            )}
          </DropdownMenuSubContent>
        </DropdownMenuSub>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
