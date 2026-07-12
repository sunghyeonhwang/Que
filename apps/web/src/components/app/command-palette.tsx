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
  Sparkles,
  type LucideIcon,
} from "lucide-react";
import { searchAction } from "@/app/(app)/search-actions";
import type { SearchGroup, SearchKind } from "@/lib/search-data";
import { MENU_SECTIONS } from "@/lib/menu";
import { CopilotChat } from "@/components/app/copilot-chat";
import {
  Command,
  CommandDialog,
  CommandInput,
  CommandList,
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
// `#`으로 시작하는 항목(예: #todo-app)은 라우트가 아니라 모달 액션이라 '이동' 목록에서 제외한다.
const NAV_ITEMS = MENU_SECTIONS.flatMap((s) => s.items).filter((i) => !i.href.startsWith("#"));

// 빠른 액션 — 자주 쓰는 화면으로 바로 이동(라벨과 목적지가 정확히 일치하는 것만 둔다).
const QUICK_ACTIONS: { id: string; label: string; href: string; icon: LucideIcon }[] = [
  { id: "add-task", label: "작업 추가", href: "/today", icon: Plus },
  { id: "standup", label: "스탠드업 보기", href: "/daily", icon: ClipboardCheck },
  { id: "payment", label: "결제 요청", href: "/payments", icon: Receipt },
  { id: "meeting-note", label: "회의록 업로드", href: "/meeting-notes", icon: FileText },
  { id: "planning", label: "반복·마일스톤", href: "/planning", icon: Milestone },
];

/**
 * 전역 ⌘K 커맨드 팔레트.
 * - 입력 비면: '이동'(라우트 빠른 이동) + '빠른 액션'.
 * - 입력 있으면: 서버액션 디바운스 검색 → 그룹 결과(작업/회의록/Action/결제/팀원).
 * - 어느 경우든 목록 맨 아래에 항상 `✨ AI에게 묻기`(Que Copilot 진입) — 선택 시 chat 모드로 확장(기획 D-4).
 * ↑↓ 이동·Enter 이동·Esc 닫기는 cmdk가 처리한다(chat 모드의 Esc는 CopilotChat이 캡처해 검색 복귀).
 */
export function CommandPalette() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [groups, setGroups] = useState<SearchGroup[]>([]);
  const [loading, setLoading] = useState(false);
  // 팔레트 뷰 모드 — "search"(검색·이동) | "chat"(Que Copilot). seedQuestion은 chat 진입 시 첫 질문.
  const [mode, setMode] = useState<"search" | "chat">("search");
  const [seedQuestion, setSeedQuestion] = useState<string>("");
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
      // 닫을 때 검색 모드로 리셋(다음에 열면 검색부터 — 채팅 이력은 세션 로컬이라 사라진다).
      setMode("search");
      setSeedQuestion("");
    }
  }, []);

  // AI에게 묻기 진입 — 현재 입력을 seed로 넘기고 chat 모드로 확장.
  const openChat = useCallback((seed: string) => {
    setSeedQuestion(seed.trim());
    setMode("chat");
  }, []);

  // chat → 검색 복귀(← 검색으로 / Esc). seed는 비워 재진입 시 재전송 방지.
  const backToSearch = useCallback(() => {
    setMode("search");
    setSeedQuestion("");
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
  const isChat = mode === "chat";

  return (
    <CommandDialog
      open={open}
      onOpenChange={setPaletteOpen}
      title="커맨드 팔레트"
      description="작업·회의록·Action·결제·팀원을 검색하거나 화면으로 이동합니다."
      className={
        isChat
          ? "border-[var(--que-border)] shadow-[var(--que-shadow-md)] sm:max-w-2xl"
          : "border-[var(--que-border)] shadow-[var(--que-shadow-md)]"
      }
    >
      {isChat ? (
        <CopilotChat
          seedQuestion={seedQuestion}
          onNavigate={go}
          onBackToSearch={backToSearch}
        />
      ) : (
      <Command shouldFilter={false} className="rounded-none! bg-transparent">
        <CommandInput
          placeholder="검색하거나 이동할 화면을 입력하세요…"
          value={query}
          onValueChange={setQuery}
        />
        <CommandList className="max-h-[60vh]">
        {/* 항상 노출되는 AI 진입 — **맨 위 고정**(2026-07-12 사용자 피드백: 첫 항목=Enter 한 번).
            shouldFilter=false라 검색어와 무관하게 유지된다. 기획 D-4의 "질문이면 자연히 첫 번째"를
            상시 첫 번째로 승격 — 검색 히트는 그 아래 그룹들로 여전히 접근 가능. */}
        <CommandGroup heading="Que Copilot">
          <CommandItem
            value="ai:ask"
            onSelect={() => openChat(query)}
            className="min-h-11 gap-2.5"
          >
            <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-[var(--que-brand-subtle)] text-[var(--que-brand)]">
              <Sparkles className="size-4" aria-hidden />
            </span>
            <span className="min-w-0 flex-1 truncate text-sm text-[var(--que-text)]">
              {hasQuery ? (
                <>
                  ✨ AI에게 묻기: <span className="font-medium">“{query.trim()}”</span>
                </>
              ) : (
                "✨ AI에게 물어보기"
              )}
            </span>
            <CornerDownLeft
              className="size-3.5 shrink-0 opacity-0 text-[var(--que-text-tertiary)] group-data-selected/command-item:opacity-100"
              aria-hidden
            />
          </CommandItem>
        </CommandGroup>

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

        {/* AI 항목이 항상 있어 cmdk의 CommandEmpty(0건일 때만)가 뜨지 않으므로 안내는 일반 텍스트로 렌더. */}
        {hasQuery && loading && groups.length === 0 && (
          <p className="px-2 py-4 text-center text-sm text-[var(--que-text-tertiary)]">검색 중…</p>
        )}
        {hasQuery && !loading && groups.length === 0 && (
          <p className="px-2 py-4 text-center text-sm text-[var(--que-text-tertiary)]">
            “{query.trim()}” 검색 결과가 없습니다.
          </p>
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
                {group.total > group.hits.length && (
                  <CommandItem
                    value={`more:${group.kind}`}
                    onSelect={() => go(group.listHref)}
                    className="min-h-10 justify-between gap-2 text-xs text-[var(--que-text-secondary)]"
                  >
                    <span>{group.total - group.hits.length}건 더 있음</span>
                    <span className="font-medium text-[var(--que-brand)]">전체 보기 →</span>
                  </CommandItem>
                )}
              </CommandGroup>
            );
          })}

        </CommandList>
      </Command>
      )}
    </CommandDialog>
  );
}
