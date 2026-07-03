import { PageHeader } from "@/components/app/page-header";
import { PaymentForm } from "@/components/payments/payment-form";
import { PaymentList } from "@/components/payments/payment-list";
import { getCurrentUser } from "@/lib/current-user";
import { getPaymentData } from "@/lib/payment-data";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

// 요약 카드 강조색 — 대기/마감 초과는 시선을 끌고, 완료는 green, 취소는 눌러 둔다.
const METRIC_TONE: Record<string, string> = {
  amber: "text-[var(--que-warning)]",
  red: "text-[var(--que-error)]",
  green: "text-[var(--que-success)]",
  neutral: "text-[var(--que-text-tertiary)]",
};

export default async function PaymentsPage() {
  const user = await getCurrentUser();
  const data = await getPaymentData(user);

  const metrics = [
    { value: data.summary.waiting, label: "대기", tone: "amber" },
    { value: data.summary.overdue, label: "마감 초과", tone: "red" },
    { value: data.summary.done, label: "완료", tone: "green" },
    { value: data.summary.cancelled, label: "취소", tone: "neutral" },
  ];

  return (
    <div>
      <PageHeader
        title="결제요청"
        subtitle="결제 요청을 등록하고 입금 처리 상태를 확인합니다 — 계좌번호와 금액은 관리자와 요청자에게만 표시됩니다"
      />

      <section aria-label="결제 요약" className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {metrics.map((metric) => (
          <div
            key={metric.label}
            className="rounded-xl border border-[var(--que-border)] bg-white px-4 py-3"
          >
            <p
              className={cn(
                "text-2xl font-semibold tabular-nums",
                metric.value === 0 ? "text-[var(--que-text-tertiary)]" : METRIC_TONE[metric.tone],
              )}
            >
              {metric.value}
            </p>
            <p className="text-xs text-[var(--que-text-secondary)]">{metric.label}</p>
          </div>
        ))}
      </section>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,24rem)_minmax(0,1fr)]">
        <PaymentForm />
        <div className="min-w-0">
          <h2 className="mb-2 text-base font-semibold text-[var(--que-text)]">결제 요청 목록</h2>
          <div className="max-h-[calc(100dvh-19rem)] overflow-y-auto pr-0.5">
            <PaymentList rows={data.rows} />
          </div>
        </div>
      </div>
    </div>
  );
}
