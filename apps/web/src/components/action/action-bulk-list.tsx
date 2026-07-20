"use client";

import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import { setActionItemStatusBulkAction } from "@/app/(app)/action/actions";
import {
  ActionRow,
  type ActionClientOption,
  type ActionProjectOption,
  type ActionRowData,
} from "@/components/action/action-row";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

// 확인필요 목록 일괄 처리(2026-07-21 사용자 — "셀렉터로 선택 후 전체 무시/보류").
// 각 미처리 행 왼쪽에 체크박스, 상단 툴바에 전체 선택 + [선택 보류]/[선택 무시].
// 처리된 행(생성/무시)은 선택 대상이 아니다(개별 처리 UI도 없음 — 동일 규칙).
// 무시는 이 화면에서 되돌릴 UI가 없는 사실상 종결이라 건수 확인 Dialog를 한 번 거친다.
// 보류(held)는 미처리로 남아 계속 편집 가능하므로 즉시 실행.

/** 선택(일괄 처리) 가능한 행 — 처리 완료(생성/무시)는 제외. */
function isSelectable(row: ActionRowData): boolean {
  return row.status !== "created" && row.status !== "ignored";
}

export function ActionBulkList({
  rows,
  projects,
  clients,
}: {
  rows: ActionRowData[];
  projects: ActionProjectOption[];
  clients: ActionClientOption[];
}) {
  const selectableIds = useMemo(
    () => rows.filter(isSelectable).map((r) => r.id),
    [rows],
  );
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set());
  // revalidate로 행이 처리되어 목록에서 빠져도 잔존 선택이 남지 않게 렌더 시 교집합만 쓴다.
  const effective = useMemo(
    () => selectableIds.filter((id) => selected.has(id)),
    [selectableIds, selected],
  );
  const count = effective.length;
  const allSelected = selectableIds.length > 0 && count === selectableIds.length;

  const [confirmIgnore, setConfirmIgnore] = useState(false);
  const [isPending, startTransition] = useTransition();

  const toggle = (id: string, next: boolean) => {
    setSelected((prev) => {
      const copy = new Set(prev);
      if (next) copy.add(id);
      else copy.delete(id);
      return copy;
    });
  };
  const toggleAll = (next: boolean) => {
    setSelected(next ? new Set(selectableIds) : new Set());
  };

  const bulk = (to: "held" | "ignored") => {
    if (count === 0 || isPending) return;
    const ids = [...effective];
    startTransition(async () => {
      const result = await setActionItemStatusBulkAction({ actionItemIds: ids, to });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      const verb = to === "held" ? "보류" : "무시";
      toast.success(
        `${result.done}건을 ${verb}했습니다.` +
          (result.skipped > 0 ? ` (권한 없는 ${result.skipped}건 제외)` : ""),
      );
      setSelected(new Set());
      setConfirmIgnore(false);
    });
  };

  return (
    <>
      {/* 일괄 처리 툴바 — 선택 가능한 행이 있을 때만. */}
      {selectableIds.length > 0 && (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl border border-[var(--que-border)] bg-[var(--que-bg)] px-3 py-1.5">
          <label className="flex min-h-10 cursor-pointer items-center gap-2.5 text-sm font-medium text-[var(--que-text-secondary)]">
            <Checkbox
              checked={allSelected}
              indeterminate={count > 0 && !allSelected}
              onCheckedChange={(next) => toggleAll(next === true)}
              aria-label="미처리 후보 전체 선택"
            />
            전체 선택
          </label>
          <span className="text-sm tabular-nums text-[var(--que-text-tertiary)]">
            {count}건 선택
          </span>
          <span className="ml-auto flex gap-2">
            <Button
              variant="outline"
              size="sm"
              className="h-10 rounded-lg"
              disabled={count === 0 || isPending}
              onClick={() => bulk("held")}
            >
              {isPending ? "처리 중…" : "선택 보류"}
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-10 rounded-lg border-[var(--que-error)]/40 text-[var(--que-error)] hover:bg-[var(--que-error-bg)] hover:text-[var(--que-error)]"
              disabled={count === 0 || isPending}
              onClick={() => setConfirmIgnore(true)}
            >
              선택 무시
            </Button>
          </span>
        </div>
      )}

      {rows.map((row) =>
        isSelectable(row) ? (
          <div key={row.id} className="flex items-start gap-2.5">
            <span className="flex h-11 shrink-0 items-center pl-1">
              <Checkbox
                checked={effective.includes(row.id)}
                onCheckedChange={(next) => toggle(row.id, next === true)}
                aria-label={`"${row.title}" 선택`}
              />
            </span>
            <div className="min-w-0 flex-1">
              <ActionRow item={row} projects={projects} clients={clients} />
            </div>
          </div>
        ) : (
          // 처리된 행: 체크박스 자리만큼 들여써 제목 정렬을 맞춘다.
          <div key={row.id} className="flex items-start gap-2.5">
            <span className="w-4 shrink-0 pl-1" aria-hidden />
            <div className="min-w-0 flex-1">
              <ActionRow item={row} projects={projects} clients={clients} />
            </div>
          </div>
        ),
      )}

      {/* 무시 확인 — 무시는 목록에서 편집 불가 상태로 종결되므로 건수를 한 번 확인한다. */}
      <Dialog open={confirmIgnore} onOpenChange={setConfirmIgnore}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>선택한 {count}건을 무시할까요?</DialogTitle>
            <DialogDescription>
              무시한 후보는 처리 완료로 표시되고 이 화면에서 더 이상 편집할 수 없습니다.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              className="h-10 rounded-lg"
              disabled={isPending}
              onClick={() => setConfirmIgnore(false)}
            >
              취소
            </Button>
            <Button
              className="h-10 rounded-lg bg-[var(--que-error)] text-white hover:bg-[var(--que-error)]/90"
              disabled={isPending || count === 0}
              onClick={() => bulk("ignored")}
            >
              {isPending ? "처리 중…" : `${count}건 무시`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
