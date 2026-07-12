"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, CalendarCheck, Sparkles, Bell, Menu, type LucideIcon } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Brand } from "./brand";
import { SidebarNav } from "./sidebar-nav";
import { cn } from "@/lib/utils";

/**
 * 폰(<md, 768px 미만) 전용 하단 탭바. 태블릿·데스크톱(≥md)에서는 `md:hidden`으로 렌더되지 않아
 * 기존 사이드바/레일/헤더 시트 내비를 그대로 유지한다(≥768 회귀 없음).
 *
 * - 앱 셸 우측 컬럼의 in-flow 최하단 요소로 둔다(fixed 아님). 셸 루트가 h-dvh + overflow-hidden이라
 *   main만 내부 스크롤하고 탭바는 항상 뷰포트 하단에 고정된 것처럼 보인다 → 콘텐츠를 가리는
 *   overlap·safe-area 패딩 계산이 필요 없다. 하단 safe-area만 자체 패딩으로 확보한다.
 * - 탭 4개(홈·데일리·Copilot·알림) + 다섯 번째 메뉴 탭(≡)은 기존 SidebarNav를 Sheet로 연다.
 * - Copilot(/copilot)은 입력 집중 화면이라 탭바를 숨긴다(키보드/입력창과 겹치지 않게).
 */

interface TabDef {
  href: string;
  label: string;
  icon: LucideIcon;
  /** active 판정 경로(startsWith). 생략 시 href. */
  match?: string;
}

const TABS: TabDef[] = [
  { href: "/home", label: "홈", icon: Home },
  { href: "/daily", label: "데일리", icon: CalendarCheck },
  { href: "/copilot", label: "Copilot", icon: Sparkles },
  { href: "/notifications", label: "알림", icon: Bell },
];

export function MobileTabbar({
  badges,
  isAdmin = false,
  unreadCount = 0,
}: {
  badges?: Record<string, number>;
  isAdmin?: boolean;
  /** 알림 탭 미읽음 뱃지 — 상단바 종과 같은 소스(alerts.unreadCount). */
  unreadCount?: number;
}) {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);

  // 입력 집중 화면(Copilot)에서는 탭바를 숨겨 입력창·키보드와 겹치지 않게 한다.
  // 이때 네비는 상단바 햄버거(시트)가 대신한다.
  if (pathname.startsWith("/copilot")) return null;

  const itemClass = (active: boolean) =>
    cn(
      "relative flex min-h-[52px] flex-1 flex-col items-center justify-center gap-1 rounded-md",
      "focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[var(--que-brand)]",
      active
        ? "text-[var(--que-brand)]"
        : "text-[var(--que-text-secondary)]",
    );

  return (
    <nav
      aria-label="모바일 주요 화면"
      className="flex shrink-0 items-stretch gap-0.5 border-t border-[var(--que-border)] bg-[var(--que-bg)] px-1 pb-[env(safe-area-inset-bottom)] md:hidden"
    >
      {TABS.map((tab) => {
        const active = pathname.startsWith(tab.match ?? tab.href);
        const Icon = tab.icon;
        const showBadge = tab.href === "/notifications" && unreadCount > 0;
        return (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={active ? "page" : undefined}
            aria-label={
              showBadge ? `${tab.label} — 새 알림 ${unreadCount}건` : undefined
            }
            className={itemClass(active)}
          >
            <span className="relative">
              <Icon className="size-[22px]" aria-hidden />
              {showBadge && (
                <span
                  className="absolute -top-1.5 -right-2 flex h-4 min-w-4 items-center justify-center rounded-full bg-[var(--que-error)] px-1 text-[10px] font-semibold text-white tabular-nums"
                  aria-hidden
                >
                  {unreadCount > 9 ? "9+" : unreadCount}
                </span>
              )}
            </span>
            <span className="text-[11px] font-medium leading-none">{tab.label}</span>
          </Link>
        );
      })}

      {/* 다섯 번째 탭 — 전체 메뉴 시트(기존 SidebarNav 재사용) */}
      <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
        <SheetTrigger
          render={
            <button
              type="button"
              aria-label="전체 메뉴 열기"
              className={itemClass(false)}
            />
          }
        >
          <Menu className="size-[22px]" aria-hidden />
          <span className="text-[11px] font-medium leading-none">메뉴</span>
        </SheetTrigger>
        <SheetContent side="left" className="w-72 gap-4 p-4">
          <SheetHeader className="p-0 text-left">
            <SheetTitle className="sr-only">메뉴</SheetTitle>
            <Brand />
          </SheetHeader>
          {/* 폰은 세로 폭이 좁아 메뉴가 길다 — 내부 스크롤로 전체 항목 접근 보장 */}
          <div className="min-h-0 flex-1 overflow-y-auto">
            <SidebarNav
              onNavigate={() => setMenuOpen(false)}
              badges={badges}
              isAdmin={isAdmin}
            />
          </div>
        </SheetContent>
      </Sheet>
    </nav>
  );
}
