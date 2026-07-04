import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** 홈 대시보드 섹션 카드 — 성과 화면 카드와 동일한 `--que-*` 보더 스타일. */
export function HomeCard({
  title,
  meta,
  action,
  className,
  bodyClassName,
  children,
}: {
  title?: string;
  meta?: string;
  action?: ReactNode;
  className?: string;
  bodyClassName?: string;
  children: ReactNode;
}) {
  return (
    <section
      className={cn(
        "flex min-w-0 flex-col rounded-xl border border-[var(--que-border)] bg-white shadow-[var(--que-shadow-sm)]",
        className,
      )}
    >
      {(title || action) && (
        <header className="flex flex-wrap items-center justify-between gap-2 px-4 pt-4">
          <div className="flex items-center gap-2">
            {title && (
              <h2 className="text-base font-semibold text-[var(--que-text)]">{title}</h2>
            )}
            {meta && (
              <span className="rounded-full bg-[var(--que-bg-muted)] px-2 py-0.5 text-xs font-medium tabular-nums text-[var(--que-text-secondary)]">
                {meta}
              </span>
            )}
          </div>
          {action}
        </header>
      )}
      <div className={cn("min-w-0 p-4", bodyClassName)}>{children}</div>
    </section>
  );
}
