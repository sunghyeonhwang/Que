import { AlertTriangle, Pause } from "lucide-react";
import type { ReportBlocker } from "@/lib/report-data";
import { Badge } from "@/components/ui/badge";

/** 현재 막힘 — 문제발생/홀드로 멈춰 있는 작업(도움이 필요한 곳). 대표 홈 조망용. */
export function BlockerList({ blockers }: { blockers: ReportBlocker[] }) {
  if (blockers.length === 0) {
    return (
      <p className="text-sm text-[var(--que-text-tertiary)]">현재 막혀 있는 작업이 없습니다.</p>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {blockers.map((b) => {
        const isIssue = b.status === "issue";
        return (
          <div
            key={b.taskId}
            className="flex min-h-11 flex-wrap items-center gap-2 rounded-lg border border-[var(--que-border)] px-3 py-2"
          >
            <Badge
              variant="outline"
              className={
                "gap-1 " +
                (isIssue
                  ? "border-[var(--que-error)] bg-[var(--que-error-bg)] text-[var(--que-error)]"
                  : "border-[var(--que-warning)] bg-[var(--que-warning-bg)] text-[var(--que-warning)]")
              }
            >
              {isIssue ? (
                <AlertTriangle className="size-3" aria-hidden />
              ) : (
                <Pause className="size-3" aria-hidden />
              )}
              {isIssue ? "문제발생" : "홀드"}
            </Badge>
            <span className="min-w-0 flex-1 truncate text-sm font-medium text-[var(--que-text)]">
              {b.taskTitle}
            </span>
            <span className="text-xs text-[var(--que-text-tertiary)]">
              {b.projectName ?? "프로젝트 미지정"} · 담당 {b.assigneeName} · {b.sinceLabel}
            </span>
            {b.reason && (
              <span className="w-full truncate text-xs text-[var(--que-text-secondary)]">
                사유: {b.reason}
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}
