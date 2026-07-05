"use client";

import { useId, useState, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

/** 현황 보조 섹션(내 타임라인·자동 체크인·하루 마감·주의 필요) 묶음 토글.
 *  목록 공간을 위해 한 번에 접고 펼친다. 애니메이션은 grid-rows 전환(과하지 않게),
 *  reduced-motion에서는 즉시 전환(motion-reduce:transition-none).
 *  닫힘 상태에서는 inert로 내부 포커스를 막아 접근성을 유지한다. */
export function CollapsibleDetails({
  title,
  summary,
  defaultOpen = true,
  children,
}: {
  title: string;
  summary?: string;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const regionId = useId();

  return (
    <section aria-label={title} className="flex flex-col">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={regionId}
        onClick={() => setOpen((value) => !value)}
        className={cn(
          "flex h-11 w-full items-center justify-between gap-3 rounded-lg border border-[var(--que-border)] bg-[var(--que-bg)] px-4 text-sm font-medium text-[var(--que-text)] transition-colors outline-none",
          "hover:bg-[var(--que-bg-muted)] focus-visible:ring-2 focus-visible:ring-[var(--que-brand)]",
        )}
      >
        <span className="flex min-w-0 items-center gap-2">
          <span className="truncate">{title}</span>
          {summary && (
            <span className="truncate text-xs font-normal text-[var(--que-text-tertiary)]">
              {summary}
            </span>
          )}
        </span>
        <ChevronDown
          aria-hidden
          className={cn(
            "size-4 shrink-0 text-[var(--que-text-tertiary)] transition-transform duration-200 motion-reduce:transition-none",
            open && "rotate-180",
          )}
        />
      </button>

      <div
        className={cn(
          "grid transition-[grid-template-rows] duration-300 ease-out motion-reduce:transition-none",
          open ? "grid-rows-[1fr]" : "grid-rows-[0fr]",
        )}
      >
        <div
          id={regionId}
          inert={!open}
          className="min-h-0 overflow-hidden"
        >
          <div className="grid gap-3 pt-3 md:grid-cols-2">{children}</div>
        </div>
      </div>
    </section>
  );
}
