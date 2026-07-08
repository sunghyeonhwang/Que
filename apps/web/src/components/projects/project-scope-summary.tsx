import { Building2, FolderKanban, ListTodo } from "lucide-react";

/**
 * 전체 프로젝트 보기 헤더 — 단일 ProjectHeader를 대신하는 소형 스코프 요약.
 * 프로젝트 n개 · 태스크 n개, 특정 클라이언트 스코프면 클라이언트명을 함께 보여준다.
 * 조회 전용(전체 보기에선 생성 버튼을 숨겨 대상 프로젝트 선택을 유도한다).
 */
export function ProjectScopeSummary({
  projectCount,
  taskCount,
  clientName,
}: {
  projectCount: number;
  taskCount: number;
  /** 특정 클라이언트 스코프면 그 이름. 전체 클라이언트면 null. */
  clientName: string | null;
}) {
  return (
    <header className="flex flex-wrap items-center gap-x-4 gap-y-1">
      <div className="min-w-0">
        {clientName ? (
          <span className="inline-flex max-w-full items-center gap-1 text-sm font-medium text-[var(--que-text-secondary)]">
            <Building2 className="size-3.5 shrink-0" aria-hidden />
            <span className="truncate">{clientName}</span>
          </span>
        ) : null}
        <h1 className="text-[26px] leading-tight font-semibold tracking-tight text-[var(--que-text)]">
          전체 프로젝트
        </h1>
      </div>
      <dl className="flex items-center gap-4 text-sm text-[var(--que-text-secondary)]">
        <div className="flex items-center gap-1.5">
          <FolderKanban className="size-4 text-[var(--que-text-tertiary)]" aria-hidden />
          <dt className="sr-only">프로젝트 수</dt>
          <dd>
            프로젝트 <span className="font-semibold text-[var(--que-text)]">{projectCount}</span>개
          </dd>
        </div>
        <div className="flex items-center gap-1.5">
          <ListTodo className="size-4 text-[var(--que-text-tertiary)]" aria-hidden />
          <dt className="sr-only">태스크 수</dt>
          <dd>
            태스크 <span className="font-semibold text-[var(--que-text)]">{taskCount}</span>개
          </dd>
        </div>
      </dl>
    </header>
  );
}
