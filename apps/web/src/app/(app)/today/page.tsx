import { PageHeader } from "@/components/app/page-header";
import { getCurrentUser } from "@/lib/current-user";

export default async function TodayPage() {
  const user = await getCurrentUser();

  return (
    <div>
      <PageHeader
        title={`오늘의 Que — ${user.name}`}
        subtitle="내 하루를 시작하는 개인 화면"
      />
      <p className="text-sm text-muted-foreground">
        Phase 3에서 구현: 자연어 빠른 입력, 오늘 내 일정/작업, 자동 체크인 응답, 마감 임박, 내가 관련된 문제/홀드.
      </p>
    </div>
  );
}
