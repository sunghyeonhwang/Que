import type { CalendarMilestone } from "@/lib/calendar-data";
import { MilestoneChip as SharedMilestoneChip } from "@/components/milestones/milestone-chip";

/**
 * 일정 캘린더의 마일스톤 마커. 공용 MilestoneChip(그라데이션 정체성 룩)에 위임한다.
 * 관리 권한(canManage)이 있으면 칩 클릭으로 제목·기한·위험 상태를 그 자리에서 수정하고,
 * 없으면 조회 전용 상세만 연다. 월간 셀 상단·주간 종일 밴드에서 공용으로 쓴다.
 */
export function MilestoneChip({ milestone }: { milestone: CalendarMilestone }) {
  return (
    <SharedMilestoneChip
      milestone={{
        id: milestone.id,
        title: milestone.title,
        dueAt: milestone.dueAt,
        riskStatus: milestone.riskStatus,
        // 중요 표시 — 이 래퍼가 필드를 골라 넘기므로 새 필드는 여기도 함께 추가해야 한다
        // (2026-07-13 실사용 버그: critical 누락으로 일정 화면만 일반 그라데이션으로 보임).
        critical: milestone.critical,
        // 완료 시각 — 있으면 공용 칩이 중립 muted + ✓로 렌더(위험 표기 숨김).
        achievedAt: milestone.achievedAt,
        projectName: milestone.projectName,
        canManage: milestone.canManage,
      }}
    />
  );
}
