import type { ProjectProgressRow } from "@/lib/performance-data";
import { cn } from "@/lib/utils";

const STATUS_STYLE: Record<ProjectProgressRow["status"], string> = {
  // green=진행/완료, amber=주의/대기
  done: "bg-[var(--que-success-bg)] text-[var(--que-success)]",
  in_progress: "bg-[var(--que-success-bg)] text-[var(--que-success)]",
  waiting: "bg-[var(--que-warning-bg)] text-[var(--que-warning)]",
};

/** 프로젝트 진행률 — 전체 진행률 바 + project별 진행률/상태. */
export function ProjectProgressList({
  overall,
  projects,
}: {
  overall: number;
  projects: ProjectProgressRow[];
}) {
  return (
    <div className="flex flex-col gap-4">
      <div>
        <div className="mb-1.5 flex items-baseline justify-between">
          <span className="text-sm text-[var(--que-text-secondary)]">전체 진행률</span>
          <span className="text-sm font-semibold tabular-nums text-[var(--que-text)]">
            {overall}% 완료
          </span>
        </div>
        <Bar value={overall} thick />
      </div>

      <ul className="flex flex-col divide-y divide-[var(--que-border)]">
        {projects.length === 0 ? (
          <li className="py-6 text-center text-sm text-[var(--que-text-tertiary)]">
            진행 중 프로젝트가 없습니다
          </li>
        ) : (
          projects.map((p) => (
            <li key={p.id} className="flex items-center gap-3 py-3">
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate text-sm font-medium text-[var(--que-text)]">
                    {p.name}
                  </span>
                  <span className="shrink-0 text-xs tabular-nums text-[var(--que-text-tertiary)]">
                    {p.done}/{p.total}
                  </span>
                </div>
                <div className="mt-1.5">
                  <Bar value={p.progress} />
                </div>
              </div>
              <span
                className={cn(
                  "w-16 shrink-0 rounded-full px-2 py-1 text-center text-xs font-medium",
                  STATUS_STYLE[p.status],
                )}
              >
                {p.statusLabel}
              </span>
            </li>
          ))
        )}
      </ul>
    </div>
  );
}

function Bar({ value, thick }: { value: number; thick?: boolean }) {
  return (
    <div
      role="progressbar"
      aria-valuenow={value}
      aria-valuemin={0}
      aria-valuemax={100}
      className={cn("w-full overflow-hidden rounded-full bg-[var(--que-bg-muted)]", thick ? "h-2.5" : "h-1.5")}
    >
      <div
        className="h-full rounded-full bg-[var(--que-brand)]"
        style={{ width: `${Math.max(value, 2)}%` }}
      />
    </div>
  );
}
