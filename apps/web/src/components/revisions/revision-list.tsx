"use client";

import { useMemo, useState } from "react";
import type { RevisionNoteStatus } from "@que/core";
import { updateRevisionStatusAction } from "@/app/(app)/revisions/actions";
import { useSafeAction } from "@/components/app/use-safe-action";
import type { RevisionNoteRow } from "@/lib/revisions-data";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import {
  REVISION_STATUSES,
  REVISION_STATUS_LABELS,
  formatRevisionTime,
} from "./revision-meta";

type Filter = "all" | RevisionNoteStatus;

// 인라인 상태 변경 Select의 트리거를 상태색 알약으로 보여준다(문제=red·대기=amber·완료=green).
const TRIGGER_TONE: Record<RevisionNoteStatus, string> = {
  unresolved: "border-transparent bg-[var(--que-error-bg)] text-[var(--que-error)]",
  hold: "border-transparent bg-[var(--que-warning-bg)] text-[var(--que-warning)]",
  resolved: "border-transparent bg-[var(--que-success-bg)] text-[var(--que-success)]",
};

const STATUS_ITEMS = Object.fromEntries(
  REVISION_STATUSES.map((s) => [s, REVISION_STATUS_LABELS[s]]),
);

/** 수정사항 목록 — 최신순 표 + 상태 필터 + 행 내 상태 인라인 변경(팀 공용, 누구나 변경). */
export function RevisionList({ rows }: { rows: RevisionNoteRow[] }) {
  const [filter, setFilter] = useState<Filter>("all");

  const counts = useMemo(() => {
    const base: Record<Filter, number> = { all: rows.length, unresolved: 0, hold: 0, resolved: 0 };
    for (const row of rows) base[row.status] += 1;
    return base;
  }, [rows]);

  const visible = filter === "all" ? rows : rows.filter((r) => r.status === filter);

  const filters: { key: Filter; label: string }[] = [
    { key: "all", label: "전체" },
    { key: "unresolved", label: REVISION_STATUS_LABELS.unresolved },
    { key: "hold", label: REVISION_STATUS_LABELS.hold },
    { key: "resolved", label: REVISION_STATUS_LABELS.resolved },
  ];

  return (
    <section className="flex min-w-0 flex-col rounded-xl border border-[var(--que-border)] bg-[var(--que-bg)]">
      <header className="flex flex-wrap items-center gap-2 border-b border-[var(--que-border)] px-4 py-3">
        <h2 className="mr-auto text-base font-semibold text-[var(--que-text)]">수정사항 목록</h2>
        <div className="flex flex-wrap gap-1.5">
          {filters.map((f) => (
            <button
              key={f.key}
              type="button"
              onClick={() => setFilter(f.key)}
              className={cn(
                "inline-flex h-8 items-center gap-1.5 rounded-full px-3 text-xs font-medium transition-colors",
                filter === f.key
                  ? "bg-[var(--que-text)] text-[var(--que-bg)]"
                  : "bg-[var(--que-bg-muted)] text-[var(--que-text-secondary)] hover:bg-[var(--que-border)]",
              )}
            >
              {f.label}
              <span className="tabular-nums opacity-70">{counts[f.key]}</span>
            </button>
          ))}
        </div>
      </header>

      {visible.length === 0 ? (
        <p className="px-4 py-14 text-center text-sm text-[var(--que-text-tertiary)]">
          {rows.length === 0
            ? "등록된 수정사항이 없습니다. 위 폼에서 첫 수정사항을 적어 주세요."
            : "해당 상태의 수정사항이 없습니다."}
        </p>
      ) : (
        <div className="max-h-[calc(100dvh-22rem)] overflow-auto">
          <Table>
            <TableHeader className="sticky top-0 z-10 bg-[var(--que-bg)] [&_tr]:border-b [&_tr]:border-[var(--que-border)]">
              <TableRow>
                <TableHead className="w-[9rem]">메뉴</TableHead>
                <TableHead className="w-[9rem]">위치</TableHead>
                <TableHead className="min-w-[16rem]">오류사항</TableHead>
                <TableHead className="w-[7.5rem]">상태</TableHead>
                <TableHead className="w-[7rem]">작성자</TableHead>
                <TableHead className="w-[8.5rem]">작성시간</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {visible.map((row) => (
                <RevisionRow key={row.id} row={row} />
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </section>
  );
}

function RevisionRow({ row }: { row: RevisionNoteRow }) {
  const { run, pending } = useSafeAction();

  const change = (next: RevisionNoteStatus) => {
    if (next === row.status) return;
    run(() => updateRevisionStatusAction({ id: row.id, status: next }), {
      success: `상태를 "${REVISION_STATUS_LABELS[next]}"(으)로 변경했습니다.`,
    });
  };

  return (
    <TableRow className="align-top">
      <TableCell className="font-medium text-[var(--que-text)]">{row.menu}</TableCell>
      <TableCell className="text-[var(--que-text-secondary)]">{row.location || "—"}</TableCell>
      <TableCell className="whitespace-pre-wrap text-[var(--que-text)]">{row.description}</TableCell>
      <TableCell>
        <Select
          items={STATUS_ITEMS}
          value={row.status}
          onValueChange={(v) => change((v as RevisionNoteStatus) ?? row.status)}
          disabled={pending}
        >
          <SelectTrigger
            aria-label={`상태 변경 (현재 ${REVISION_STATUS_LABELS[row.status]})`}
            className={cn(
              "h-10 w-full justify-center rounded-full font-medium",
              TRIGGER_TONE[row.status],
            )}
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {REVISION_STATUSES.map((s) => (
              <SelectItem key={s} value={s}>
                {REVISION_STATUS_LABELS[s]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </TableCell>
      <TableCell className="text-[var(--que-text-secondary)]">{row.authorName}</TableCell>
      <TableCell className="text-[var(--que-text-tertiary)]">
        <span className="tabular-nums">{formatRevisionTime(row.createdAt)}</span>
        {row.updatedAt && (
          <span className="mt-0.5 block text-[11px] text-[var(--que-text-tertiary)]">
            변경 {formatRevisionTime(row.updatedAt)}
            {row.updatedByName ? ` · ${row.updatedByName}` : ""}
          </span>
        )}
      </TableCell>
    </TableRow>
  );
}
