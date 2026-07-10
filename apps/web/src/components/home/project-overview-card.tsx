import Link from "next/link";
import type { HomeProjectRow } from "@/lib/home-grade-data";

// Home/ProjectOverview — 위험도 높은 활성 프로젝트. 진행률·마감·지연·막힘·상태.
// 상태 뱃지: 지연=red, 주의=amber, 정상=green(색+텍스트 병기 — 색 단독 금지).
const STATUS: Record<HomeProjectRow["status"], { label: string; className: string }> = {
  delayed: {
    label: "지연",
    className: "border-[var(--que-error)] bg-[var(--que-error-bg)] text-[var(--que-error)]",
  },
  at_risk: {
    label: "주의",
    className: "border-[var(--que-warning)] bg-[var(--que-warning-bg)] text-[var(--que-warning)]",
  },
  on_track: {
    label: "정상",
    className: "border-[var(--que-success)] bg-[var(--que-success-bg)] text-[var(--que-success)]",
  },
};

/** 프로젝트 현황 리스트 — 행 클릭 시 프로젝트 화면으로. 내부 세로 스크롤. */
export function ProjectOverviewCard({ rows }: { rows: HomeProjectRow[] }) {
  if (rows.length === 0) {
    return (
      <div className="flex min-h-[96px] items-center justify-center rounded-lg border border-dashed border-[var(--que-border)] text-sm text-[var(--que-text-tertiary)]">
        표시할 활성 프로젝트가 없습니다.
      </div>
    );
  }

  return (
    <ul className="flex max-h-[380px] flex-col gap-2 overflow-y-auto pr-0.5">
      {rows.map((row) => {
        const status = STATUS[row.status];
        return (
          <li key={row.projectId}>
            <Link
              href="/projects"
              className="block rounded-lg border border-[var(--que-border)] p-3 transition-colors hover:bg-[var(--que-bg-muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <div className="flex items-center gap-2">
                <span
                  className={
                    "shrink-0 rounded-md border px-1.5 py-0.5 text-xs font-medium " +
                    status.className
                  }
                >
                  {status.label}
                </span>
                <span className="min-w-0 flex-1 truncate text-sm font-medium text-[var(--que-text)]">
                  {row.name}
                </span>
                {row.dueLabel && (
                  <span className="shrink-0 text-xs tabular-nums text-[var(--que-text-tertiary)]">
                    마감 {row.dueLabel}
                  </span>
                )}
              </div>

              <div className="mt-2 flex items-center gap-2">
                <span
                  className="h-2 min-w-1 flex-1 overflow-hidden rounded-full bg-[var(--que-bg-muted)]"
                  aria-hidden
                >
                  <span
                    className="block h-full rounded-full bg-[var(--que-success)]"
                    style={{ width: `${row.progress}%` }}
                  />
                </span>
                <span className="w-10 shrink-0 text-right text-xs tabular-nums text-[var(--que-text-secondary)]">
                  {row.progress}%
                </span>
              </div>

              <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[var(--que-text-tertiary)]">
                <span>열린 작업 {row.openTasks}</span>
                {row.overdueTasks > 0 && (
                  <span className="font-medium text-[var(--que-error)]">
                    지연 {row.overdueTasks}
                  </span>
                )}
                {row.blockedTasks > 0 && (
                  <span className="font-medium text-[var(--que-warning)]">
                    막힘 {row.blockedTasks}
                  </span>
                )}
              </div>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
