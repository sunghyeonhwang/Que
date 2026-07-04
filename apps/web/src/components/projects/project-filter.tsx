"use client";

import { useCallback } from "react";
import { usePathname, useSearchParams, useRouter } from "next/navigation";
import { SlidersHorizontal, RotateCcw } from "lucide-react";
import type { ProjectMeta, PmPriority } from "@/lib/pm-data";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

const PRIORITY_OPTIONS: { value: PmPriority; label: string }[] = [
  { value: "high", label: "높음" },
  { value: "normal", label: "보통" },
  { value: "low", label: "낮음" },
];

/** searchParams 값을 쉼표구분·반복 파라미터 모두 허용해 문자열 배열로. */
function readList(searchParams: URLSearchParams, key: string): string[] {
  return searchParams
    .getAll(key)
    .flatMap((v) => v.split(","))
    .map((s) => s.trim())
    .filter(Boolean);
}

/**
 * 목록/보드 태스크 필터 Popover.
 * 우선순위(OR)·담당자(교집합) 선택을 URL `?priority=&assignee=`(쉼표구분)로 반영한다.
 * page가 이 파라미터로 서버에서 필터하므로 이 컴포넌트는 URL만 갱신한다.
 */
export function ProjectFilter({ meta }: { meta: ProjectMeta }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();

  const activePriority = readList(searchParams, "priority");
  const activeAssignee = readList(searchParams, "assignee");
  const activeCount = activePriority.length + activeAssignee.length;

  const setParam = useCallback(
    (key: "priority" | "assignee", values: string[]) => {
      const params = new URLSearchParams(searchParams.toString());
      params.delete(key);
      if (values.length > 0) params.set(key, values.join(","));
      // 필터 변경 시 열려있던 상세는 유지(task 파라미터 보존)
      const qs = params.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [pathname, router, searchParams],
  );

  const toggle = (key: "priority" | "assignee", value: string, current: string[]) => {
    const next = current.includes(value)
      ? current.filter((v) => v !== value)
      : [...current, value];
    setParam(key, next);
  };

  const reset = () => {
    const params = new URLSearchParams(searchParams.toString());
    params.delete("priority");
    params.delete("assignee");
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  };

  return (
    <Popover>
      <PopoverTrigger
        render={
          <Button
            variant="outline"
            aria-label="필터"
            className="relative size-10 rounded-lg"
          />
        }
      >
        <SlidersHorizontal className="size-4" aria-hidden />
        {activeCount > 0 && (
          <span className="absolute -top-1 -right-1 flex size-4 items-center justify-center rounded-full bg-[var(--que-brand)] text-[10px] font-semibold text-[var(--que-on-brand)]">
            {activeCount}
          </span>
        )}
      </PopoverTrigger>
      <PopoverContent align="end" className="w-64 gap-3">
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold text-[var(--que-text)]">필터</p>
          {activeCount > 0 && (
            <button
              type="button"
              onClick={reset}
              className="flex items-center gap-1 text-xs text-[var(--que-text-tertiary)] hover:text-[var(--que-text)]"
            >
              <RotateCcw className="size-3" aria-hidden />
              초기화
            </button>
          )}
        </div>

        <div className="flex flex-col gap-1.5">
          <p className="text-xs font-medium text-[var(--que-text-secondary)]">우선순위</p>
          {PRIORITY_OPTIONS.map((opt) => (
            <label
              key={opt.value}
              className="flex min-h-10 cursor-pointer items-center gap-2.5 rounded-md px-1 text-sm text-[var(--que-text)] hover:bg-[var(--que-bg-muted)]"
            >
              <Checkbox
                checked={activePriority.includes(opt.value)}
                onCheckedChange={() => toggle("priority", opt.value, activePriority)}
              />
              {opt.label}
            </label>
          ))}
        </div>

        <div className="flex flex-col gap-1.5">
          <p className="text-xs font-medium text-[var(--que-text-secondary)]">담당자</p>
          <div className="max-h-52 overflow-y-auto">
            {meta.members.map((m) => (
              <label
                key={m.id}
                className="flex min-h-10 cursor-pointer items-center gap-2.5 rounded-md px-1 text-sm text-[var(--que-text)] hover:bg-[var(--que-bg-muted)]"
              >
                <Checkbox
                  checked={activeAssignee.includes(m.id)}
                  onCheckedChange={() => toggle("assignee", m.id, activeAssignee)}
                />
                <span
                  className="size-5 shrink-0 rounded-full text-[10px] font-semibold text-white"
                  style={{ backgroundColor: m.avatarColor }}
                  aria-hidden
                >
                  <span className="flex size-5 items-center justify-center">{m.name.slice(1)}</span>
                </span>
                <span className="truncate">{m.name}</span>
              </label>
            ))}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
