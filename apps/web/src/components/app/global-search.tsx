"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Search,
  ListChecks,
  FileText,
  MessageSquareText,
  Receipt,
  Users,
  type LucideIcon,
} from "lucide-react";
import { searchAction } from "@/app/(app)/search-actions";
import type { SearchGroup, SearchKind } from "@/lib/search-data";
import { Input } from "@/components/ui/input";

const KIND_ICON: Record<SearchKind, LucideIcon> = {
  task: ListChecks,
  note: FileText,
  action: MessageSquareText,
  payment: Receipt,
  member: Users,
};

/** 상단바 전역 검색 — 입력 시 서버액션으로 조회해 그룹 결과를 드롭다운으로 보여준다. */
export function GlobalSearch() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [groups, setGroups] = useState<SearchGroup[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const reqId = useRef(0);
  const blurTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  // 플랫폼 감지 — kbd 힌트 표기용. SSR 스냅샷은 false, 클라이언트에서만 판별(하이드레이션 안전).
  const isMac = useSyncExternalStore(
    () => () => {},
    () => /mac|iphone|ipad|ipod/i.test(navigator.platform),
    () => false,
  );

  // ⌘K / Ctrl+K 로 검색 입력에 포커스. 기존 검색 동작은 불변.
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  // 디바운스 검색 + 최신 요청만 반영(stale 응답 무시).
  // setState는 전부 디바운스 콜백 안에서만 호출한다(effect 본문 직접 호출 금지).
  useEffect(() => {
    const q = query.trim();
    if (q.length === 0) return;
    const timer = setTimeout(async () => {
      const id = ++reqId.current;
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
    }, 200);
    return () => clearTimeout(timer);
  }, [query]);

  useEffect(() => () => {
    if (blurTimer.current) clearTimeout(blurTimer.current);
  }, []);

  const flat = groups.flatMap((g) => g.hits);
  const showPanel = open && query.trim().length > 0;

  const go = (href: string) => {
    setOpen(false);
    setQuery("");
    setGroups([]);
    router.push(href);
  };

  return (
    <div className="relative w-full">
      <Search
        className="pointer-events-none absolute top-1/2 left-3.5 z-10 size-4 -translate-y-1/2 text-[var(--que-placeholder)]"
        aria-hidden
      />
      <Input
        ref={inputRef}
        type="search"
        role="combobox"
        aria-expanded={showPanel}
        aria-controls="global-search-results"
        placeholder="작업·회의록·결제·팀원 검색…"
        aria-label="검색"
        value={query}
        onChange={(e) => {
          const next = e.target.value;
          setQuery(next);
          if (next.trim().length > 0) setLoading(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => {
          blurTimer.current = setTimeout(() => setOpen(false), 150);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter" && flat.length > 0) {
            e.preventDefault();
            go(flat[0].href);
          } else if (e.key === "Escape") {
            setOpen(false);
            (e.target as HTMLInputElement).blur();
          }
        }}
        className="h-11 rounded-full border-[var(--que-border)] bg-[var(--que-bg-muted)] pl-10 pr-14 text-sm placeholder:text-[var(--que-placeholder)]"
      />

      {!open && query.trim().length === 0 && (
        <kbd
          aria-hidden
          className="pointer-events-none absolute top-1/2 right-3.5 z-10 hidden -translate-y-1/2 items-center gap-0.5 rounded-md border border-[var(--que-border)] bg-[var(--que-bg)] px-1.5 py-0.5 font-sans text-[11px] leading-none font-medium text-[var(--que-text-tertiary)] sm:inline-flex"
        >
          {isMac ? "⌘K" : "Ctrl K"}
        </kbd>
      )}

      {showPanel && (
        <div
          id="global-search-results"
          role="listbox"
          className="absolute top-[calc(100%+6px)] left-0 z-50 max-h-[70vh] w-full overflow-y-auto rounded-xl border border-[var(--que-border)] bg-white p-1.5 shadow-lg"
        >
          {loading && flat.length === 0 && (
            <p className="px-3 py-6 text-center text-sm text-[var(--que-text-tertiary)]">
              검색 중…
            </p>
          )}
          {!loading && flat.length === 0 && (
            <p className="px-3 py-6 text-center text-sm text-[var(--que-text-tertiary)]">
              “{query.trim()}” 검색 결과가 없습니다.
            </p>
          )}
          {groups.map((group) => {
            const Icon = KIND_ICON[group.kind];
            return (
              <div key={group.kind} className="mb-1 last:mb-0">
                <p className="px-2.5 pt-2 pb-1 text-xs font-medium text-[var(--que-text-tertiary)]">
                  {group.label}
                </p>
                {group.hits.map((hit) => (
                  <Link
                    key={hit.id}
                    href={hit.href}
                    onClick={() => go(hit.href)}
                    className="flex items-center gap-2.5 rounded-lg px-2.5 py-2 hover:bg-[var(--que-bg-muted)] focus-visible:bg-[var(--que-bg-muted)] focus-visible:outline-none"
                  >
                    <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-[var(--que-brand-subtle)] text-[var(--que-brand)]">
                      <Icon className="size-4" aria-hidden />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-[var(--que-text)]">
                        {hit.title}
                      </span>
                      <span className="block truncate text-xs text-[var(--que-text-tertiary)]">
                        {hit.subtitle}
                      </span>
                    </span>
                  </Link>
                ))}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
