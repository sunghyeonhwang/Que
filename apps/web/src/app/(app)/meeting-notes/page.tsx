import { PageHeader } from "@/components/app/page-header";

export default function MeetingNotesPage() {
  return (
    <div>
      <PageHeader title="회의록" subtitle="Plaud 회의록 업로드와 Action 추출 관리" />
      <p className="text-sm text-muted-foreground">
        Phase 4에서 구현: MD 업로드, 회의 정보 입력, 원문 미리보기, 추출 상태 관리.
      </p>
    </div>
  );
}
