"use client";

import Link from "next/link";
import { ListChecks, LayoutGrid, Calendar, File, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export type ProjectView = "list" | "board" | "calendar" | "files";

const TABS: { key: ProjectView; label: string; icon: LucideIcon }[] = [
  { key: "list", label: "목록", icon: ListChecks },
  { key: "board", label: "보드", icon: LayoutGrid },
  { key: "calendar", label: "캘린더", icon: Calendar },
  { key: "files", label: "파일", icon: File },
];

/** 프로젝트 뷰 스위처. URL ?view= 에 반영. 목록만 기능, 나머지는 준비 중 안내로 전환. */
export function ViewTabs({ current }: { current: ProjectView }) {
  return (
    <div
      role="tablist"
      aria-label="프로젝트 뷰"
      className="flex items-center gap-1"
    >
      {TABS.map(({ key, label, icon: Icon }) => {
        const active = key === current;
        return (
          <Link
            key={key}
            href={`?view=${key}`}
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
