import { PageHeader } from "@/components/app/page-header";
import { PaymentForm } from "@/components/payments/payment-form";
import { PaymentList } from "@/components/payments/payment-list";
import { Card, CardContent } from "@/components/ui/card";
import { getCurrentUser } from "@/lib/current-user";
import { getPaymentData } from "@/lib/payment-data";

export const dynamic = "force-dynamic";

export default async function PaymentsPage() {
  const user = await getCurrentUser();
  const data = await getPaymentData(user);

  const metrics = [
    { value: data.summary.waiting, label: "대기" },
    { value: data.summary.overdue, label: "마감 초과" },
    { value: data.summary.done, label: "완료" },
    { value: data.summary.cancelled, label: "취소" },
  ];

  return (
    <div>
      <PageHeader
        title="결제요청"
        subtitle="결제 요청을 등록하고 입금 처리 상태를 확인합니다 — 계좌번호와 금액은 관리자와 요청자에게만 표시됩니다"
      />

      <section aria-label="결제 요약" className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {metrics.map((metric) => (
          <Card key={metric.label} className="py-3">
            <CardContent className="px-4">
              <p className="text-2xl font-semibold tabular-nums">{metric.value}</p>
              <p className="text-xs text-muted-foreground">{metric.label}</p>
            </CardContent>
          </Card>
        ))}
      </section>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,24rem)_minmax(0,1fr)]">
        <PaymentForm />
        <div>
          <h2 className="mb-2 text-base font-semibold">결제 요청 목록</h2>
          <PaymentList rows={data.rows} />
        </div>
      </div>
    </div>
  );
}
