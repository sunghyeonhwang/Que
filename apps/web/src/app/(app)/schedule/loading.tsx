// /schedule 즉시 로딩 상태 — 캘린더 데이터 로드 동안의 빈 화면 대신 헤더·그리드 골격을
// 스켈레톤으로 먼저 보여 내비게이션 체감 지연을 줄인다(/projects loading.tsx와 같은 취지).
export default function ScheduleLoading() {
  return (
    <div className="flex h-full min-h-0 flex-col" aria-busy aria-label="일정 불러오는 중">
      <div className="flex shrink-0 items-center gap-2">
        <div className="h-10 w-40 animate-pulse rounded-lg bg-[var(--que-bg-muted)]" />
        <div className="h-10 w-28 animate-pulse rounded-lg bg-[var(--que-bg-muted)]" />
        <div className="ml-auto h-10 w-32 animate-pulse rounded-lg bg-[var(--que-bg-muted)]" />
      </div>
      <div className="mt-3 min-h-0 flex-1 animate-pulse rounded-xl bg-[var(--que-bg-muted)]" />
    </div>
  );
}
