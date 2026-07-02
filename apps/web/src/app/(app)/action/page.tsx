import { PageHeader } from "@/components/app/page-header";

export default function ActionPage() {
  return (
    <div>
      <PageHeader title="Action" subtitle="회의록에서 추출된 Task 후보 확정" />
      <p className="text-sm text-muted-foreground">
        Phase 4에서 구현: Task 후보 목록, 원문 출처, 생성/보류/무시. 담당자·마감일 없는 후보는 자동 생성하지 않는다.
      </p>
    </div>
  );
}
