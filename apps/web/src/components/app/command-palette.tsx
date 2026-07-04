"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ListChecks,
  FileText,
  MessageSquareText,
  Receipt,
  Users,
  Plus,
  ClipboardCheck,
  Milestone,
  CornerDownLeft,
  type LucideIcon,
} from "lucide-react";
import { searchAction } from "@/app/(app)/search-actions";
import type { SearchGroup, SearchKind } from "@/lib/search-data";
import { MENU_SECTIONS } from "@/lib/menu";
import {
  Command,
  CommandDialog,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
} from "@/components/ui/command";

const KIND_ICON: Record<SearchKind, LucideIcon> = {
  task: ListChecks,
  note: FileText,
  action: MessageSquareText,
  payment: Receipt,
  member: Users,
};

// 이동 대상 라우트 — menu.ts를 단일 소스로 사용(홈/일정/성과/작업 목록/팀/팀 현황/확인필요/결제요청/설정).
const NAV_ITEMS = MENU_SECTIONS.flatMap((s) => s.items);

// 빠른 액션 — 자주 쓰는 화면으로 바로 이동(라벨과 목적지가 정확히 일치하는 것만 둔다).
const QUICK_ACTIONS: { id: string; label: string; href: string; icon: LucideIcon }[] = [
  { id: "add-task", label: "작업 추가", href: "/today", icon: Plus },
  { id: "standup", label: "스탠드업 보기", href: "/team?view=standup", icon: ClipboardCheck },
  { id: "payment", label: "결제 요청", href: "/payments", icon: Receipt },
  { id: "meeting-note", label: "회의록 업로드", href: "/meeting-notes", icon: FileText },
  { id: "planning", label: "반복·마일스톤", href: "/planning", icon: Milestone },
];

/**
 * 전역 ⌘K 커맨드 팔레트.
 * - 입력 비면: '이동'(라우트 빠른 이동) + '빠른 액션'.
 * - 입력 있으면: 서버액션 디바운스 검색 → 그룹 결과(작업/회의록/Action/결제/팀원).
 * ↑↓ 이동·Enter 이동·Esc 닫기는 cmdk가 처리한다.
 */
export function CommandPalette() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [groups, setGroups] = useState<SearchGroup[]>([]);
  const [loading, setLoading] = useState(false);
  const reqId = useRef(0);
  const openRef = useRef(false);

  // 열림 상태를 ref로도 추적(전역 keydown 클로저에서 최신값 참조).
  useEffect(() => {
    openRef.current = open;
  }, [open]);

  // 팔레트 열고 닫기. 닫을 때 입력·결과 초기화(다음에 열면 깨끗한 상태).
  // setState는 이벤트 핸들러 안에서만 호출한다(effect 본문 직접 호출 금지).
  const setPaletteOpen = useCallback((next: boolean) => {
    setOpen(next);
    if (!next) {
      setQuery("");
      setGroups([]);
      setLoading(false);
    }
  }, []);

  // 전역 ⌘K / Ctrl+K 로 팔레트 토글. 팔레트가 ⌘K를 소유한다.
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletteOpen(!openRef.current);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [setPaletteOpen]);

  // 디바운스 검색 + 최신 요청만 반영(stale 응답 무시).
  // 빈 입력 정리·상태 갱신 모두 타이머 콜백 안에서만 수행(effect 본문 setState 금지).
  useEffect(() => {
    const q = query.trim();
    const timer = setTimeout(async () => {
      const id = ++reqId.current;
      if (q.length === 0) {
        setGroups([]);
        setLoading(false);
        return;
      }
      setLoading(true);
      try {
        const result = await searchAction(q);
        if (id === reqId.current) {
          setGroups(result);
          setLoading(false);
        }
      } catch {
        if (id === reqId.current) setLoading(false);
      }
    }, q.length === 0 ? 0 : 200);
    return () => clearTimeout(timer);
  }, [query]);

  const go = useCallback(
    (href: string) => {
      setPaletteOpen(false);
      router.push(href);
    },
    [router, setPaletteOpen],
  );

  const hasQuery = query.trim().length > 0;

  return (
    <CommandDialog
      open={open}
      onOpenChange={setPaletteOpen}
      title="커맨드 팔레트"
      description="작업·회의록·Action·결제·팀원을 검색하거나 화면으로 이동합니다."
      className="border-[var(--que-border)] shadow-[var(--que-shadow-md)]"
    >
      <Command shouldFilter={false} className="rounded-none! bg-transparent">
        <CommandInput
          placeholder="검색하거나 이동할 화면을 입력하세요…"
          value={query}
          onValueChange={setQuery}
        />
        <CommandList className="max-h-[60vh]">
        {!hasQuery && (
          <>
            <CommandGroup heading="이동">
              {NAV_ITEMS.map((item) => {
                const Icon = item.icon;
                return (
                  <CommandItem
                    key={item.href}
                    value={`nav:${item.href}`}
                    onSelect={() => go(item.href)}
                    className="min-h-10 gap-2.5"
                  >
                    <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-[var(--que-bg-muted)] text-[var(--que-text-secondary)]">
                      <Icon className="size-4" aria-hidden />
                    </span>
                    <span className="text-sm text-[var(--que-text)]">{item.label}</span>
                  </CommandItem>
                );
              })}
            </CommandGroup>
            <CommandGroup heading="빠른 액션">
              {QUICK_ACTIONS.map((action) => {
                const Icon = action.icon;
                return (
                  <CommandItem
                    key={action.id}
                    value={`action:${action.id}`}
                    onSelect={() => go(action.href)}
                    className="min-h-10 gap-2.5"
                  >
                    <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-[var(--que-brand-subtle)] text-[var(--que-brand)]">
                      <Icon className="size-4" aria-hidden />
                    </span>
                    <span className="text-sm text-[var(--que-text)]">{action.label}</span>
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </>
        )}

        {hasQuery && loading && groups.length === 0 && (
          <CommandEmpty className="text-[var(--que-text-tertiary)]">검색 중…</CommandEmpty>
        )}
        {hasQuery && !loading && groups.length === 0 && (
          <CommandEmpty className="text-[var(--que-text-tertiary)]">
            “{query.trim()}” 검색 결과가 없습니다.
          </CommandEmpty>
        )}

        {hasQuery &&
          groups.map((group) => {
            const Icon = KIND_ICON[group.kind];
            return (
              <CommandGroup key={group.kind} heading={group.label}>
                {group.hits.map((hit) => (
                  <CommandItem
                    key={hit.id}
                    value={hit.id}
                    onSelect={() => go(hit.href)}
                    className="min-h-11 gap-2.5"
                  >
                    <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-[var(--que-brand-subtle)] text-[var(--que-brand)]">
                      <Icon className="size-4" aria-hidden />
                    </span>
                    <span className="flex min-w-0 flex-1 flex-col">
                      <span className="truncate text-sm font-medium text-[var(--que-text)]">
                        {hit.title}
                      </span>
                      <span className="truncate text-xs text-[var(--que-text-tertiary)]">
                        {hit.subtitle}
                      </span>
                    </span>
                    <CornerDownLeft
                      className="size-3.5 shrink-0 opacity-0 text-[var(--que-text-tertiary)] group-data-selected/command-item:opacity-100"
                      aria-hidden
                    />
                  </CommandItem>
                ))}
              </CommandGroup>
            );
          })}
        </CommandList>
      </Command>
    </CommandDialog>
  );
}
