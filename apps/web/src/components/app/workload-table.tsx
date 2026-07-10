"use client";

import { useState } from "react";
import Link from "next/link";
import { Info, Shuffle, SlidersHorizontal } from "lucide-react";
import type { HomeLoad, HomeLoadRow } from "@/lib/home-load";
import { WorkloadReassignSheet } from "@/components/app/workload-reassign-sheet";
import { cn } from "@/lib/utils";

// Home/Workload — 업무 부하(§A). 개인 평가가 아니라 배분 조정용. 색 단독 금지(칩=색+텍스트, 비율=색+수치).
// 색 의미 고정: red=과부하(비율>=100), amber=주의(90~99)·마감 임박, blue=적정/정보.

const CAPTION = "개인 평가가 아닌 업무 배분 조정 목적입니다";

/** 요약칩 — 톤별 틴트(과부하 red / 주의 amber / 그 외 중립). 0이면 red·amber도 중립으로 강등. */
function SummaryChip({
  label,
  tone,
}: {
  label: string;
  tone: "red" | "amber" | "neutral";
}) {
  const cls =
    tone === "red"
      ? "border-[var(--que-error)] bg-[var(--que-error-bg)] text-[var(--que-error)]"
      : tone === "amber"
        ? "border-[var(--que-warning)] bg-[var(--que-warning-bg)] text-[var(--que-warning)]"
        : "border-[var(--que-border)] bg-[var(--que-bg-muted)] text-[var(--que-text-secondary)]";
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium tabular-nums",
        cls,
      )}
    >
      {label}
    </span>
  );
}

/** 비율 셀 — 색 텍스트 + 소형 진행 막대. 예상 미입력(ratio null)이면 '판단 불가'. */
function RatioCell({ ratio }: { ratio: number | null }) {
  if (ratio == null) {
    return <span className="text-sm text-[var(--que-text-tertiary)]">판단 불가</span>;
  }
  const tone =
    ratio >= 100
      ? { text: "text-[var(--que-error)]", bar: "bg-[var(--que-error)]" }
      : ratio >= 90
        ? { text: "text-[var(--que-warning)]", bar: "bg-[var(--que-warning)]" }
        : { text: "text-[var(--que-brand)]", bar: "bg-[var(--que-brand)]" };
  return (
    <span className="flex items-center gap-2">
      <span className={cn("w-10 shrink-0 text-sm font-semibold tabular-nums", tone.text)}>
        {ratio}%
      </span>
      <span
        className="h-1.5 w-16 shrink-0 overflow-hidden rounded-full bg-[var(--que-bg-muted)]"
        aria-hidden
      >
        <span
          className={cn("block h-full rounded-full", tone.bar)}
          style={{ width: `${Math.min(100, ratio)}%` }}
        />
      </span>
    </span>
  );
}

