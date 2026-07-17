"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Search,
  ListChecks,
  FileText,
  MessageSquareText,
  Receipt,
  Users,
  Gavel,
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
  decision: Gavel,
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

  // ⌘K는 CommandPalette가 소유한다(전역 팔레트). 여기선 인라인 검색만.
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
        id="global-search-input"
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
        className="h-11 rounded-full border-[var(--que-border)] bg-[var(--que-bg-muted)] pl-10 pr-4 text-sm placeholder:text-[var(--que-placeholder)]"
      />

      {showPanel && (
        <div
          id="global-search-results"
          role="listbox"
          className="absolute top-[calc(100%+6px)] left-0 z-50 max-h-[70vh] w-full overflow-y-auto rounded-xl border border-[var(--que-border)] bg-[var(--que-bg)] p-1.5 shadow-lg"
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
                {group.total > group.hits.length && (
                  <Link
                    href={group.listHref}
                    onClick={() => go(group.listHref)}
                    className="flex items-center justify-between gap-2 rounded-lg px-2.5 py-2 text-xs text-[var(--que-text-secondary)] hover:bg-[var(--que-bg-muted)] focus-visible:bg-[var(--que-bg-muted)] focus-visible:outline-none"
                  >
                    <span>{group.total - group.hits.length}건 더 있음</span>
                    <span className="font-medium text-[var(--que-brand)]">전체 보기 →</span>
                  </Link>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
