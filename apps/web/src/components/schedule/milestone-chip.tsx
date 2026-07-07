import { Diamond } from "lucide-react";
import type { CalendarMilestone } from "@/lib/calendar-data";
import { cn } from "@/lib/utils";

// 마일스톤 위험 상태 색(상태 색상 의미 고정): 정상=green, 주의=amber, 위험/지연=red.
// 색상 단독 금지 — 아이콘 + 제목 + sr-only 라벨 텍스트를 함께 노출한다.
const RISK = {
  on_track: {
    label: "정상",
    className: "border-[var(--que-success)] bg-[var(--que-success-bg)] text-[var(--que-success)]",
  },
  at_risk: {
    label: "주의",
    className: "border-[var(--que-warning)] bg-[var(--que-warning-bg)] text-[var(--que-warning)]",
  },
  late: {
    label: "지연",
    className: "border-[var(--que-error)] bg-[var(--que-error-bg)] text-[var(--que-error)]",
  },
} as const;

/**
 * 일정 캘린더의 마일스톤 마커. 읽기 전용(드래그·수정 불가) — 클릭 진입점 없이 제목 툴팁만.
 * 관리는 /planning에서 한다. 월간 셀 상단·주간 종일 밴드에서 공용으로 쓴다.
 */
export function MilestoneChip({ milestone }: { milestone: CalendarMilestone }) {
  const risk = RISK[milestone.riskStatus] ?? RISK.on_track;
  return (
    <div
      title={`마일스톤 · ${risk.label} · ${milestone.title} (${milestone.projectName})`}
      className={cn(
        "flex items-center gap-1 truncate rounded border px-1.5 py-0.5 text-[11px] font-medium",
        risk.className,
      )}
    >
      <Diamond className="size-3 shrink-0" aria-hidden />
      <span className="sr-only">마일스톤 {risk.label}: </span>
      <span className="truncate">{milestone.title}</span>
    </div>
  );
}
