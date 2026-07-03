"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { addDays, addMonths, addWeeks, format } from "date-fns";
import { ChevronDown, ChevronLeft, ChevronRight, Plus, SlidersHorizontal } from "lucide-react";
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

/** 기간 스위처(일간/주간/월간) + 날짜 이동(이전/오늘/다음) + 필터 + 새로 추가.
 * range·date를 URL(?range=, ?date=)에 반영한다. 이동 단위는 range에 맞춘다. */
export function ScheduleHeader({
  range,
  anchorIso,
}: {
  range: ScheduleRange;
  /** 현재 기준 날짜 YYYY-MM-DD */
  anchorIso: string;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const pushParams = (mutate: (p: URLSearchParams) => void) => {
    const params = new URLSearchParams(searchParams.toString());
    mutate(params);
    router.push(`/schedule?${params.toString()}`);
  };

  const changeRange = (next: string) => pushParams((p) => p.set("range", next));

  // range 단위로 anchor를 앞/뒤로 이동
  const shift = (dir: 1 | -1) => {
    const base = new Date(`${anchorIso}T00:00:00`);
    const next =
      range === "day"
        ? addDays(base, dir)
        : range === "month"
          ? addMonths(base, dir)
          : addWeeks(base, dir);
    pushParams((p) => p.set("date", format(next, "yyyy-MM-dd")));
  };

  // 오늘로: date 파라미터를 제거하면 페이지가 오늘로 폴백
  const goToday = () => pushParams((p) => p.delete("date"));

  const stepLabel = range === "day" ? "일" : range === "month" ? "월" : "주";

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="flex items-center gap-1">
        <Button
          variant="outline"
          aria-label={`이전 ${stepLabel}`}
          className="size-10 rounded-lg border-[var(--que-border)] p-0"
          onClick={() => shift(-1)}
        >
          <ChevronLeft className="size-4" aria-hidden />
        </Button>
        <Button
          variant="outline"
          className="h-10 rounded-lg border-[var(--que-border)] px-3.5 font-medium"
          onClick={goToday}
        >
          오늘
        </Button>
        <Button
          variant="outline"
          aria-label={`다음 ${stepLabel}`}
          className="size-10 rounded-lg border-[var(--que-border)] p-0"
          onClick={() => shift(1)}
        >
          <ChevronRight className="size-4" aria-hidden />
        </Button>
      </div>

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

      {/* 필터·새로 추가는 아직 미구현 — 무반응 버튼 대신 '준비 중' 비활성으로 명시(출시 기준). */}
      <Tooltip>
        <TooltipTrigger
          render={
            <Button
              variant="outline"
              aria-label="필터 (준비 중)"
              aria-disabled
              className="size-10 rounded-lg border-[var(--que-border)] p-0 opacity-60"
            />
          }
        >
          <SlidersHorizontal className="size-4" aria-hidden />
        </TooltipTrigger>
        <TooltipContent>준비 중</TooltipContent>
      </Tooltip>

      <Tooltip>
        <TooltipTrigger
          render={
            <Button
              aria-label="새로 추가 (준비 중)"
              aria-disabled
              className="h-10 gap-1.5 rounded-lg bg-[var(--que-brand)] px-3.5 font-medium text-white opacity-60"
            />
          }
        >
          <Plus className="size-4" aria-hidden />
          새로 추가
        </TooltipTrigger>
        <TooltipContent>준비 중</TooltipContent>
      </Tooltip>
    </div>
  );
}
