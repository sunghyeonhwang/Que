"use client";

import { useEffect, useState } from "react";
import { format } from "date-fns";
import { Check } from "lucide-react";
import type { ChangeRequestStage } from "@que/core";
import { advanceChangeRequestStageAction } from "@/app/(app)/daily/change-actions";
import { useSafeAction } from "@/components/app/use-safe-action";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// OS-2b 외부 변경 대응 카드(부록 C, 시안 ③). 5단계 프로그레스 + 24h SLA 카운트다운.
// 진행은 순서 강제(건너뛰기 불가), 승인은 admin만 — core mutation이 최종 강제한다.

/** 5단계 순서·라벨(change-request-data와 동일 — client 전용 복제). */
const STAGES: { key: ChangeRequestStage; label: string }[] = [
  { key: "received", label: "접수" },
  { key: "impact_analyzed", label: "영향 분석" },
  { key: "renegotiated", label: "재협의" },
  { key: "approved", label: "승인" },
  { key: "closed", label: "종결" },
];

/** 현재 단계에서 진행할 다음 단계와 버튼 라벨(부록 C). approved는 admin만. */
const NEXT_STEP: Partial<
  Record<ChangeRequestStage, { to: ChangeRequestStage; label: string; adminOnly: boolean }>
> = {
  received: { to: "impact_analyzed", label: "영향 분석 완료로", adminOnly: false },
  impact_analyzed: { to: "renegotiated", label: "재협의 완료로", adminOnly: false },
  renegotiated: { to: "approved", label: "승인", adminOnly: true },
  approved: { to: "closed", label: "종결", adminOnly: false },
};

export interface ChangeRequestCardData {
  id: string;
  title: string;
  stage: ChangeRequestStage;
  projectName: string;
  milestoneTitle?: string;
  /** 영향 분석 마감(ISO) — 라이브 카운트다운 기준. */
  impactDeadline: string;
  relatedTaskCount: number;
  stageLog: { stage: ChangeRequestStage; at: string; byName: string }[];
}

/** ms → "N시간 N분" (음수는 절댓값). */
function humanize(ms: number): string {
  const abs = Math.abs(ms);
  const h = Math.floor(abs / 3_600_000);
  const m = Math.floor((abs % 3_600_000) / 60_000);
  return h > 0 ? `${h}시간 ${m}분` : `${m}분`;
}

