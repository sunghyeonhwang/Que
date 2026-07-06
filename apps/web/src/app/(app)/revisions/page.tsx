import { PageHeader } from "@/components/app/page-header";
import { RevisionForm } from "@/components/revisions/revision-form";
import { RevisionList } from "@/components/revisions/revision-list";
import { getCurrentUser } from "@/lib/current-user";
import { getRevisionNotes } from "@/lib/revisions-data";

export const dynamic = "force-dynamic";

// 수정사항(이슈/피드백) 트래커 — 테스트 중 발견한 수정사항을 바로 적는 팀 공용 목록.
// 전원 접근(인증만). 작성/변경은 서버 액션의 core mutation이 강제한다.
export default async function RevisionsPage() {
  await getCurrentUser(); // 인증 게이트(팀 공용이라 역할 제한 없음)
  const rows = await getRevisionNotes();

  return (
    <div>
      <PageHeader
        title="수정사항"
        subtitle="테스트 중 발견한 수정사항을 팀이 함께 기록하고 처리 상태를 관리합니다 — 작성자와 시간은 자동으로 남습니다"
      />
      <div className="grid gap-4 xl:grid-cols-[minmax(0,24rem)_minmax(0,1fr)]">
        <RevisionForm />
        {/* 좁은 폭(태블릿 가로 등)에서는 목록을 위로, xl 2열에서는 원래 순서(폼 좌·목록 우). */}
        <div className="order-first min-w-0 xl:order-none">
          <RevisionList rows={rows} />
        </div>
      </div>
    </div>
  );
}
