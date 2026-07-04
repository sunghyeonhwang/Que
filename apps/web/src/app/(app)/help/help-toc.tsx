"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

/** 도움말 목차 — sticky. 스크롤 위치에 따라 지금 보고 있는 섹션을 강조하고, 누르면 부드럽게 이동. */
export function HelpToc({ items }: { items: { id: string; title: string }[] }) {
  const [active, setActive] = useState(items[0]?.id);

  useEffect(() => {
    const els = items
      .map((it) => document.getElementById(it.id))
      .filter((el): el is HTMLElement => !!el);
    const obs = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]) setActive(visible[0].target.id);
      },
      { rootMargin: "-88px 0px -60% 0px", threshold: 0 },
    );
    els.forEach((el) => obs.observe(el));
    return () => obs.disconnect();
  }, [items]);

  return (
    <nav className="sticky top-[88px] self-start" aria-label="도움말 목차">
      <p className="mb-2 px-2 text-xs font-semibold uppercase tracking-wide text-[var(--que-text-tertiary)]">
        목차
      </p>
      <ol className="flex flex-col gap-0.5">
        {items.map((it, i) => (
          <li key={it.id}>
            <a
              href={`#${it.id}`}
              aria-current={active === it.id ? "true" : undefined}
              className={cn(
                "flex gap-2 rounded-lg px-2 py-1.5 text-sm transition-colors",
                active === it.id
                  ? "bg-[var(--que-brand-subtle)] font-medium text-[var(--que-brand)]"
                  : "text-[var(--que-text-secondary)] hover:bg-[var(--que-bg-muted)]",
              )}
            >
              <span className="tabular-nums text-[var(--que-text-tertiary)]">{i + 1}</span>
              <span className="min-w-0">{it.title}</span>
            </a>
          </li>
        ))}
      </ol>
    </nav>
  );
}
