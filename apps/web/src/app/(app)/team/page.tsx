import { PageHeader } from "@/components/app/page-header";

export default function TeamPage() {
  return (
    <div>
      <PageHeader title="팀 현황" subtitle="오늘 팀의 업무 흐름과 병목" />
      <p className="text-sm text-muted-foreground">
        Phase 3에서 구현: 상단 요약(진행중/문제/홀드/마감 임박/응답 대기), 사람별 시간표, Attention Queue, 최근 변경 내역.
      </p>
    </div>
  );
}
