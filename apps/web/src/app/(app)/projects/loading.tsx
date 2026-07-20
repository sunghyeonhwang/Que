// /projects 즉시 로딩 상태 — force-dynamic 데이터 로드 동안 화면이 멈춘 듯 보이던 문제
// (2026-07-20 사용자: "프로젝트의 위치 로딩이 느려"). 실제 화면 골격(필터 바 → 뷰 탭 → 그리드)을
// 중립 스켈레톤으로 미리 그려 내비게이션이 즉각 반응하는 것처럼 보이게 한다. 장식 금지(운영 도구 톤).
export default function ProjectsLoading() {
  return (
    <div className="flex h-full min-h-0 flex-col" aria-busy aria-label="프로젝트 불러오는 중">
      <div className="flex shrink-0 items-center gap-2">
        <div className="h-10 w-52 animate-pulse rounded-lg bg-[var(--que-bg-muted)]" />
        <div className="h-10 w-64 animate-pulse rounded-lg bg-[var(--que-bg-muted)]" />
      </div>
      <div className="mt-3 h-16 animate-pulse rounded-xl bg-[var(--que-bg-muted)]" />
      <div className="mt-4 flex gap-2 border-b border-[var(--que-border)] pb-2">
        <div className="h-10 w-24 animate-pulse rounded-lg bg-[var(--que-bg-muted)]" />
        <div className="h-10 w-24 animate-pulse rounded-lg bg-[var(--que-bg-muted)]" />
        <div className="ml-auto h-10 w-32 animate-pulse rounded-lg bg-[var(--que-bg-muted)]" />
      </div>
      <div className="mt-3 min-h-0 flex-1 animate-pulse rounded-xl bg-[var(--que-bg-muted)]" />
    </div>
  );
}