export function ChangeRequestCard({
  data,
  canManage,
  isAdmin,
}: {
  data: ChangeRequestCardData;
  /** 프로젝트 담당자 또는 관리자(단계 진행 버튼 노출). */
  canManage: boolean;
  /** 관리자(승인 단계 진행 가능). */
  isAdmin: boolean;
}) {
  const { run, pending } = useSafeAction();
  const stageIndex = STAGES.findIndex((s) => s.key === data.stage);
  const next = NEXT_STEP[data.stage];

  // SLA 카운트다운 — 영향 분석 대기(stage=received)일 때만 라이브 계산.
  const showSla = data.stage === "received";
  const [remaining, setRemaining] = useState(() => Date.parse(data.impactDeadline) - Date.now());
  useEffect(() => {
    if (!showSla) return;
    const tick = () => setRemaining(Date.parse(data.impactDeadline) - Date.now());
    tick();
    const id = setInterval(tick, 30_000);
    return () => clearInterval(id);
  }, [showSla, data.impactDeadline]);
  const overdue = remaining < 0;

  // 완료 단계별 시각·담당 조회(접수 스텝 등에 "7/11 10:20 승훈" 표기).
  const logByStage = new Map(data.stageLog.map((l) => [l.stage, l]));

  const advance = () => {
    if (!next) return;
    run(() => advanceChangeRequestStageAction({ changeRequestId: data.id, toStage: next.to }), {
      success: "다음 단계로 진행했습니다.",
    });
  };

  const nextDisabled = pending || (next?.adminOnly && !isAdmin);

  return (
    <div className="rounded-xl border border-[var(--que-border)] bg-[var(--que-bg)] p-4 shadow-[var(--que-shadow-sm)]">
      <div className="flex flex-wrap items-center gap-2">
        <span className="inline-flex items-center rounded-full border border-[var(--que-error)]/40 px-2 py-0.5 text-[11px] font-medium text-[var(--que-error)]">
          외부 변경
        </span>
        <span className="min-w-0 flex-1 truncate text-sm font-semibold text-[var(--que-text)]">
          {data.title}
        </span>
        {showSla ? (
          <span
            className={cn(
              "shrink-0 text-xs font-semibold tabular-nums",
              overdue ? "text-[var(--que-error)]" : "text-[var(--que-warning)]",
            )}
          >
            {overdue
              ? `SLA 초과 ${humanize(remaining)}`
              : `영향 분석 마감까지 ${humanize(remaining)}`}
          </span>
        ) : null}
      </div>

      {/* 5단계 프로그레스 — 완료=green·현재=amber 링 */}
      <ol className="mt-4 flex items-start">
        {STAGES.map((s, i) => {
          const done = i <= stageIndex;
          const isNow = i === stageIndex + 1 && data.stage !== "closed";
          const log = logByStage.get(s.key);
          return (
            <li
              key={s.key}
              className="relative flex flex-1 flex-col items-center gap-1.5 text-center"
            >
              {/* 연결선 — 이전 스텝이 완료면 green */}
              {i > 0 ? (
                <span
                  aria-hidden
                  className={cn(
                    "absolute right-1/2 top-3 h-0.5 w-full",
                    i <= stageIndex ? "bg-[var(--que-success)]" : "bg-[var(--que-border)]",
                  )}
                />
              ) : null}
              <span
                className={cn(
                  "relative z-10 grid size-6 place-items-center rounded-full border-2 text-[11px] font-bold tabular-nums",
                  done
                    ? "border-[var(--que-success)] bg-[var(--que-success)] text-[var(--que-success-fg)]"
                    : isNow
                      ? "border-[var(--que-warning)] text-[var(--que-warning)] ring-4 ring-[var(--que-warning)]/15"
                      : "border-[var(--que-border)] bg-[var(--que-bg-muted)] text-[var(--que-text-tertiary)]",
                )}
              >
                {done ? <Check className="size-3.5" aria-hidden /> : i + 1}
              </span>
              <span
                className={cn(
                  "text-[11px] leading-tight",
                  done || isNow ? "text-[var(--que-text)]" : "text-[var(--que-text-tertiary)]",
                )}
              >
                {s.label}
              </span>
              {log ? (
                <span className="text-[10px] leading-tight text-[var(--que-text-tertiary)]">
                  {format(new Date(log.at), "M/d HH:mm")} {log.byName}
                </span>
              ) : s.key === "approved" ? (
                <span className="text-[10px] leading-tight text-[var(--que-text-tertiary)]">
                  관리자
                </span>
              ) : isNow && showSla ? (
                <span className="text-[10px] leading-tight text-[var(--que-text-tertiary)]">
                  24h SLA
                </span>
              ) : null}
            </li>
          );
        })}
      </ol>

      <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-[var(--que-border)] pt-3">
        <span className="min-w-0 flex-1 truncate text-xs text-[var(--que-text-tertiary)]">
          {data.milestoneTitle ? `연결: 마일스톤 「${data.milestoneTitle}」 · ` : ""}
          관련 작업 {data.relatedTaskCount}건
        </span>
        {canManage && next ? (
          <Button
            size="sm"
            className="h-10 shrink-0"
            disabled={nextDisabled}
            onClick={advance}
            title={next.adminOnly && !isAdmin ? "승인 단계는 관리자만 진행할 수 있습니다." : undefined}
          >
            {next.label}
          </Button>
        ) : null}
      </div>
    </div>
  );
}
