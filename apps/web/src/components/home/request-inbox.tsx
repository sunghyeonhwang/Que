import Link from "next/link";
import { AlertTriangle, Clock, FileText, TriangleAlert, Wallet } from "lucide-react";
import type { AlertItem, AlertsData } from "@/lib/alerts-data";
import type { NoteSummary } from "@/lib/notes-summary";

// 상태색 의미 고정: red=문제, amber=주의/대기(기한초과·결제), violet=회의록/응답대기(확인필요).
const TONE: Record<AlertItem["tone"], string> = {
  red: "border-[var(--que-error)] bg-[var(--que-error-bg)] text-[var(--que-error)]",
  amber: "border-[var(--que-warning)] bg-[var(--que-warning-bg)] text-[var(--que-warning)]",
  violet: "border-[var(--que-violet)] bg-[var(--que-violet-bg)] text-[var(--que-violet)]",
};

const KIND_ICON = {
  issue: AlertTriangle,
  needs_review: FileText,
  overdue: TriangleAlert,
  payment: Wallet,
} as const;

/** 사원 홈 — 내게 온 요청/신호. 상단바 벨과 같은 소스(alerts) + 확인 필요 Action(noteSummary). */
export function RequestInbox({
  alerts,
  noteSummary,
}: {
  alerts: AlertsData;
  noteSummary: NoteSummary;
}) {
  // 확인 필요 Action은 상단 배너로 요약하므로, alerts 목록에서는 needs_review를 빼 중복 표시를 막는다.
  const otherItems = alerts.items.filter((item) => item.kind !== "needs_review");
  const empty = otherItems.length === 0 && noteSummary.needsReview === 0;

  if (empty) {
    return (
      <div className="flex min-h-[120px] items-center justify-center rounded-lg border border-dashed border-[var(--que-border)] text-sm text-[var(--que-text-tertiary)]">
        지금 처리할 요청이 없습니다.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {noteSummary.needsReview > 0 && (
        <Link
          href="/action"
          className="flex min-h-11 items-center gap-2 rounded-lg border border-[var(--que-violet)] bg-[var(--que-violet-bg)] px-3 py-2 transition-colors hover:brightness-95"
        >
          <Clock className="size-4 shrink-0 text-[var(--que-violet)]" aria-hidden />
          <span className="min-w-0 flex-1 text-sm font-medium text-[var(--que-text)]">
            확인 필요 Action
          </span>
          <span className="text-sm font-semibold tabular-nums text-[var(--que-violet)]">
            {noteSummary.needsReview}건
          </span>
        </Link>
      )}
      {otherItems.map((item) => {
        const Icon = KIND_ICON[item.kind];
        return (
          <Link
            key={item.id}
            href={item.href}
            className="flex min-h-11 items-center gap-2 rounded-lg border border-[var(--que-border)] px-3 py-2 transition-colors hover:bg-[var(--que-bg-muted)]"
          >
            <span
              className={
                "flex size-6 shrink-0 items-center justify-center rounded-md border " +
                TONE[item.tone]
              }
            >
              <Icon className="size-3.5" aria-hidden />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-medium text-[var(--que-text)]">
                {item.title}
              </span>
              <span className="block truncate text-xs text-[var(--que-text-secondary)]">
                {item.description}
              </span>
            </span>
          </Link>
        );
      })}
    </div>
  );
}
