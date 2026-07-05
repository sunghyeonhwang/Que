import Link from "next/link";
import type { ClientOverviewRow } from "@/lib/client-overview";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

/** 대표 홈 — 클라이언트(거래처)별 현황. 활성 프로젝트·평균 진행률·막힘/열린 작업.
 *  개인 평가가 아니라 사업 단위 진척·병목 요약. 내부 세로 스크롤 + sticky header. */
export function ClientOverviewCard({ rows }: { rows: ClientOverviewRow[] }) {
  if (rows.length === 0) {
    return (
      <p className="text-sm text-[var(--que-text-tertiary)]">활성 클라이언트가 없습니다.</p>
    );
  }

  return (
    <div className="max-h-80 overflow-y-auto rounded-lg border border-[var(--que-border)]">
      <Table>
        <TableHeader className="sticky top-0 z-10 bg-[var(--que-bg)] [&_tr]:border-b [&_tr]:border-[var(--que-border)]">
          <TableRow className="hover:bg-transparent">
            <TableHead className="text-xs font-medium text-[var(--que-text-tertiary)]">
              클라이언트
            </TableHead>
            <TableHead className="text-right text-xs font-medium text-[var(--que-text-tertiary)]">
              활성 PJ
            </TableHead>
            <TableHead className="w-32 text-xs font-medium text-[var(--que-text-tertiary)]">
              평균 진행률
            </TableHead>
            <TableHead className="text-right text-xs font-medium text-[var(--que-text-tertiary)]">
              막힘
            </TableHead>
            <TableHead className="text-right text-xs font-medium text-[var(--que-text-tertiary)]">
              열린 작업
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((r) => (
            <TableRow
              key={r.clientId}
              className="border-[var(--que-border)] transition-colors hover:bg-[var(--que-bg-muted)]"
            >
              <TableCell className="h-11">
                <Link
                  href={`/clients?client=${r.clientId}`}
                  className="font-medium text-[var(--que-text)] underline-offset-2 hover:underline"
                >
                  {r.clientName}
                </Link>
              </TableCell>
              <TableCell className="text-right tabular-nums text-[var(--que-text-secondary)]">
                {r.activeProjects}
              </TableCell>
              <TableCell>
                <span className="flex items-center gap-2">
                  <span
                    className="h-2 min-w-1 flex-1 overflow-hidden rounded-full bg-[var(--que-bg-muted)]"
                    aria-hidden
                  >
                    <span
                      className="block h-full rounded-full bg-[var(--que-success)]"
                      style={{ width: `${r.avgProgress}%` }}
                    />
                  </span>
                  <span className="w-9 shrink-0 text-right text-xs tabular-nums text-[var(--que-text-secondary)]">
                    {r.avgProgress}%
                  </span>
                </span>
              </TableCell>
              <TableCell className="text-right tabular-nums">
                <span
                  className={
                    r.blockedTasks > 0
                      ? "font-semibold text-[var(--que-error)]"
                      : "text-[var(--que-text-tertiary)]"
                  }
                >
                  {r.blockedTasks}
                </span>
              </TableCell>
              <TableCell className="text-right tabular-nums text-[var(--que-text-secondary)]">
                {r.openTasks}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
