"use client";

import { AnimatePresence, motion } from "motion/react";
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
  // AnimatePresence를 항상 마운트해 두어야 마지막 카드가 빠질 때 섹션 퇴장이 재생된다.
  // (RSC 리렌더는 이 클라이언트 컴포넌트를 언마운트하지 않고 props만 갱신하므로 exit가 동작한다.)
  return (
    <AnimatePresence initial={false}>
      {cards.length > 0 && (
        <motion.section
          key="crisis"
          aria-label="긴급 결정 대기"
          className="overflow-hidden rounded-xl border border-[var(--que-error)]/40 bg-[var(--que-error-bg)] p-4"
          exit={{ opacity: 0, height: 0, marginTop: 0, marginBottom: 0, paddingTop: 0, paddingBottom: 0 }}
          transition={{ duration: 0.25 }}
        >
          <div className="mb-3 flex items-center gap-2">
            <TriangleAlert className="size-5 text-[var(--que-error)]" aria-hidden />
            <h2 className="text-base font-semibold text-[var(--que-text)]">
              긴급 결정 대기 <span className="tabular-nums text-[var(--que-error)]">{cards.length}</span>건
            </h2>
          </div>
          <ul className="flex flex-col gap-3">
            {/* 카드 하나가 빠질 때(다른 카드는 남음)는 해당 li만 접히며 퇴장. */}
            <AnimatePresence initial={false}>
              {cards.map((c) => (
                <motion.li
                  key={c.milestoneId}
                  layout
                  exit={{ opacity: 0, height: 0, marginBottom: 0 }}
                  transition={{ duration: 0.25 }}
                  className="overflow-hidden rounded-lg border border-[var(--que-error)]/30 bg-[var(--que-bg)] p-3"
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
                </motion.li>
              ))}
            </AnimatePresence>
          </ul>
        </motion.section>
      )}
    </AnimatePresence>
  );
}
