"use client";

import { Flag } from "lucide-react";
import type { ProjectMilestone } from "@/lib/projects-data";
import { MilestoneChip } from "@/components/milestones/milestone-chip";

/**
 * 보드·목록 뷰 상단의 "다가오는 마일스톤" 띠. 프로젝트 헤더 근처에서 기한이 임박한 마일스톤을
 * 그라데이션 칩으로 한 줄 노출한다(칩 클릭 → 상세/수정 — 권한 있을 때만). 내부 가로 스크롤이라
 * 페이지 레이아웃을 깨지 않는다. 오늘 이후 기한만(지난 것은 셀·간트에서 확인).
 */
export function MilestoneStrip({ milestones }: { milestones: ProjectMilestone[] }) {
  const todayKey = new Date().toISOString().slice(0, 10);
  const upcoming = milestones.filter((m) => m.day >= todayKey);
  if (upcoming.length === 0) return null;

  return (
    <div className="mt-3 flex items-center gap-2 rounded-xl border border-[var(--que-border)] bg-[var(--que-bg)] px-3 py-2">
      <span className="flex shrink-0 items-center gap-1.5 text-xs font-medium text-[var(--que-text-secondary)]">
        <Flag className="size-3.5" aria-hidden />
        다가오는 마일스톤
      </span>
      <div className="flex min-w-0 flex-1 items-center gap-1.5 overflow-x-auto">
        {upcoming.map((m) => (
          <MilestoneChip key={m.id} milestone={m} size="sm" truncate={false} className="shrink-0" />
        ))}
      </div>
    </div>
  );
}
