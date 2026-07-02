import { PageHeader } from "@/components/app/page-header";

export default function NowPage() {
  return (
    <div>
      <PageHeader
        title="Now 운영표"
        subtitle="회의 Action과 캘린더 일정이 연결됐는지 확인하는 팀 운영표"
      />
      <p className="text-sm text-muted-foreground">
        Phase 4에서 구현: 캘린더 일정 + Action Task 통합표, 문제/홀드/담당자 누락 요약.
      </p>
    </div>
  );
}
