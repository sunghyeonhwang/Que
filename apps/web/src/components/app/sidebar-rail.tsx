"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { MENU_SECTIONS, OPEN_TODO_APP_EVENT } from "@/lib/menu";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

/** 태블릿 가로(lg~xl) 축소 사이드바 — 아이콘 전용 레일.
 *  라벨은 Tooltip으로, 뱃지는 아이콘 우상단 숫자 배지로 보여준다.
 *  섹션 필터(adminOnly)·active 매칭(match)은 SidebarNav와 동일 로직을 공유한다. */
export function SidebarRail({
  badges,
  isAdmin = false,
}: {
  badges?: Record<string, number>;
  isAdmin?: boolean;
}) {
  const pathname = usePathname();

  return (
    <nav aria-label="주 메뉴" className="flex flex-col items-center gap-3">
      {MENU_SECTIONS.map((section) => {
        const items = section.items.filter((item) => !item.adminOnly || isAdmin);
        if (items.length === 0) return null;
        return (
          <div key={section.label} className="flex w-full flex-col items-center gap-1">
            {items.map((item) => {
              // `#` 항목은 라우트가 아니라 모달 액션 — 링크 대신 버튼으로 렌더한다.
              const isAction = item.href.startsWith("#");
              const matchPaths = item.match ?? [item.href];
              const active = !isAction && matchPaths.some((path) => pathname.startsWith(path));
              const Icon = item.icon;
              const badgeCount = badges?.[item.href] ?? item.badge ?? 0;
              const triggerClass = cn(
                "relative flex size-10 items-center justify-center rounded-lg transition-colors",
                "focus-visible:outline-2 focus-visible:outline-[var(--que-brand)]",
                active
                  ? "bg-[var(--que-brand-subtle)] text-[var(--que-brand)]"
                  : "text-[var(--que-text-secondary)] hover:bg-[var(--que-bg-muted)] hover:text-[var(--que-text)]",
              );
              const ariaLabel =
                badgeCount > 0 ? `${item.label} (${badgeCount}건)` : item.label;
              return (
                <Tooltip key={item.href}>
                  <TooltipTrigger
                    render={
                      isAction ? (
                        <button
                          type="button"
                          aria-label={ariaLabel}
                          onClick={() => window.dispatchEvent(new Event(OPEN_TODO_APP_EVENT))}
                          className={cn(triggerClass, "cursor-pointer")}
                        />
                      ) : (
                        <Link
                          href={item.href}
                          aria-current={active ? "page" : undefined}
                          aria-label={ariaLabel}
                          className={triggerClass}
                        />
                      )
                    }
                  >
                    <Icon className="size-[18px] shrink-0" aria-hidden />
                    {badgeCount > 0 ? (
                      <span
                        className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-[var(--que-error)] px-1 text-[10px] font-semibold text-white"
                        aria-hidden
                      >
                        {badgeCount}
                      </span>
                    ) : null}
                  </TooltipTrigger>
                  <TooltipContent side="right">{item.label}</TooltipContent>
                </Tooltip>
              );
            })}
          </div>
        );
      })}
    </nav>
  );
}
