import Link from "next/link";
import type { MyTaskTab, TaskGroupKey, TaskSortKey } from "@/lib/my-tasks-data";
import { buildTodayHref, type TodayPanel } from "@/lib/today-nav";
import { cn } from "@/lib/utils";

// "내 작업" 밑줄형 탭. URL ?tab=all|today|upcoming|done 로 상태를 반영한다.
const TABS: { key: MyTaskTab; label: string }[] = [
  { key: "all", label: "모든 작업" },
  { key: "today", label: "오늘" },
  { key: "upcoming", label: "예정" },
  { key: "done", label: "완료됨" },
];

export function MyTaskTabs({
  active,
  counts,
  panel = "status",
  sort = "due",
  group = "none",
}: {
  active: MyTaskTab;
  counts: Record<MyTaskTab, number>;
  /** 상단 패널(현황/입력)을 유지한 채 리스트 필터만 바꾸기 위해 전달. */
  panel?: TodayPanel;
  /** 표 보기 옵션(정렬·그룹)을 필터 전환 링크에 보존한다. */
  sort?: TaskSortKey;
  group?: TaskGroupKey;
}) {
  return (
    <nav
      aria-label="내 작업 필터"
      className="flex items-end gap-1 border-b border-[var(--que-border)]"
    >
      {TABS.map((tab) => {
        const isActive = tab.key === active;
        return (
          <Link
            key={tab.key}
            href={buildTodayHref(tab.key, panel, { sort, group })}
            aria-current={isActive ? "page" : undefined}
            className={cn(
              "flex h-11 items-center gap-1.5 border-b-2 px-3 text-sm font-medium transition-colors",
              isActive
                ? "border-[var(--que-brand)] text-[var(--que-brand)]"
                : "border-transparent text-[var(--que-text-secondary)] hover:text-[var(--que-text)]",
            )}
          >
            {tab.label}
            <span
              className={cn(
                "inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-xs tabular-nums",
                isActive
                  ? "bg-[var(--que-brand-subtle)] text-[var(--que-brand)]"
                  : "bg-[var(--que-bg-muted)] text-[var(--que-text-tertiary)]",
              )}
            >
              {counts[tab.key]}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}
