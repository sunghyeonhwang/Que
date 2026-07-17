"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

interface TabDef {
  href: string;
  label: string;
}

/**
 * 설정 서브라우트 탭 헤더 — 현재 경로로 active를 잡는다(URL 반영).
 * 직원 관리 탭은 관리자에게만 노출한다(비관리자 숨김 = 3중 게이트 중 1; 페이지 redirect + 액션 권한이 나머지).
 */
export function SettingsTabs({ isAdmin }: { isAdmin: boolean }) {
  const pathname = usePathname();
  const tabs: TabDef[] = [
    { href: "/settings", label: "모양" },
    { href: "/settings/notifications", label: "알림" },
    { href: "/settings/security", label: "보안" },
    { href: "/settings/tokens", label: "토큰" },
    // 가져오기(CSV 일괄 등록)는 전원 노출 — 작업 생성은 전원 가능, 권한 필요한 행은 core가 거부.
    { href: "/settings/import", label: "가져오기" },
    ...(isAdmin ? [{ href: "/settings/staff", label: "직원 관리" }] : []),
  ];

  return (
    <nav
      aria-label="설정 탭"
      className="flex gap-1 overflow-x-auto border-b border-[var(--que-border)]"
    >
      {tabs.map((tab) => {
        // /settings는 정확히 일치할 때만 active(하위 경로에서 '모양'이 함께 켜지지 않게).
        const active = tab.href === "/settings" ? pathname === "/settings" : pathname === tab.href;
        return (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex h-11 items-center whitespace-nowrap border-b-2 px-4 text-sm font-medium transition-colors",
              "focus-visible:outline-2 focus-visible:outline-[var(--que-brand)]",
              active
                ? "border-[var(--que-brand)] text-[var(--que-brand)]"
                : "border-transparent text-[var(--que-text-secondary)] hover:text-[var(--que-text)]",
            )}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
