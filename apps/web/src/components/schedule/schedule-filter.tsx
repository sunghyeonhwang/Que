"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { SlidersHorizontal } from "lucide-react";
import type { Task } from "@que/core";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field, FieldLabel } from "@/components/ui/field";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const ANY = "__any__";
const PRIORITY_ITEMS: Record<string, string> = {
  [ANY]: "전체",
  high: "높음",
  normal: "보통",
  low: "낮음",
};
const PRIORITY_ORDER: (Task["priority"] | typeof ANY)[] = [ANY, "high", "normal", "low"];

/** ?priority · ?q 로 서버 필터를 세팅/해제하는 팝오버. range/date는 pushParams로 보존한다. */
export function ScheduleFilter() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const urlPriority = searchParams.get("priority") ?? "";
  const urlKeyword = searchParams.get("q") ?? "";
  const activeCount = (urlPriority ? 1 : 0) + (urlKeyword.trim() ? 1 : 0);

  const [open, setOpen] = useState(false);
  const [priority, setPriority] = useState<string>(urlPriority || ANY);
  const [keyword, setKeyword] = useState(urlKeyword);

  // 팝오버를 열 때 URL의 현재 필터로 폼을 동기화한다(effect 대신 오픈 핸들러에서 — 캐스케이드 렌더 회피).
  const onOpenChange = (next: boolean) => {
    if (next) {
      setPriority(urlPriority || ANY);
      setKeyword(urlKeyword);
    }
    setOpen(next);
  };

  const pushParams = (mutate: (p: URLSearchParams) => void) => {
    const params = new URLSearchParams(searchParams.toString());
    mutate(params);
    router.push(`/schedule?${params.toString()}`);
  };

  const apply = () => {
    pushParams((p) => {
      if (priority && priority !== ANY) p.set("priority", priority);
      else p.delete("priority");
      const kw = keyword.trim();
      if (kw) p.set("q", kw);
      else p.delete("q");
    });
    setOpen(false);
  };

  const reset = () => {
    setPriority(ANY);
    setKeyword("");
    pushParams((p) => {
      p.delete("priority");
      p.delete("q");
    });
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger
        render={
          <Button
            variant="outline"
            aria-label={activeCount > 0 ? `필터 (${activeCount}개 적용됨)` : "필터"}
            className="relative size-10 rounded-lg border-[var(--que-border)] p-0"
          />
        }
      >
        <SlidersHorizontal className="size-4" aria-hidden />
        {activeCount > 0 && (
          <span className="absolute -top-1.5 -right-1.5 flex size-4 items-center justify-center rounded-full bg-[var(--que-brand)] text-[10px] font-semibold text-[var(--que-on-brand)] tabular-nums">
            {activeCount}
          </span>
        )}
      </PopoverTrigger>
      <PopoverContent align="end" className="w-72 gap-0 p-0">
        <div className="border-b border-[var(--que-border)] px-3.5 py-3">
          <p className="text-sm font-semibold text-[var(--que-text)]">필터</p>
        </div>

        <div className="flex flex-col gap-3.5 p-3.5">
          <Field>
            <FieldLabel>우선순위</FieldLabel>
            <Select
              items={PRIORITY_ITEMS}
              value={priority}
              onValueChange={(v) => setPriority((v as string) ?? ANY)}
            >
              <SelectTrigger aria-label="우선순위 선택" className="h-10 min-h-10 w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PRIORITY_ORDER.map((p) => (
                  <SelectItem key={p} value={p}>
                    {PRIORITY_ITEMS[p]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-[var(--que-text-tertiary)]">
              작업 우선순위 기준입니다. 켜면 우선순위가 없는 일정(미팅)은 제외됩니다.
            </p>
          </Field>

          <Field>
            <FieldLabel htmlFor="filter-keyword">키워드</FieldLabel>
            <Input
              id="filter-keyword"
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") apply();
              }}
              placeholder="제목으로 검색"
              className="h-10"
            />
          </Field>
        </div>

        <div className="flex items-center justify-between gap-2 border-t border-[var(--que-border)] p-2.5">
          <Button
            variant="ghost"
            className="h-10"
            onClick={reset}
            disabled={activeCount === 0 && priority === ANY && !keyword.trim()}
          >
            초기화
          </Button>
          <Button
            className="h-10 bg-[var(--que-brand)] px-4 text-[var(--que-on-brand)] hover:bg-[var(--que-brand-hover)]"
            onClick={apply}
          >
            적용
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
