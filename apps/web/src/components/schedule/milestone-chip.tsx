import { Diamond } from "lucide-react";
import type { CalendarMilestone } from "@/lib/calendar-data";
import { cn } from "@/lib/utils";

// 마일스톤 위험 상태 라벨. 시각 스타일은 그라데이션 강조(2026-07-11 사용자 지정)로 통일하고,
// 위험 상태는 툴팁 + sr-only 텍스트로 전달한다(색상 단독 금지 원칙 유지).
const RISK = {
  on_track: { label: "정상" },
  at_risk: { label: "주의" },
  late: { label: "지연" },
} as const;

/**
 * 일정 캘린더의 마일스톤 마커. 읽기 전용(드래그·수정 불가) — 클릭 진입점 없이 제목 툴팁만.
 * 관리는 /planning에서 한다. 월간 셀 상단·주간 종일 밴드에서 공용으로 쓴다.
 * 스타일은 사용자 지정(2026-07-11): 시안→옐로 그라데이션 + shimmer(AI 브리핑 버튼과 동일 효과),
 * 일반 일정 칩(11px)보다 한 단계 큰 12px, 폰트 컬러 #00ffa2.
 */
export function MilestoneChip({ milestone }: { milestone: CalendarMilestone }) {
  const risk = RISK[milestone.riskStatus] ?? RISK.on_track;
  return (
    <div
      title={`마일스톤 · ${risk.label} · ${milestone.title} (${milestone.projectName})`}
      className={cn(
        "que-shimmer-btn flex items-center gap-1 truncate rounded px-1.5 py-0.5 text-xs font-semibold",
        "bg-[linear-gradient(144deg,rgba(0,242,255,1)_0%,rgba(255,247,0,1)_100%)] text-[#00ffa2]",
      )}
    >
      <Diamond className="size-3 shrink-0" aria-hidden />
      <span className="sr-only">마일스톤 {risk.label}: </span>
      <span className="truncate">{milestone.title}</span>
    </div>
  );
}
