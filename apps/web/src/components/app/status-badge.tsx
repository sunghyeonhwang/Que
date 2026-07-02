import { TASK_STATUS_LABELS, type TaskStatus } from "@que/core";
import { Badge } from "@/components/ui/badge";
import {
  AlertTriangle,
  Check,
  Clock,
  GitMerge,
  Pause,
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
