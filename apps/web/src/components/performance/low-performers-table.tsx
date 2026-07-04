import type { LowPerformerRow } from "@/lib/performance-data";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

/** 저성과 팀 표 — 이름·부서·기한 초과·완료. 평가가 아니라 부하/병목 진단용. 내부 세로 스크롤 + sticky header. */
export function LowPerformersTable({ rows }: { rows: LowPerformerRow[] }) {
  return (
    <div className="max-h-72 overflow-y-auto rounded-xl border border-[var(--que-border)] bg-[var(--que-bg)]">
      <Table>
        <TableHeader className="sticky top-0 z-10 bg-[var(--que-bg)] [&_tr]:border-b [&_tr]:border-[var(--que-border)]">
          <TableRow className="hover:bg-transparent">
            <TableHead className="text-xs font-medium text-[var(--que-text-tertiary)]">멤버</TableHead>
            <TableHead className="text-xs font-medium text-[var(--que-text-tertiary)]">부서</TableHead>
            <TableHead className="text-right text-xs font-medium text-[var(--que-text-tertiary)]">기한 초과</TableHead>
            <TableHead className="text-right text-xs font-medium text-[var(--que-text-tertiary)]">완료</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((r) => (
            <TableRow
              key={r.userId}
              className="border-[var(--que-border)] transition-colors hover:bg-[var(--que-bg-muted)]"
            >
              <TableCell className="h-11">
                <span className="flex items-center gap-2">
                  <span
                    className="size-6 shrink-0 rounded-full text-[10px] font-medium text-white"
                    style={{ backgroundColor: r.avatarColor }}
                    aria-hidden
                  >
                    <span className="flex size-6 items-center justify-center">
                      {r.name.slice(-2)}
                    </span>
                  </span>
                  <span className="font-medium text-[var(--que-text)]">{r.name}</span>
                </span>
              </TableCell>
              <TableCell className="text-[var(--que-text-secondary)]">
                {r.department || "-"}
              </TableCell>
              <TableCell className="text-right tabular-nums">
                <span
                  className={
                    r.overdue > 0
                      ? "font-semibold text-[var(--que-error)]"
                      : "text-[var(--que-text-tertiary)]"
                  }
                >
                  {r.overdue}
                </span>
              </TableCell>
              <TableCell className="text-right tabular-nums">
                <span className="font-medium text-[var(--que-success)]">{r.completed}</span>
                <span className="text-[var(--que-text-tertiary)]"> Task</span>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
