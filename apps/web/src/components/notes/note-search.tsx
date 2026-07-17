"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

/** 회의록 본문 전문 검색(명세 B-5) — 입력을 디바운스해 `?q=`를 URL에 반영한다.
 *  제목·본문·AI 요약 필터는 서버(page)에서 수행하고, 여기선 입력과 URL 동기화·결과 카운트만 맡는다.
 *  기존 URL 파라미터(note 하이라이트 등)는 보존하고, 검색어를 지우면 q만 제거한다. */
export function NoteSearch({
  initialQuery,
  matchCount,
}: {
  initialQuery: string;
  matchCount: number;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [value, setValue] = useState(initialQuery);
  // 외부 내비(뒤로가기 등)로 URL q가 바뀌면 입력도 맞춘다 — 렌더 단계 동기화(React 권장 패턴, effect 미사용).
  const [prevInitial, setPrevInitial] = useState(initialQuery);
  if (initialQuery !== prevInitial) {
    setPrevInitial(initialQuery);
    setValue(initialQuery);
  }

  // 입력을 디바운스해 ?q= 반영 — 외부 시스템(URL) 갱신만 하고 state는 건드리지 않는다.
  useEffect(() => {
    const trimmed = value.trim();
    if (trimmed === initialQuery.trim()) return; // 이미 URL과 동일 — 재푸시 방지(루프 차단)
    const timer = setTimeout(() => {
      const params = new URLSearchParams(searchParams.toString());
      if (trimmed) params.set("q", trimmed);
      else params.delete("q");
      const qs = params.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    }, 300);
    return () => clearTimeout(timer);
  }, [value, initialQuery, pathname, router, searchParams]);

  const clear = () => setValue("");
  const searching = initialQuery.trim().length > 0;

  return (
    <div className="mb-2 flex flex-col gap-1.5">
      <div className="relative">
        <Search
          className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[var(--que-text-tertiary)]"
          aria-hidden
        />
        <Input
          type="search"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="제목·본문·AI 요약 검색"
          aria-label="회의록 검색"
          className="h-10 rounded-lg pl-9 pr-9 text-sm"
        />
        {value && (
          <Button
            type="button"
            variant="ghost"
            aria-label="검색어 지우기"
            onClick={clear}
            className="absolute right-1 top-1/2 size-8 -translate-y-1/2 rounded-md p-0 text-[var(--que-text-tertiary)]"
          >
            <X className="size-4" aria-hidden />
          </Button>
        )}
      </div>
      {searching && (
        <div className="flex items-center gap-2 text-xs text-[var(--que-text-tertiary)]">
          <span className="tabular-nums">“{initialQuery.trim()}” · {matchCount}건 일치</span>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={clear}
            className="h-7 rounded-md px-2 text-xs text-[var(--que-brand)]"
          >
            초기화
          </Button>
        </div>
      )}
    </div>
  );
}
