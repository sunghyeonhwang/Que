"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { ListChecks, LayoutGrid, GanttChartSquare, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

// 캘린더 뷰는 폐기(2026-07-15) — 팀 전체 캘린더는 /schedule이 담당한다.
export type ProjectView = "list" | "board" | "gantt";

const TABS: { key: ProjectView; label: string; icon: LucideIcon }[] = [
  { key: "list", label: "목록", icon: ListChecks },
  { key: "board", label: "보드", icon: LayoutGrid },
  // 간트(E-9) — 작업 기간 막대 + 선행 작업 화살표 + 일정 주의.
  { key: "gantt", label: "간트", icon: GanttChartSquare },
];

/** 프로젝트 뷰 스위처. URL ?view= 에 반영(현재 project 등 다른 파라미터 보존). */
export function ViewTabs({ current }: { current: ProjectView }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const hrefFor = (view: ProjectView) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("view", view);
    // 뷰 전환 시 캘린더 월·열린 상세는 초기화(뷰마다 의미가 다름).
    params.delete("month");
    params.delete("task");
    return `${pathname}?${params.toString()}`;
  };

  return (
    <div role="tablist" aria-label="프로젝트 뷰" className="flex items-center gap-1">
      {TABS.map(({ key, label, icon: Icon }) => {
        const active = key === current;
        return (
          <Link
            key={key}
            href={hrefFor(key)}
            scroll={false}
            role="tab"
            aria-selected={active}
            className={cn(
              "-mb-px flex h-11 items-center gap-2 border-b-2 px-3 text-sm transition-colors",
              "focus-visible:outline-2 focus-visible:outline-[var(--que-brand)]",
              active
                ? "border-[var(--que-brand)] font-semibold text-[var(--que-brand)]"
                : "border-transparent font-medium text-[var(--que-text-secondary)] hover:text-[var(--que-text)]",
            )}
          >
            <Icon className="size-[18px] shrink-0" aria-hidden />
            {label}
          </Link>
        );
      })}
    </div>
  );
}
