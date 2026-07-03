"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { ChevronDown, Plus, SlidersHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

export type ScheduleRange = "day" | "week" | "month";

const RANGE_LABELS: Record<ScheduleRange, string> = {
  day: "일간",
  week: "주간",
  month: "월간",
};

/** 기간 스위처(일간/주간/월간) + 필터 + 새로 추가. range를 URL(?range=)에 반영. */
export function ScheduleHeader({ range }: { range: ScheduleRange }) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const changeRange = (next: string) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("range", next);
    router.push(`/schedule?${params.toString()}`);
  };

  return (
    <div className="flex items-center gap-2">
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              variant="outline"
              className="h-10 gap-1.5 rounded-lg border-[var(--que-border)] px-3.5 font-medium"
            />
          }
        >
          {RANGE_LABELS[range]}
          <ChevronDown className="size-4 text-[var(--que-text-tertiary)]" aria-hidden />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="min-w-32">
          <DropdownMenuRadioGroup value={range} onValueChange={changeRange}>
            {(Object.keys(RANGE_LABELS) as ScheduleRange[]).map((key) => (
              <DropdownMenuRadioItem key={key} value={key}>
                {RANGE_LABELS[key]}
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
        </DropdownMenuContent>
      </DropdownMenu>

      <Tooltip>
        <TooltipTrigger
          render={
            <Button
              variant="outline"
              aria-label="필터"
              className="size-10 rounded-lg border-[var(--que-border)] p-0"
            />
          }
        >
          <SlidersHorizontal className="size-4" aria-hidden />
        </TooltipTrigger>
        <TooltipContent>필터</TooltipContent>
      </Tooltip>

      <Button className="h-10 gap-1.5 rounded-lg bg-[var(--que-brand)] px-3.5 font-medium text-white hover:bg-[var(--que-brand-hover)]">
        <Plus className="size-4" aria-hidden />
        새로 추가
      </Button>
    </div>
  );
}
