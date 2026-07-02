import { PageHeader } from "@/components/app/page-header";

export default function ProjectsPage() {
  return (
    <div>
      <PageHeader title="프로젝트" subtitle="프로젝트 기준 마일스톤과 연결 작업 추적" />
      <p className="text-sm text-muted-foreground">
        Phase 5에서 구현: 프로젝트 개요, 다음 마일스톤, 일정 그리드, 문제/홀드, 담당자별 할당, 변경 이력.
      </p>
    </div>
  );
}
