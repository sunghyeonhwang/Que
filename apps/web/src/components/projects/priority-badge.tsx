import type { TaskPriority } from "@/lib/projects-data";

// 우선순위 뱃지 — 높음=red · 보통=amber · 낮음=green (redesign-plan 규칙).
const PRIORITY: Record<TaskPriority, { label: string; className: string }> = {
  high: {
    label: "높음",
    className: "bg-[var(--que-error-bg)] text-[var(--que-error)]",
  },
  normal: {
    label: "보통",
    className: "bg-[var(--que-warning-bg)] text-[var(--que-warning)]",
  },
  low: {
    label: "낮음",
    className: "bg-[var(--que-success-bg)] text-[var(--que-success)]",
  },
};

export function PriorityBadge({ priority }: { priority: TaskPriority }) {
  const { label, className } = PRIORITY[priority];
  return (
    <span
      className={
        "inline-flex h-6 items-center rounded-full px-2.5 text-xs font-medium " + className
      }
    >
      {label}
    </span>
  );
}
