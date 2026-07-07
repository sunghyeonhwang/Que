import { ArrowDown, ArrowUp, Minus, type LucideIcon } from "lucide-react";
import type { TaskPriority } from "@/lib/projects-data";
import { cn } from "@/lib/utils";

// 우선순위 뱃지 — 상태 고정색(green/blue/amber/red)·violet(예약)과 겹치지 않는 중립 표현.
// 색 단독 금지: 방향 아이콘(↑/-/↓)을 항상 함께 써 색맹·흑백에서도 구분되게 한다.
const PRIORITY: Record<TaskPriority, { label: string; icon: LucideIcon; className: string }> = {
  high: {
    label: "높음",
    icon: ArrowUp,
    // 진한 중립(강조) — 상태색 아님.
    className:
      "border-transparent bg-[var(--que-text)] text-[var(--que-bg)]",
  },
  normal: {
    label: "보통",
    icon: Minus,
    className:
      "border-[var(--que-border)] bg-[var(--que-bg-muted)] text-[var(--que-text-secondary)]",
  },
  low: {
    label: "낮음",
    icon: ArrowDown,
    className: "border-[var(--que-border)] bg-transparent text-[var(--que-text-tertiary)]",
  },
};

export function PriorityBadge({ priority }: { priority: TaskPriority }) {
  const { label, icon: Icon, className } = PRIORITY[priority];
  return (
    <span
      className={cn(
        "inline-flex h-6 items-center gap-1 rounded-full border px-2 text-xs font-medium",
        className,
      )}
    >
      <Icon className="size-3 shrink-0" aria-hidden />
      {label}
    </span>
  );
}
