"use client";

import { TriangleAlert } from "lucide-react";
import { MilestoneDecision } from "@/components/daily/milestone-decision";

// 긴급 결정 대기 카드(기획 §1-e) — /daily 상단 red 계열 섹션. 판정은 서버 detectCrisisTriggers 재사용
// (이중 로직 금지). 담당자·관리자만 결정 버튼을 보고, 그 외에는 조회 전용 안내(서버가 최종 강제).

export interface CrisisCard {
  milestoneId: string;
  title: string;
  projectName: string;
  dueDateKey: string;
  reasonText: string;
  progress: number;
  doneCount: number;
  totalCount: number;
  canManage: boolean;
}

export function CrisisDecisionCards({ cards }: { cards: CrisisCard[] }) {
  if (cards.length === 0) return null;

  return (
    <section
      aria-label="긴급 결정 대기"
      className="rounded-xl border border-[var(--que-error)]/40 bg-[var(--que-error-bg)] p-4"
    >
      <div className="mb-3 flex items-center gap-2">
        <TriangleAlert className="size-5 text-[var(--que-error)]" aria-hidden />
        <h2 className="text-base font-semibold text-[var(--que-text)]">
          긴급 결정 대기 <span className="tabular-nums text-[var(--que-error)]">{cards.length}</span>건
        </h2>
      </div>
      <ul className="flex flex-col gap-3">
        {cards.map((c) => (
          <li
            key={c.milestoneId}
            className="rounded-lg border border-[var(--que-error)]/30 bg-[var(--que-bg)] p-3"
          >
            <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
              <p className="text-base font-semibold text-[var(--que-text)]">
                {c.title}
                <span className="ml-2 text-sm font-normal text-[var(--que-text-tertiary)]">
                  {c.projectName}
                </span>
              </p>
              <span className="text-sm tabular-nums text-[var(--que-text-secondary)]">
                마감 {c.dueDateKey} · 진행률 {c.progress}% ({c.doneCount}/{c.totalCount})
              </span>
            </div>
            <p className="mt-1 text-sm text-[var(--que-text-secondary)]">{c.reasonText}</p>
            <div className="mt-3">
              <MilestoneDecision milestoneId={c.milestoneId} canManage={c.canManage} />
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
