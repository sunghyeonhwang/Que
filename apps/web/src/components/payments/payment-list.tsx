"use client";

import { format } from "date-fns";
import { PAYMENT_STATUS_LABELS, type PaymentStatus } from "@que/core";
import { updatePaymentStatusAction } from "@/app/(app)/payments/actions";
import { useSafeAction } from "@/components/app/use-safe-action";
import { ToneBadge, type BadgeTone } from "@/components/app/tone-badge";
import type { PaymentRow } from "@/lib/payment-data";
import { Button } from "@/components/ui/button";

// 상태 색상 의미 고정: 대기=amber(대기) · 완료=green(완료) · 취소=red(취소).
const STATUS_TONE: Record<PaymentStatus, BadgeTone> = {
  waiting: "amber",
  done: "green",
  cancelled: "red",
};

/** 결제 요청 목록. 마감 초과 대기 항목이 상단에 온다. */
export function PaymentList({ rows }: { rows: PaymentRow[] }) {
  return (
    <div className="flex flex-col gap-2">
      {rows.length === 0 && (
        <p className="rounded-xl border border-dashed border-[var(--que-border)] bg-[var(--que-bg-muted)] py-10 text-center text-sm text-[var(--que-text-tertiary)]">
          결제 요청이 없습니다.
        </p>
      )}
      {rows.map((row) => (
        <PaymentRowView key={row.id} row={row} />
      ))}
    </div>
  );
}

function PaymentRowView({ row }: { row: PaymentRow }) {
  const { run, pending } = useSafeAction();

  const change = (to: PaymentStatus) => {
    run(() => updatePaymentStatusAction({ paymentId: row.id, to }), {
      success: `"${row.title}" → ${PAYMENT_STATUS_LABELS[to]}`,
    });
  };

  return (
    <div
      className={
        row.overdue
          ? "rounded-xl border border-[var(--que-error)]/40 bg-[var(--que-error-bg)]/40 p-3.5"
          : "rounded-xl border border-[var(--que-border)] bg-[var(--que-bg)] p-3.5"
      }
    >
      <div className="flex flex-wrap items-center gap-2">
        <ToneBadge tone={STATUS_TONE[row.status]}>{PAYMENT_STATUS_LABELS[row.status]}</ToneBadge>
        {row.overdue && <ToneBadge tone="red">마감 초과</ToneBadge>}
        {row.dueSoon && <ToneBadge tone="amber">마감 임박</ToneBadge>}
        <p className="min-w-0 flex-1 truncate text-sm font-medium text-[var(--que-text)]">
          {row.title}
        </p>
        <ToneBadge tone="neutral">{row.category}</ToneBadge>
      </div>
      <p className="mt-1 text-xs text-[var(--que-text-tertiary)]">
        요청 {row.requesterName} · {row.bankName} {row.accountDisplay} ·{" "}
        {row.amountDisplay ?? "금액 비공개"}
        {row.dueAt ? ` · 마감 ${format(new Date(row.dueAt), "M/d")}` : ""}
      </p>
      {row.description && (
        <p className="mt-0.5 text-xs text-[var(--que-text-tertiary)]">{row.description}</p>
      )}

      {row.status === "waiting" && (row.canComplete || row.canCancel) && (
        <div className="mt-2.5 flex gap-2">
          {row.canComplete && (
            <Button
              size="sm"
              className="h-10 rounded-lg bg-[var(--que-brand)] px-3.5 text-[var(--que-on-brand)] hover:bg-[var(--que-brand-hover)]"
              disabled={pending}
              onClick={() => change("done")}
            >
              입금 완료
            </Button>
          )}
          {row.canCancel && (
            <Button
              variant="outline"
              size="sm"
              className="h-10 rounded-lg border-[var(--que-error)]/40 text-[var(--que-error)] hover:bg-[var(--que-error-bg)] hover:text-[var(--que-error)]"
              disabled={pending}
              onClick={() => change("cancelled")}
            >
              취소
            </Button>
          )}
        </div>
      )}
      {row.status !== "waiting" && row.canComplete && (
        <div className="mt-2.5">
          <Button
            variant="outline"
            size="sm"
            className="h-10 rounded-lg"
            disabled={pending}
            onClick={() => change("waiting")}
          >
            대기로 되돌리기
          </Button>
        </div>
      )}
    </div>
  );
}
