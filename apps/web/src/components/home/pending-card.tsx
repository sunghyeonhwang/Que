import Link from "next/link";
import { Clock, FileText, Wallet } from "lucide-react";
import type { HomePending } from "@/lib/home-grade-data";

// Home/Pending — 보조 대기 신호(결제·확인 필요 Action·장기 상태 응답 대기). 각 상세 화면으로 딥링크.
// '확인 필요'는 회의록 Action 고유 용어라 항상 풀네임 '확인 필요 Action'으로 쓴다(명세 §1).

/** 처리 대기 3배너. 각 딥링크 + 보조 수치(마감 초과 결제 등). */
export function PendingCard({ pending }: { pending: HomePending }) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
      {/* 확인 필요 Action */}
      <Link
        href="/action"
        className="flex min-h-16 items-center gap-3 rounded-xl border border-[var(--que-border)] bg-[var(--que-bg)] p-4 transition-colors hover:bg-[var(--que-bg-muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <span className="flex size-10 shrink-0 items-center justify-center rounded-lg border border-[var(--que-violet)] bg-[var(--que-violet-bg)] text-[var(--que-violet)]">
          <FileText className="size-5" aria-hidden />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm text-[var(--que-text-secondary)]">확인 필요 Action</span>
          <span className="block text-lg font-semibold tabular-nums text-[var(--que-text)]">
            {pending.needsReviewActions}건
          </span>
        </span>
      </Link>

      {/* 결제 대기 */}
      <Link
        href="/payments"
        className="flex min-h-16 items-center gap-3 rounded-xl border border-[var(--que-border)] bg-[var(--que-bg)] p-4 transition-colors hover:bg-[var(--que-bg-muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <span
          className={
            "flex size-10 shrink-0 items-center justify-center rounded-lg border " +
            (pending.overduePayments > 0
              ? "border-[var(--que-error)] bg-[var(--que-error-bg)] text-[var(--que-error)]"
              : "border-[var(--que-warning)] bg-[var(--que-warning-bg)] text-[var(--que-warning)]")
          }
        >
          <Wallet className="size-5" aria-hidden />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm text-[var(--que-text-secondary)]">결제 대기</span>
          <span className="block text-lg font-semibold tabular-nums text-[var(--que-text)]">
            {pending.pendingPayments}건
          </span>
        </span>
        {pending.overduePayments > 0 && (
          <span className="shrink-0 text-xs font-medium text-[var(--que-error)]">
            마감 초과 {pending.overduePayments}
          </span>
        )}
      </Link>

      {/* 장기 상태 응답 대기 */}
      <Link
        href="/team"
        className="flex min-h-16 items-center gap-3 rounded-xl border border-[var(--que-border)] bg-[var(--que-bg)] p-4 transition-colors hover:bg-[var(--que-bg-muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <span className="flex size-10 shrink-0 items-center justify-center rounded-lg border border-[var(--que-violet)] bg-[var(--que-violet-bg)] text-[var(--que-violet)]">
          <Clock className="size-5" aria-hidden />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm text-[var(--que-text-secondary)]">
            장기 상태 응답 대기
          </span>
          <span className="block text-lg font-semibold tabular-nums text-[var(--que-text)]">
            {pending.longAwaitingCheckins}건
          </span>
        </span>
        <span className="shrink-0 text-xs text-[var(--que-text-tertiary)]">7일+</span>
      </Link>
    </div>
  );
}
