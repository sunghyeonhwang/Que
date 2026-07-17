import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

// 재설계 상태 뱃지 — 상태 색상 의미 고정(CLAUDE.md):
// green=진행/완료 · blue=예정/정보 · amber=주의/대기 · red=문제/취소 · violet=회의록/응답대기.
export type BadgeTone = "green" | "blue" | "amber" | "red" | "violet" | "neutral";

const TONE: Record<BadgeTone, string> = {
  green: "bg-[var(--que-success-bg)] text-[var(--que-success)]",
  blue: "bg-[var(--que-brand-subtle)] text-[var(--que-brand)]",
  amber: "bg-[var(--que-warning-bg)] text-[var(--que-warning)]",
  red: "bg-[var(--que-error-bg)] text-[var(--que-error)]",
  violet: "bg-[var(--que-violet-bg)] text-[var(--que-violet)]",
  neutral: "bg-[var(--que-bg-muted)] text-[var(--que-text-secondary)]",
};

/** 알약형 상태 뱃지. 프로젝트/성과 재설계 화면의 PriorityBadge와 같은 룩앤필.
 *  ariaLabel: 축약 표기(예: "처리 3/5")를 스크린리더에 풀어 읽히고 싶을 때 지정한다. */
export function ToneBadge({
  tone,
  className,
  ariaLabel,
  children,
}: {
  tone: BadgeTone;
  className?: string;
  ariaLabel?: string;
  children: ReactNode;
}) {
  return (
    <span
      aria-label={ariaLabel}
      className={cn(
        "inline-flex h-6 shrink-0 items-center gap-1 rounded-full px-2.5 text-xs font-medium whitespace-nowrap",
        "[&>svg]:size-3",
        TONE[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}
