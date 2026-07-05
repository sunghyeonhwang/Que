"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { MENU_SECTIONS } from "@/lib/menu";
import { cn } from "@/lib/utils";

/** 사이드바/모바일 시트 공용 메뉴. 섹션(메뉴·기타) + active + 뱃지. 터치 40px 이상.
 * badges: href별 실데이터 뱃지 수(레이아웃에서 서버 계산해 주입). 정적 menu.badge보다 우선. */
export function SidebarNav({
  onNavigate,
  className,
  badges,
  isAdmin = false,
}: {
  onNavigate?: () => void;
  className?: string;
  badges?: Record<string, number>;
  /** 관리자 전용(adminOnly) 메뉴 노출 여부. 레이아웃에서 user.role로 계산해 주입. */
  isAdmin?: boolean;
}) {
  const pathname = usePathname();

  return (
    <nav aria-label="주 메뉴" className={cn("flex flex-col gap-4", className)}>
      {MENU_SECTIONS.map((section) => {
        const items = section.items.filter((item) => !item.adminOnly || isAdmin);
        if (items.length === 0) return null;
        return (
        <div key={section.label} className="flex flex-col gap-1">
          <p className="px-3 pb-1 text-xs font-medium text-[var(--que-text-tertiary)]">
            {section.label}
          </p>
          {items.map((item) => {
            const matchPaths = item.match ?? [item.href];
            const active = matchPaths.some((path) => pathname.startsWith(path));
            const Icon = item.icon;
            const badgeCount = badges?.[item.href] ?? item.badge ?? 0;
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onNavigate}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex h-10 items-center gap-3 rounded-lg px-3 text-sm transition-colors",
                  "focus-visible:outline-2 focus-visible:outline-[var(--que-brand)]",
                  active
                    ? "bg-[var(--que-brand-subtle)] font-semibold text-[var(--que-brand)]"
                    : "font-medium text-[var(--que-text-secondary)] hover:bg-[var(--que-bg-muted)] hover:text-[var(--que-text)]",
                )}
              >
                <Icon className="size-[18px] shrink-0" aria-hidden />
                <span className="min-w-0 flex-1 truncate">{item.label}</span>
                {badgeCount > 0 ? (
                  <span
                    className="flex h-5 min-w-5 items-center justify-center rounded-full bg-[var(--que-error)] px-1.5 text-[11px] font-semibold text-white"
                    aria-label={`${badgeCount}건`}
                  >
                    {badgeCount}
                  </span>
                ) : null}
              </Link>
            );
          })}
        </div>
        );
      })}
    </nav>
  );
}