/** 업무 부하 카드(§A) — 요약칩 + 표 + 팀 현황 이동/과부하만 보기. */
export function WorkloadTable({
  load,
  scopeLabel = "업무 부하",
  canManage = false,
}: {
  load: HomeLoad;
  /** 카드 제목(관리자=업무 부하 / 대표=전 인원 부하). */
  scopeLabel?: string;
  /** 관리자(role==="admin")면 행별 '조정' 버튼으로 재배분 시트를 연다. */
  canManage?: boolean;
}) {
  const [overloadOnly, setOverloadOnly] = useState(false);
  const [adjustRow, setAdjustRow] = useState<HomeLoadRow | null>(null);
  const { summary } = load;
  const rows = overloadOnly
    ? load.rows.filter((r) => r.ratio != null && r.ratio >= 100)
    : load.rows;

  const head =
    "px-3 py-2 text-left text-xs font-medium text-[var(--que-text-tertiary)] whitespace-nowrap";

  return (
    <section className="flex min-w-0 flex-col rounded-xl border border-[var(--que-border)] bg-[var(--que-bg)] shadow-[var(--que-shadow-sm)]">
      {/* 헤더: 제목 + 우측 캡션 */}
      <header className="flex flex-wrap items-center justify-between gap-2 px-4 pt-4">
        <h2 className="text-base font-semibold text-[var(--que-text)]">{scopeLabel}</h2>
        <span className="inline-flex items-center gap-1.5 text-xs text-[var(--que-text-tertiary)]">
          <Info className="size-3.5 shrink-0" aria-hidden />
          {CAPTION}
        </span>
      </header>

      {/* 요약칩 행 */}
      <div className="flex flex-wrap items-center gap-2 px-4 pt-3">
        <SummaryChip
          label={`과부하 ${summary.overloadCount}명`}
          tone={summary.overloadCount > 0 ? "red" : "neutral"}
        />
        <SummaryChip
          label={`주의 ${summary.cautionCount}명`}
          tone={summary.cautionCount > 0 ? "amber" : "neutral"}
        />
        <SummaryChip label={`이번 주 남은 가용 ${summary.remainingCapacityHours}h`} tone="neutral" />
        <SummaryChip label={`예상시간 미입력 ${summary.noEstimateCount}건`} tone="neutral" />
        <SummaryChip label={`단일 담당자 의존 ${summary.soloDependencyCount}건`} tone="neutral" />
      </div>

      {/* 표 — 내부 가로 스크롤(모바일) */}
      <div className="mt-3 overflow-x-auto px-4">
        <table className="w-full min-w-[40rem] border-collapse text-sm">
          <thead>
            <tr className="border-b border-[var(--que-border)]">
              <th className={head} scope="col">
                이름
              </th>
              <th className={head} scope="col">
                예상/가용
              </th>
              <th className={head} scope="col">
                비율
              </th>
              <th className={head} scope="col">
                열린 작업
              </th>
              <th className={head} scope="col">
                마감 임박
              </th>
              <th className={head} scope="col">
                홀드
              </th>
              <th className={head} scope="col">
                영향 프로젝트
              </th>
              {canManage && (
                <th className={cn(head, "text-right")} scope="col">
                  조정
                </th>
              )}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td
                  colSpan={canManage ? 8 : 7}
                  className="px-3 py-6 text-center text-sm text-[var(--que-text-tertiary)]"
                >
                  {overloadOnly ? "과부하 인원이 없습니다." : "표시할 업무 부하가 없습니다."}
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <LoadRow
                  key={row.userId}
                  row={row}
                  canManage={canManage}
                  onAdjust={() => setAdjustRow(row)}
                />
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* 하단: 팀 현황 이동(재배분은 전용 기능이 없어 정직한 문구로 — 2026-07-11 결정) · 캡션 · 과부하만 보기 */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-4">
        <span className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <Link
            href="/team"
            className="inline-flex min-h-10 items-center gap-1.5 rounded-lg border border-[var(--que-brand)] bg-[var(--que-brand-subtle)] px-3 text-sm font-medium text-[var(--que-brand)] transition-colors hover:bg-[var(--que-brand-subtle)]/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <Shuffle className="size-4" aria-hidden />
            팀 현황에서 조정 →
          </Link>
          <Link
            href="/help#s10"
            className="inline-flex min-h-10 items-center text-sm font-medium text-[var(--que-text-secondary)] underline-offset-2 transition-colors hover:text-[var(--que-text)] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            조정 방법 보기
          </Link>
        </span>
        <span className="hidden text-xs text-[var(--que-text-tertiary)] sm:inline">{CAPTION}</span>
        <button
          type="button"
          aria-pressed={overloadOnly}
          onClick={() => setOverloadOnly((v) => !v)}
          className={cn(
            "inline-flex min-h-10 items-center rounded-lg px-3 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            overloadOnly
              ? "text-[var(--que-brand)]"
              : "text-[var(--que-text-secondary)] hover:text-[var(--que-text)]",
          )}
        >
          {overloadOnly ? "전체 보기" : "과부하만 보기"}
        </button>
      </div>

      {canManage && (
        <WorkloadReassignSheet
          row={adjustRow}
          allRows={load.rows}
          open={adjustRow != null}
          onOpenChange={(o) => {
            if (!o) setAdjustRow(null);
          }}
        />
      )}
    </section>
  );
}

function LoadRow({
  row,
  canManage,
  onAdjust,
}: {
  row: HomeLoadRow;
  canManage: boolean;
  onAdjust: () => void;
}) {
  const cell = "px-3 py-2 align-middle";
  return (
    <tr className="border-b border-[var(--que-border)] last:border-0">
      <td className={cn(cell, "whitespace-nowrap font-medium text-[var(--que-text)]")}>
        {row.name}
      </td>
      <td className={cn(cell, "whitespace-nowrap tabular-nums text-[var(--que-text-secondary)]")}>
        {row.estimatedHours > 0 ? `${row.estimatedHours}h` : "-"} / {row.capacityHours}h
      </td>
      <td className={cell}>
        <RatioCell ratio={row.ratio} />
      </td>
      <td className={cn(cell, "tabular-nums text-[var(--que-text-secondary)]")}>
        {row.openTasks}건
      </td>
      <td
        className={cn(
          cell,
          "tabular-nums",
          row.dueSoonCount > 0
            ? "font-medium text-[var(--que-warning)]"
            : "text-[var(--que-text-tertiary)]",
        )}
      >
        {row.dueSoonCount}건
      </td>
      <td
        className={cn(
          cell,
          "tabular-nums",
          row.holdCount > 0 ? "text-[var(--que-text)]" : "text-[var(--que-text-tertiary)]",
        )}
      >
        {row.holdCount}건
      </td>
      <td className={cn(cell, "max-w-[12rem] truncate text-[var(--que-text-secondary)]")}>
        {row.impactProjects.length > 0 ? row.impactProjects.join(", ") : "-"}
      </td>
      {canManage && (
        <td className={cn(cell, "whitespace-nowrap text-right")}>
          <button
            type="button"
            onClick={onAdjust}
            aria-label={`${row.name} 업무 조정`}
            className="inline-flex min-h-10 items-center gap-1.5 rounded-lg border border-[var(--que-border)] bg-[var(--que-bg)] px-3 text-sm font-medium text-[var(--que-text-secondary)] transition-colors hover:border-[var(--que-border-strong)] hover:text-[var(--que-text)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <SlidersHorizontal className="size-4" aria-hidden />
            조정
          </button>
        </td>
      )}
    </tr>
  );
}
