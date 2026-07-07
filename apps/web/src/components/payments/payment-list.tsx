"use client";

import { useEffect, useRef } from "react";
import { format } from "date-fns";
import { PAYMENT_STATUS_LABELS, type PaymentStatus } from "@que/core";
import { updatePaymentStatusAction } from "@/app/(app)/payments/actions";
import { useSafeAction } from "@/components/app/use-safe-action";
import { ToneBadge, type BadgeTone } from "@/components/app/tone-badge";
import { CopyButton } from "@/components/app/copy-button";
import { DoneCircle } from "@/components/app/done-circle";
import type { PaymentRow } from "@/lib/payment-data";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// 상태 색상 의미 고정: 대기=amber(대기) · 완료=green(완료) · 취소=red(취소).
const STATUS_TONE: Record<PaymentStatus, BadgeTone> = {
  waiting: "amber",
  done: "green",
  cancelled: "red",
};

// 부제 안 인라인 복사 버튼 — 얇은 행을 유지하려 작게(32px). 40px 완료 원형과 대비.
const COPY_COMPACT = "size-8";

/** 결제 요청 목록 — view.griff task 카드처럼 얇은 단일 행 카드 나열.
 *  마감 초과 대기 항목이 상단에 온다.
 *  highlightId(전역 검색 딥링크 /payments?payment=<id>)가 있으면 해당 행을 강조·스크롤한다. */
export function PaymentList({ rows, highlightId }: { rows: PaymentRow[]; highlightId?: string }) {
  return (
    <div className="max-h-[calc(100dvh-19rem)] overflow-y-auto pr-0.5">
      <div className="flex flex-col gap-1.5">
        {rows.length === 0 && (
          <p className="rounded-xl border border-dashed border-[var(--que-border)] bg-[var(--que-bg-muted)] py-10 text-center text-sm text-[var(--que-text-tertiary)]">
            결제 요청이 없습니다.
          </p>
        )}
        {rows.map((row) => (
          <PaymentRowView key={row.id} row={row} highlighted={row.id === highlightId} />
        ))}
      </div>
    </div>
  );
}

function PaymentRowView({ row, highlighted }: { row: PaymentRow; highlighted: boolean }) {
  const { run, pending } = useSafeAction();
  const rowRef = useRef<HTMLDivElement | null>(null);

  // 딥링크로 강조된 행은 마운트 시 화면 안으로 스크롤한다.
  useEffect(() => {
    if (highlighted) rowRef.current?.scrollIntoView({ block: "center" });
  }, [highlighted]);

  const change = (to: PaymentStatus) => {
    run(() => updatePaymentStatusAction({ paymentId: row.id, to }), {
      success: `"${row.title}" → ${PAYMENT_STATUS_LABELS[to]}`,
    });
  };

  const dueText = row.dueAt ? format(new Date(row.dueAt), "M/d") : null;
  // 입금 완료 원형 버튼은 대기·완료 상태에서만(취소는 별도 되돌리기). 관리자만 완료 토글.
  const showDoneCircle = row.canComplete && row.status !== "cancelled";

  return (
    <div
      ref={rowRef}
      className={cn(
        "flex min-h-[3.25rem] scroll-mt-4 items-center gap-3 rounded-xl border px-3.5 py-2 transition-colors",
        row.overdue
          ? "border-[var(--que-error)]/40 bg-[var(--que-error-bg)]/30"
          : "border-[var(--que-border)] bg-[var(--que-bg)] hover:bg-[var(--que-bg-muted)]",
        row.status === "cancelled" && "opacity-70",
        highlighted && "border-[var(--que-brand)] bg-[var(--que-brand-subtle)] ring-2 ring-[var(--que-brand)]",
      )}
    >
      {/* 좌: 제목(볼드) + 부제(수신자 · 은행·계좌[복사] · 마감 · 요청자) */}
      <div className="min-w-0 flex-1">
        <div className="flex min-w-0 items-center gap-2">
          <span className="min-w-0 truncate text-sm font-semibold text-[var(--que-text)]">
            {row.title}
          </span>
          <ToneBadge tone="neutral">{row.category}</ToneBadge>
        </div>
        <div className="mt-0.5 flex min-w-0 items-center gap-x-1.5 text-xs text-[var(--que-text-tertiary)]">
          {row.recipientName && (
            <>
              <span className="truncate">{row.recipientName}</span>
              <Dot />
            </>
          )}
          <span className="inline-flex shrink-0 items-center gap-1">
            <span className="text-[var(--que-text-secondary)]">{row.bankName}</span>
            <span className="tabular-nums">{row.accountDisplay}</span>
            {row.accountNumberForCopy !== undefined && (
              <CopyButton
                value={row.accountNumberForCopy}
                label="계좌번호 복사"
                className={COPY_COMPACT}
              />
            )}
          </span>
          {dueText && (
            <>
              <Dot />
              <span
                className={cn(
                  "shrink-0",
                  row.overdue && "font-medium text-[var(--que-error)]",
                  row.dueSoon && "font-medium text-[var(--que-warning)]",
                )}
              >
                마감 {dueText}
                {row.overdue && " · 초과"}
                {row.dueSoon && " · 임박"}
              </span>
            </>
          )}
          <span className="hidden items-center gap-x-1.5 sm:inline-flex">
            <Dot />
            <span className="shrink-0">요청 {row.requesterName}</span>
          </span>
        </div>
      </div>

      {/* 우: 금액[복사] · 상태 배지 · 액션(취소/되돌리기 + 완료 원형) */}
      <div className="flex shrink-0 items-center gap-2">
        <span className="hidden items-center gap-1 sm:flex">
          <span className="text-sm font-semibold tabular-nums text-[var(--que-text)]">
            {row.amountDisplay ?? "비공개"}
          </span>
          {row.amountForCopy !== undefined && (
            <CopyButton
              value={String(row.amountForCopy)}
              label="금액 복사"
              className={COPY_COMPACT}
            />
          )}
        </span>

        <ToneBadge tone={STATUS_TONE[row.status]}>{PAYMENT_STATUS_LABELS[row.status]}</ToneBadge>

        {row.status === "waiting" && row.canCancel && (
          <Button
            variant="outline"
            size="sm"
            className="h-9 rounded-lg border-[var(--que-error)]/40 px-2.5 text-xs text-[var(--que-error)] hover:bg-[var(--que-error-bg)] hover:text-[var(--que-error)]"
            disabled={pending}
            onClick={() => change("cancelled")}
          >
            취소
          </Button>
        )}
        {row.status === "cancelled" && row.canComplete && (
          <Button
            variant="outline"
            size="sm"
            className="h-9 rounded-lg px-2.5 text-xs"
            disabled={pending}
            onClick={() => change("waiting")}
          >
            되돌리기
          </Button>
        )}
        {showDoneCircle && (
          <DoneCircle
            done={row.status === "done"}
            pending={pending}
            markLabel={`"${row.title}" 입금 완료로 표시`}
            unmarkLabel={`"${row.title}" 입금 완료 해제`}
            onToggle={(nextDone) => change(nextDone ? "done" : "waiting")}
          />
        )}
      </div>
    </div>
  );
}

/** 부제 항목 구분점. */
function Dot() {
  return <span className="shrink-0 text-[var(--que-border-strong)]">·</span>;
}
