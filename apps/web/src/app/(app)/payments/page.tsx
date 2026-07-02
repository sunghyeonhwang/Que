import { PageHeader } from "@/components/app/page-header";

export default function PaymentsPage() {
  return (
    <div>
      <PageHeader title="결제" subtitle="결제 요청 등록과 입금 처리 상태" />
      <p className="text-sm text-muted-foreground">
        Phase 5에서 구현: 요청 등록 폼, 대기/완료/취소 요약, 목록과 상태 변경, 마감 임박/초과 표시.
      </p>
    </div>
  );
}
