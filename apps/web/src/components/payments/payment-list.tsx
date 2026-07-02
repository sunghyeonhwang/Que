"use client";

import { format } from "date-fns";
import { PAYMENT_STATUS_LABELS, type PaymentStatus } from "@que/core";
import { updatePaymentStatusAction } from "@/app/(app)/payments/actions";
import { useSafeAction } from "@/components/app/use-safe-action";
import type { PaymentRow } from "@/lib/payment-data";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

const STATUS_VARIANT: Record<PaymentStatus, "default" | "secondary" | "destructive"> = {
  waiting: "secondary",
  done: "default",
  cancelled: "destructive",
};

/** 결제 요청 목록. 마감 초과 대기 항목이 상단에 온다. */
export function PaymentList({ rows }: { rows: PaymentRow[] }) {
  return (
    <div className="flex flex-col gap-2">
      {rows.length === 0 && (
        <p className="py-6 text-center text-sm text-muted-foreground">결제 요청이 없습니다.</p>
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
          ? "rounded-md border border-destructive/50 p-3"
          : "rounded-md border p-3"
      }
    >
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant={STATUS_VARIANT[row.status]}>{PAYMENT_STATUS_LABELS[row.status]}</Badge>
        {row.overdue && <Badge variant="destructive">마감 초과</Badge>}
        {row.dueSoon && <Badge variant="secondary">마감 임박</Badge>}
        <p className="min-w-0 flex-1 truncate text-sm font-medium">{row.title}</p>
        <Badge variant="outline">{row.category}</Badge>
      </div>
      <p className="mt-1 text-xs text-muted-foreground">
        요청 {row.requesterName} · {row.bankName} {row.accountDisplay} ·{" "}
        {row.amountDisplay ?? "금액 비공개"}
        {row.dueAt ? ` · 마감 ${format(new Date(row.dueAt), "M/d")}` : ""}
      </p>
      {row.description && (
        <p className="mt-0.5 text-xs text-muted-foreground">{row.description}</p>
      )}

      {row.status === "waiting" && (row.canComplete || row.canCancel) && (
        <div className="mt-2 flex gap-2">
          {row.canComplete && (
            <Button size="sm" className="h-10" disabled={pending} onClick={() => change("done")}>
              입금 완료
            </Button>
          )}
          {row.canCancel && (
            <Button
              variant="destructive"
              size="sm"
              className="h-10"
              disabled={pending}
              onClick={() => change("cancelled")}
            >
              취소
            </Button>
          )}
        </div>
      )}
      {row.status !== "waiting" && row.canComplete && (
        <div className="mt-2">
          <Button
            variant="outline"
            size="sm"
            className="h-10"
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
