"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { ChevronRight, ExternalLink } from "lucide-react";
import { MENU_SECTIONS, OPEN_TODO_APP_EVENT } from "@/lib/menu";
import { cn } from "@/lib/utils";

/** 하위 항목(children) 하나가 현재 URL(pathname+query)에 부합하는지 판정한다.
 *  href를 path + query로 쪼개, path 접두 일치 + 모든 query 파라미터 일치면 매치로 보고
 *  일치한 파라미터 수(specificity)를 점수로 돌린다. 상위에서 최고 점수 하나만 활성화한다
 *  (파라미터 없는 기본 하위=score 0은 형제 중 매치가 없을 때만 활성). */
function matchChild(
  href: string,
  pathname: string,
  searchParams: URLSearchParams,
): { matches: boolean; score: number } {
  const [path, query = ""] = href.split("?");
  if (!pathname.startsWith(path)) return { matches: false, score: 0 };
  const params = new URLSearchParams(query);
  let score = 0;
  for (const [key, value] of params) {
    if (searchParams.get(key) !== value) return { matches: false, score: 0 };
    score += 1;
  }
  return { matches: true, score };
}

/** 사이드바/모바일 시트 공용 메뉴. 섹션(메뉴·기타) + active + 뱃지 + 하위 트리(chevron). 터치 40px 이상.
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
  const searchParams = useSearchParams();
  // 사용자가 chevron을 눌러 명시적으로 펼침/접힘을 바꾼 항목만 기록한다.
  // 기록이 없으면 "현재 라우트면 자동 펼침"으로 폴백한다(openMap[href] ?? parentActive).
  const [openMap, setOpenMap] = useState<Record<string, boolean>>({});

  return (
    <nav aria-label="주 메뉴" className={cn("flex flex-col gap-4", className)}>
      {MENU_SECTIONS.map((section) => {
        const items = section.items.filter((item) => !item.adminOnly || isAdmin);
        if (items.length === 0) return null;

        // 바로가기 — 외부 링크를 아이콘 전용 소형 버튼 1줄로(2026-07-15 사용자 "더 작게 1줄").
        // 전부 external이라 새 탭 <a>. active 하이라이트 없음(규약). 배경·뱃지에는 accentColor를 쓰지 않는다.
        // 섹션 제목·라벨 텍스트 모두 미표시 — 이름은 title 툴팁과 aria-label로만(접근성 유지).
        // 32px(size-8)로 터치 최소 40px 규약보다 작음: 데스크톱 사이드바 보조 링크에 한한 사용자 명시 예외.
        if (section.label === "바로가기") {
          return (
            <div key={section.label} aria-label="바로가기" className="flex flex-nowrap gap-1 px-1">
              {items.map((item) => {
                const Icon = item.icon;
                return (
                  <a
                    key={item.href}
                    href={item.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={onNavigate}
                    title={`${item.label} — 새 탭에서 열림`}
                    aria-label={`${item.label} (새 탭에서 열림)`}
                    className="grid size-8 shrink-0 place-items-center rounded-md border border-[var(--que-border)] transition-colors hover:bg-[var(--que-bg-muted)] focus-visible:outline-2 focus-visible:outline-[var(--que-brand)]"
                  >
                    <Icon
                      className="size-4 shrink-0"
                      style={item.accentColor ? { color: item.accentColor } : undefined}
                      aria-hidden
                    />
                  </a>
                );
              })}
            </div>
          );
        }

        return (
          <div key={section.label} className="flex flex-col gap-1">
            <p className="px-3 pb-1 text-xs font-medium text-[var(--que-text-tertiary)]">
              {section.label}
            </p>
            {items.map((item) => {
              // `#`으로 시작하는 항목은 라우트가 아니라 모달 액션 — 링크 대신 버튼으로 렌더한다.
              const isAction = item.href.startsWith("#");
              // 외부 링크(다른 도메인 전용 화면) — 새 탭 <a>로 렌더, active 하이라이트 없음.
              const isExternal = item.external ?? item.href.startsWith("http");
              const matchPaths = item.match ?? [item.href];
              const active =
                !isAction && !isExternal && matchPaths.some((path) => pathname.startsWith(path));
              const Icon = item.icon;
              const badgeCount = badges?.[item.href] ?? item.badge ?? 0;

              const children = (item.children ?? []).filter(
                (c) => !c.adminOnly || isAdmin,
              );
              const hasChildren = children.length > 0;
              const expanded = hasChildren ? (openMap[item.href] ?? active) : false;

              const itemClass = cn(
                "flex h-10 items-center gap-3 rounded-lg px-3 text-sm transition-colors",
                "focus-visible:outline-2 focus-visible:outline-[var(--que-brand)]",
                active
                  ? "bg-[var(--que-brand-subtle)] font-semibold text-[var(--que-brand)]"
                  : cn(
                      "text-[var(--que-text-secondary)] hover:bg-[var(--que-bg-muted)] hover:text-[var(--que-text)]",
                      // 최빈 메뉴(데일리·작업 목록) 볼드 강조 — 2026-07-16 사용자 확정.
                      item.emphasized
                        ? "font-semibold text-[var(--que-text)]"
                        : "font-medium",
                    ),
              );
              // navAccent(테마 반응 하이라이트) 우선 → accentColor(개별 아이콘 틴트) 폴백.
              // active의 text-brand 클래스보다 인라인 style이 우선이라 active에서도 하이라이트 유지.
              const iconColorStyle = item.navAccent
                ? { color: "var(--que-nav-accent)" }
                : item.accentColor
                  ? { color: item.accentColor }
                  : undefined;
              const inner = (
                <>
                  <Icon
                    className="size-[18px] shrink-0"
                    // 정체성 컬러/하이라이트(아이콘 틴트 — 배경·뱃지 금지 규약). active여도 유지해 정체성 고정.
                    style={iconColorStyle}
                    aria-hidden
                  />
                  <span
                    className="min-w-0 flex-1 truncate"
                    // navAccent는 텍스트에도 적용(아이콘+텍스트 통일 하이라이트). active의 text-brand보다 우선.
                    style={item.navAccent ? { color: "var(--que-nav-accent)" } : undefined}
                  >
                    {item.label}
                  </span>
                  {badgeCount > 0 ? (
                    <span
                      className="flex h-5 min-w-5 items-center justify-center rounded-full bg-[var(--que-error)] px-1.5 text-[11px] font-semibold text-white"
                      aria-label={`${badgeCount}건`}
                    >
                      {badgeCount}
                    </span>
                  ) : null}
                </>
              );

              if (isAction) {
                return (
                  <button
                    key={item.href}
                    type="button"
                    onClick={() => {
                      window.dispatchEvent(new Event(OPEN_TODO_APP_EVENT));
                      onNavigate?.();
                    }}
                    className={cn(itemClass, "w-full cursor-pointer text-left")}
                  >
                    {inner}
                  </button>
                );
              }

              if (isExternal) {
                // 외부 링크: 새 탭, 포인트 컬러는 아이콘 틴트만(배경·뱃지 금지). 우측에 ExternalLink 표시.
                return (
                  <a
                    key={item.href}
                    href={item.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={onNavigate}
                    className={itemClass}
                  >
                    <Icon
                      className="size-[18px] shrink-0"
                      style={item.accentColor ? { color: item.accentColor } : undefined}
                      aria-hidden
                    />
                    <span className="min-w-0 flex-1 truncate">{item.label}</span>
                    <ExternalLink
                      className="size-3.5 shrink-0 text-[var(--que-text-tertiary)]"
                      aria-label="새 탭에서 열림"
                    />
                  </a>
                );
              }

              const parentLink = (
                <Link
                  href={item.href}
                  onClick={onNavigate}
                  aria-current={active ? "page" : undefined}
                  className={cn(itemClass, hasChildren && "flex-1")}
                >
                  {inner}
                </Link>
              );

              if (!hasChildren) {
                return <div key={item.href}>{parentLink}</div>;
              }

              // 활성 하위 판정: 매치되는 하위 중 최고 점수 하나만 활성화한다.
              let activeChildHref: string | null = null;
              let bestScore = -1;
              if (active) {
                for (const child of children) {
                  const { matches, score } = matchChild(
                    child.href,
                    pathname,
                    searchParams,
                  );
                  if (matches && score > bestScore) {
                    bestScore = score;
                    activeChildHref = child.href;
                  }
                }
              }

              return (
                <div key={item.href} className="flex flex-col">
                  <div className="flex items-center gap-0.5">
                    {parentLink}
                    <button
                      type="button"
                      aria-expanded={expanded}
                      aria-label={`${item.label} 하위 메뉴 ${expanded ? "접기" : "펼치기"}`}
                      onClick={() =>
                        setOpenMap((prev) => ({ ...prev, [item.href]: !expanded }))
                      }
                      className="flex size-10 shrink-0 items-center justify-center rounded-lg text-[var(--que-text-tertiary)] transition-colors hover:bg-[var(--que-bg-muted)] hover:text-[var(--que-text)] focus-visible:outline-2 focus-visible:outline-[var(--que-brand)]"
                    >
                      <ChevronRight
                        className={cn(
                          "size-4 transition-transform",
                          expanded && "rotate-90",
                        )}
                        aria-hidden
                      />
                    </button>
                  </div>
                  {expanded ? (
                    <ul className="ml-[26px] mt-0.5 flex flex-col gap-0.5 border-l border-[var(--que-border)] pl-2">
                      {children.map((child) => {
                        const childActive = child.href === activeChildHref;
                        return (
                          <li key={child.href}>
                            <Link
                              href={child.href}
                              onClick={onNavigate}
                              aria-current={childActive ? "page" : undefined}
                              className={cn(
                                "flex h-10 items-center rounded-lg px-3 text-sm transition-colors",
                                "focus-visible:outline-2 focus-visible:outline-[var(--que-brand)]",
                                childActive
                                  ? "font-semibold text-[var(--que-brand)]"
                                  : "font-medium text-[var(--que-text-secondary)] hover:bg-[var(--que-bg-muted)] hover:text-[var(--que-text)]",
                              )}
                            >
                              {child.label}
                            </Link>
                          </li>
                        );
                      })}
                    </ul>
                  ) : null}
                </div>
              );
            })}
          </div>
        );
      })}
    </nav>
  );
}
