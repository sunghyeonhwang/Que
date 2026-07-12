"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion, useAnimate } from "motion/react";
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
 * - Copilot(/copilot)에서도 탭바를 노출한다(2026-07-13 사용자 요청). 탭바는 셸 우측 컬럼의 in-flow
 *   최하단 요소라 main(및 Copilot 입력창)이 그만큼 줄어 자연스럽게 위로 쌓인다(겹침 없음).
 *   키보드가 뜨면 interactiveWidget=resizes-content로 dvh가 줄어 입력창·탭바가 키보드 위로 올라온다.
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

  // 알림 탭 뱃지 — 미읽음 수가 "증가"할 때만 한 번 펄스(새 알림 도착 신호). 최초 마운트에는 펄스 금지.
  const [badgeScope, animateBadge] = useAnimate<HTMLSpanElement>();
  const prevUnread = useRef(unreadCount);
  useEffect(() => {
    if (unreadCount > prevUnread.current && badgeScope.current) {
      animateBadge(
        badgeScope.current,
        { scale: [1, 1.3, 1] },
        { duration: 0.32, times: [0, 0.45, 1], ease: "easeOut" },
      );
    }
    prevUnread.current = unreadCount;
  }, [unreadCount, animateBadge, badgeScope]);

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
            {/* 활성 탭 상단 인디케이터 — layoutId로 이전 탭에서 새 탭으로 위치를 보간(미끄러짐) */}
            {active && (
              <motion.span
                layoutId="tabbar-indicator"
                aria-hidden
                className="pointer-events-none absolute inset-x-2 top-0 h-0.5 rounded-full bg-[var(--que-brand)]"
                transition={{ type: "spring", stiffness: 500, damping: 40 }}
              />
            )}
            <span className="relative">
              <Icon className="size-[22px]" aria-hidden />
              {showBadge && (
                <span
                  ref={badgeScope}
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
