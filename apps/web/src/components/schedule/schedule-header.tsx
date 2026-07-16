"use client";

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { addDays, addMonths, addWeeks, format } from "date-fns";
import { ChevronDown, ChevronLeft, ChevronRight, CalendarOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { DateJump } from "./date-jump";
import { ScheduleFilter } from "./schedule-filter";
import {
  CreateScheduleDialog,
  type ScheduleMember,
  type ScheduleProject,
} from "./create-schedule-dialog";

export type ScheduleRange = "day" | "3day" | "week" | "2week" | "month";

const RANGE_LABELS: Record<ScheduleRange, string> = {
  day: "일간",
  "3day": "3일",
  week: "주간",
  "2week": "2주",
  month: "월간",
};

/** 마지막 뷰 기억 쿠키. 서버 컴포넌트(page.tsx)가 읽어 기본 range로 사용한다. */
const RANGE_COOKIE = "que_schedule_range";
const RANGE_COOKIE_MAX_AGE = 60 * 60 * 24 * 365; // 1년
/** 주말 숨김 기억 쿠키(range 쿠키와 동일 패턴 — URL 우선, 없으면 쿠키). */
const WEEKEND_COOKIE = "que_schedule_weekend";

/** input/textarea/select/contenteditable 포커스 중이면 캘린더 단축키를 무시. */
function isTypingTarget(el: EventTarget | null): boolean {
  const node = el as HTMLElement | null;
  if (!node) return false;
  const tag = node.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || node.isContentEditable;
}

/** 기간 스위처(일간/주간/월간) + 날짜 이동(이전/오늘/다음) + 필터 + 새로 추가.
 * range·date를 URL(?range=, ?date=)에 반영한다. 이동 단위는 range에 맞춘다. */
export function ScheduleHeader({
  range,
  anchorIso,
  hideWeekend,
  appliedOwner,
  appliedHide,
  currentUserId,
  members,
  projects,
}: {
  range: ScheduleRange;
  /** 현재 기준 날짜 YYYY-MM-DD */
  anchorIso: string;
  /** 주말 숨김 적용 여부(URL·쿠키 폴백까지 반영된 최종값). 주간·2주에만 의미. */
  hideWeekend: boolean;
  /** 쿠키 폴백까지 반영된 최종 담당자 필터(콤마 CSV). 필터 뱃지·폼 초기값 기준. */
  appliedOwner?: string;
  /** 쿠키 폴백까지 반영된 최종 표시(숨김) 필터(콤마 CSV). */
  appliedHide?: string;
  /** 뷰어 id — 필터 팝오버의 "내 것만" 빠른 버튼용. */
  currentUserId: string;
  /** "새로 추가" 작업 담당자 Select 옵션 + 필터 팝오버 담당자 리스트. */
  members: ScheduleMember[];
  /** "새로 추가" 작업 프로젝트 Select 옵션. */
  projects: ScheduleProject[];
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
        : range === "3day"
          ? addDays(base, 3 * dir)
          : range === "month"
            ? addMonths(base, dir)
            : addWeeks(base, range === "2week" ? 2 * dir : dir);
    pushParams((p) => p.set("date", format(next, "yyyy-MM-dd")));
  };

  // 오늘로: date 파라미터를 제거하면 페이지가 오늘로 폴백
  const goToday = () => pushParams((p) => p.delete("date"));

  // 미니 달력 날짜 점프: 고른 날짜를 date로 set(다른 파라미터 보존).
  const jumpToDate = (dateKey: string) => pushParams((p) => p.set("date", dateKey));

  // 주말 숨김 토글: 끌 때도 명시적으로 "show"를 넣는다(URL이 쿠키보다 우선이라, 파라미터를 지우면
  // 서버가 아직 갱신 전인 쿠키 "hide"를 읽어 꺼지지 않는 문제를 피한다).
  const toggleWeekend = () =>
    pushParams((p) => p.set("weekend", hideWeekend ? "show" : "hide"));

  // 마지막 뷰 기억: 현재 range를 쿠키에 저장(뷰 전환·직접 URL 진입 모두 반영).
  // 서버 컴포넌트는 렌더 중 쿠키를 못 쓰므로 클라이언트에서 document.cookie로 기록한다.
  useEffect(() => {
    document.cookie = `${RANGE_COOKIE}=${range}; path=/; max-age=${RANGE_COOKIE_MAX_AGE}; samesite=lax`;
  }, [range]);

  // 주말 숨김도 쿠키에 기억(range와 동일 패턴). 최종값을 그대로 기록해 파라미터 없는 재방문의 기본값이 된다.
  useEffect(() => {
    document.cookie = `${WEEKEND_COOKIE}=${hideWeekend ? "hide" : "show"}; path=/; max-age=${RANGE_COOKIE_MAX_AGE}; samesite=lax`;
  }, [hideWeekend]);

  // 키보드 내비게이션: ← 이전 · → 다음 · T 오늘 · D 일간 · 3 3일 · W 주간 · 2 2주 · M 월간.
  // 수정키 동반·입력 중이면 무시(전역 ⌘K·?·/ 단축키와 충돌 방지).
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (isTypingTarget(e.target)) return;

      const setParam = (mutate: (p: URLSearchParams) => void) => {
        const params = new URLSearchParams(searchParams.toString());
        mutate(params);
        router.push(`/schedule?${params.toString()}`);
      };
      const stepBy = (dir: 1 | -1) => {
        const base = new Date(`${anchorIso}T00:00:00`);
        const next =
          range === "day"
            ? addDays(base, dir)
            : range === "3day"
              ? addDays(base, 3 * dir)
              : range === "month"
                ? addMonths(base, dir)
                : addWeeks(base, range === "2week" ? 2 * dir : dir);
        setParam((p) => p.set("date", format(next, "yyyy-MM-dd")));
      };

      switch (e.key) {
        case "ArrowLeft":
          e.preventDefault();
          stepBy(-1);
          break;
        case "ArrowRight":
          e.preventDefault();
          stepBy(1);
          break;
        case "t":
        case "T":
          e.preventDefault();
          setParam((p) => p.delete("date"));
          break;
        case "d":
        case "D":
          e.preventDefault();
          setParam((p) => p.set("range", "day"));
          break;
        case "3":
          e.preventDefault();
          setParam((p) => p.set("range", "3day"));
          break;
        case "2":
          e.preventDefault();
          setParam((p) => p.set("range", "2week"));
          break;
        case "w":
        case "W":
          e.preventDefault();
          setParam((p) => p.set("range", "week"));
          break;
        case "m":
        case "M":
          e.preventDefault();
          setParam((p) => p.set("range", "month"));
          break;
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [range, anchorIso, router, searchParams]);

  const stepLabel =
    range === "day"
      ? "일"
      : range === "3day"
        ? "3일"
        : range === "2week"
          ? "2주"
          : range === "month"
            ? "월"
            : "주";

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

      <DateJump anchorIso={anchorIso} onSelect={jumpToDate} />

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

      {/* 주말 숨김 — 주간·2주에만 적용되므로 그 외 뷰에선 숨긴다(적용 안 되는 뷰 노출은 혼란). */}
      {(range === "week" || range === "2week") && (
        <Button
          variant="outline"
          aria-pressed={hideWeekend}
          aria-label={hideWeekend ? "주말 표시" : "주말 숨김"}
          onClick={toggleWeekend}
          className={cn(
            "h-10 gap-1.5 rounded-lg border-[var(--que-border)] px-3.5 font-medium",
            hideWeekend &&
              "border-[var(--que-brand)] bg-[var(--que-brand-subtle)] text-[var(--que-brand)] hover:bg-[var(--que-brand-subtle)]",
          )}
        >
          <CalendarOff className="size-4" aria-hidden />
          주말 숨김
        </Button>
      )}

      <ScheduleFilter
        members={members}
        currentUserId={currentUserId}
        appliedOwner={appliedOwner}
        appliedHide={appliedHide}
      />

      <CreateScheduleDialog members={members} projects={projects} defaultDate={anchorIso} />
    </div>
  );
}
