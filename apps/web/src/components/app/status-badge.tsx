import {
  ACTION_ITEM_STATUS_LABELS,
  TASK_STATUS_LABELS,
  type ActionItemStatus,
  type TaskStatus,
} from "@que/core";
import { Badge } from "@/components/ui/badge";
import {
  AlertTriangle,
  Check,
  Clock,
  GitMerge,
  Pause,
  X,
  type LucideIcon,
} from "lucide-react";

// DESIGN.md 10장 "Que 상태 표현" 매핑. 색상만으로 상태를 구분하지 않도록
// 보조 아이콘을 함께 쓴다.
const STATUS_BADGE: Record<
  TaskStatus,
  { variant: "default" | "secondary" | "outline" | "destructive"; icon?: LucideIcon; dim?: boolean }
> = {
  scheduled: { variant: "secondary" },
  in_progress: { variant: "default" },
  done: { variant: "default", icon: Check, dim: true },
  needs_reschedule: { variant: "secondary", icon: Clock },
  on_hold: { variant: "secondary", icon: Pause },
  issue: { variant: "destructive", icon: AlertTriangle },
  cancelled: { variant: "destructive", dim: true },
  merged: { variant: "outline", icon: GitMerge },
};

export function StatusBadge({ status }: { status: TaskStatus }) {
  const config = STATUS_BADGE[status];
  const Icon = config.icon;
  return (
    <Badge variant={config.variant} className={config.dim ? "opacity-60" : undefined}>
      {Icon && <Icon className="size-3" aria-hidden />}
      {TASK_STATUS_LABELS[status]}
    </Badge>
  );
}

// Action 상태도 같은 컬럼에서 StatusBadge와 동일한 시각 리듬(아이콘+라벨)을 갖게 한다.
// 색 의미는 기존 매핑 유지 — 확인 필요만 destructive, 나머지는 secondary(새 색 의미 도입 없음).
const ACTION_BADGE: Record<
  ActionItemStatus,
  { variant: "default" | "secondary" | "outline" | "destructive"; icon?: LucideIcon; dim?: boolean }
> = {
  needs_review: { variant: "destructive", icon: AlertTriangle },
  candidate: { variant: "secondary", icon: Clock },
  created: { variant: "secondary", icon: Check, dim: true },
  held: { variant: "secondary", icon: Pause },
  ignored: { variant: "outline", icon: X, dim: true },
};

export function ActionStatusBadge({ status }: { status: ActionItemStatus }) {
  const config = ACTION_BADGE[status];
  const Icon = config.icon;
  return (
    <Badge variant={config.variant} className={config.dim ? "opacity-60" : undefined}>
      {Icon && <Icon className="size-3" aria-hidden />}
      {ACTION_ITEM_STATUS_LABELS[status]}
    </Badge>
  );
}
