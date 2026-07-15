import { PageHeader } from "@/components/app/page-header";
import { LinkTabs } from "@/components/app/link-tabs";
import { PaymentCategoryManager } from "@/components/payments/payment-category-manager";
import { PaymentExportPanel } from "@/components/payments/payment-export-panel";
import { PaymentForm } from "@/components/payments/payment-form";
import { PaymentList } from "@/components/payments/payment-list";
import { getCurrentUser } from "@/lib/current-user";
import {
  getAllPaymentCategories,
  getPaymentCategories,
  getPaymentData,
} from "@/lib/payment-data";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

// 요약 카드 강조색 — 대기/마감 초과는 시선을 끌고, 완료는 green, 취소는 눌러 둔다.
const METRIC_TONE: Record<string, string> = {
  amber: "text-[var(--que-warning)]",
  red: "text-[var(--que-error)]",
  green: "text-[var(--que-success)]",
  neutral: "text-[var(--que-text-tertiary)]",
};

export default async function PaymentsPage({
  searchParams,
}: {
  searchParams: Promise<{ payment?: string; tab?: string }>;
}) {
  const { payment: highlightPaymentId, tab } = await searchParams;
  const isHistory = tab === "history";
  const user = await getCurrentUser();
  const isAdmin = user.role === "admin";
  const [data, activeCategories, allCategories] = await Promise.all([
    getPaymentData(user),
    getPaymentCategories(),
    // 관리 패널(관리자 전용) 소스만 보관 포함 전체를 불러온다.
    isAdmin ? getAllPaymentCategories() : Promise.resolve([]),
  ]);

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
        actions={isAdmin ? <PaymentCategoryManager categories={allCategories} /> : undefined}
      />

      <section aria-label="결제 요약" className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {metrics.map((metric) => (
          <div
            key={metric.label}
            className="rounded-xl border border-[var(--que-border)] bg-[var(--que-bg)] px-4 py-3"
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

      <LinkTabs
        label="결제 목록 전환"
        active={isHistory ? "history" : "active"}
        tabs={[
          { key: "active", label: "진행 중", href: "/payments" },
          { key: "history", label: "히스토리", href: "/payments?tab=history" },
        ]}
      />

      {isHistory ? (
        <div className="min-w-0">
          {/* 세무회계용 기간별 CSV 다운로드 — 관리자 전용 */}
          {isAdmin && <PaymentExportPanel />}
          <h2 className="mb-2 text-base font-semibold text-[var(--que-text)]">완료 · 취소 내역</h2>
          <PaymentList
            rows={[...data.rows]
              .filter((r) => r.status !== "waiting")
              .sort((a, b) => (b.lastChangedAt ?? "").localeCompare(a.lastChangedAt ?? ""))}
            highlightId={highlightPaymentId}
          />
        </div>
      ) : (
        <div className="grid gap-4 xl:grid-cols-[minmax(0,24rem)_minmax(0,1fr)]">
          <PaymentForm categories={activeCategories.map((c) => c.name)} />
          {/* 좁은 폭(태블릿 가로 등)에서는 목록을 위로, xl 2열에서는 원래 순서(폼 좌·목록 우). */}
          <div className="order-first min-w-0 xl:order-none">
            <h2 className="mb-2 text-base font-semibold text-[var(--que-text)]">결제 요청 목록</h2>
            <PaymentList
              rows={data.rows.filter((r) => r.status === "waiting")}
              highlightId={highlightPaymentId}
            />
          </div>
        </div>
      )}
    </div>
  );
}
