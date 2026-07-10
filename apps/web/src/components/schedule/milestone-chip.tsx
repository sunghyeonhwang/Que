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
        projectName: milestone.projectName,
        canManage: milestone.canManage,
      }}
    />
  );
}
