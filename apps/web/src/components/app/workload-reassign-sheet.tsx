"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { format } from "date-fns";
import { ko } from "date-fns/locale";
import { ArrowRight, CalendarClock, Loader2, UserRoundCog } from "lucide-react";
import type { HomeLoadRow } from "@/lib/home-load";
import {
  getMemberOpenTasksAction,
  type MemberOpenTask,
} from "@/app/(app)/home/load-actions";
import { reassignTaskAction, updateTaskDetailsAction } from "@/app/(app)/projects/pm-actions";
import { dueDateToIso } from "@/lib/pm-columns";
import { useOptimisticAction } from "@/components/app/use-optimistic-action";
import { StatusBadge } from "@/components/app/status-badge";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

// 업무 부하 표 → 행 '조정' → 재배분 시트(관리자 전용). 그 사람의 열린 작업을 지연 로드하고
// 담당자 변경(reassignTaskAction)·마감 미루기(updateTaskDetailsAction)를 그 자리에서 낙관 커밋한다.
// 부하 비율(파생값)은 억지로 로컬 재계산하지 않고 다음 새로고침에 맡긴다(낙관 원칙 일관).

/** endAt ISO → <input type="date">용 "yyyy-MM-dd"(로컬). 없으면 "". */
function isoToDateInput(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "" : format(d, "yyyy-MM-dd");
}

/** 마감 라벨(M월 d일) — 없으면 '마감 없음'. */
function dueLabel(dateStr: string): string {
  if (!dateStr) return "마감 없음";
  const d = new Date(`${dateStr}T00:00:00`);
  return Number.isNaN(d.getTime()) ? "마감 없음" : format(d, "M월 d일", { locale: ko });
}

/** 작업별 낙관 오버라이드 — 이관 대상 이름·바뀐 마감(yyyy-MM-dd 또는 ""). */
interface TaskOverride {
  reassignedToName?: string;
  newDue?: string;
}

export function WorkloadReassignSheet({
  row,
  allRows,
  open,
  onOpenChange,
}: {
  /** 조정 대상 행. 닫힐 때 null이 되므로 본문은 row로 게이트한다. */
  row: HomeLoadRow | null;
  /** 담당자 변경 옵션(표가 이미 가진 부하 데이터 재사용). */
  allRows: HomeLoadRow[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const ratioText = row?.ratio == null ? "판단 불가" : `${row.ratio}%`;
  const estText = row
    ? `${row.estimatedHours > 0 ? row.estimatedHours : 0}h / ${row.capacityHours}h`
    : "";

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full gap-0 p-0 sm:max-w-md">
        <SheetHeader className="border-b border-[var(--que-border)]">
          <SheetTitle>{row ? `${row.name} 업무 조정` : "업무 조정"}</SheetTitle>
          <SheetDescription>
            담당자 변경·마감 미루기로 부하를 나눕니다. 개인 평가가 아닙니다.
          </SheetDescription>
          {row && (
            <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
              <span
                className={cn(
                  "inline-flex items-center rounded-full border px-2.5 py-1 font-medium tabular-nums",
                  row.ratio != null && row.ratio >= 100
                    ? "border-[var(--que-error)] bg-[var(--que-error-bg)] text-[var(--que-error)]"
                    : row.ratio != null && row.ratio >= 90
                      ? "border-[var(--que-warning)] bg-[var(--que-warning-bg)] text-[var(--que-warning)]"
                      : "border-[var(--que-border)] bg-[var(--que-bg-muted)] text-[var(--que-text-secondary)]",
                )}
              >
                비율 {ratioText}
              </span>
              <span className="inline-flex items-center rounded-full border border-[var(--que-border)] bg-[var(--que-bg-muted)] px-2.5 py-1 font-medium tabular-nums text-[var(--que-text-secondary)]">
                예상/가용 {estText}
              </span>
              <span className="inline-flex items-center rounded-full border border-[var(--que-border)] bg-[var(--que-bg-muted)] px-2.5 py-1 font-medium tabular-nums text-[var(--que-text-secondary)]">
                열린 작업 {row.openTasks}건
              </span>
            </div>
          )}
        </SheetHeader>

        {/* 본문 — userId로 keying해 대상이 바뀌면 로딩/오버라이드 상태가 새로 시작된다. */}
        {row ? (
          <ReassignBody key={row.userId} row={row} allRows={allRows} />
        ) : (
          <div className="min-h-0 flex-1" />
        )}

        <SheetFooter className="border-t border-[var(--que-border)]">
          <p className="text-xs text-[var(--que-text-tertiary)]">
            조정 후 비율은 화면 새로고침 시 반영됩니다.
          </p>
          <Link
            href="/team"
            className="inline-flex min-h-10 w-full items-center justify-center rounded-lg border border-[var(--que-brand)] bg-[var(--que-brand-subtle)] px-3 text-sm font-medium text-[var(--que-brand)] transition-colors hover:bg-[var(--que-brand-subtle)]/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            팀 현황에서 보기 →
          </Link>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

/** 시트 본문 — 열린 작업 지연 로드 + 낙관 조정. row.userId로 keying되어 마운트마다 새로 로드한다. */
function ReassignBody({ row, allRows }: { row: HomeLoadRow; allRows: HomeLoadRow[] }) {
  const { run } = useOptimisticAction();
  const [loadPending, startLoad] = useTransition();
  const [tasks, setTasks] = useState<MemberOpenTask[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [overrides, setOverrides] = useState<Record<string, TaskOverride>>({});

  const userId = row.userId;

  // 마운트 시 1회 지연 로드(async 콜백 내 setState만 사용 — 동기 setState 없음).
  useEffect(() => {
    startLoad(async () => {
      const res = await getMemberOpenTasksAction(userId);
      if (res.ok) setTasks(res.tasks);
      else setLoadError(res.error);
    });
  }, [userId]);

  // 담당자 옵션: 본인 제외 · 부하 비율 낮은 순(미입력은 0으로 취급해 상위).
  const assigneeOptions = allRows
    .filter((r) => r.userId !== userId)
    .slice()
    .sort((a, b) => (a.ratio ?? 0) - (b.ratio ?? 0));

  function reassign(task: MemberOpenTask, targetId: string) {
    const target = allRows.find((r) => r.userId === targetId);
    if (!target) return;
    const prev = overrides[task.id];
    run(() => reassignTaskAction({ taskId: task.id, assigneeId: targetId }), {
      apply: () =>
        setOverrides((o) => ({ ...o, [task.id]: { ...o[task.id], reassignedToName: target.name } })),
      rollback: () => setOverrides((o) => ({ ...o, [task.id]: prev })),
      success: `"${task.title}" → ${target.name}`,
      source: "workload-reassign",
    });
  }

  function pushDue(task: MemberOpenTask, dateStr: string) {
    const current = overrides[task.id]?.newDue ?? isoToDateInput(task.endAt);
    if (dateStr === current) return;
    const prev = overrides[task.id];
    run(
      () =>
        updateTaskDetailsAction({
          taskId: task.id,
          endAt: dateStr ? dueDateToIso(dateStr) : null,
        }),
      {
        apply: () =>
          setOverrides((o) => ({ ...o, [task.id]: { ...o[task.id], newDue: dateStr } })),
        rollback: () => setOverrides((o) => ({ ...o, [task.id]: prev })),
        success: dateStr
          ? `"${task.title}" 마감을 ${dueLabel(dateStr)}로 옮겼습니다`
          : `"${task.title}" 마감을 지웠습니다`,
        source: "workload-due",
      },
    );
  }

  return (
    <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
      {loadPending && (
        <div className="flex items-center justify-center gap-2 py-10 text-sm text-[var(--que-text-tertiary)]">
          <Loader2 className="size-4 animate-spin" aria-hidden />
          작업을 불러오는 중입니다…
        </div>
      )}
      {!loadPending && loadError && (
        <p className="py-10 text-center text-sm text-[var(--que-error)]">{loadError}</p>
      )}
      {!loadPending && !loadError && tasks && tasks.length === 0 && (
        <p className="py-10 text-center text-sm text-[var(--que-text-tertiary)]">
          조정할 열린 작업이 없습니다.
        </p>
      )}
      {!loadPending && !loadError && tasks && tasks.length > 0 && (
        <ul className="flex flex-col gap-3">
          {tasks.map((task) => {
            const ov = overrides[task.id];
            const reassigned = Boolean(ov?.reassignedToName);
            const dueValue = ov?.newDue ?? isoToDateInput(task.endAt);
            return (
              <li
                key={task.id}
                className={cn(
                  "rounded-lg border border-[var(--que-border)] bg-[var(--que-bg)] p-3",
                  reassigned && "opacity-60",
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-[var(--que-text)]">
                      {task.title}
                    </p>
                    <p className="mt-0.5 truncate text-xs text-[var(--que-text-tertiary)]">
                      {task.projectName ?? "프로젝트 없음"} ·{" "}
                      {task.estimatedHours != null ? `${task.estimatedHours}h` : "예상 미입력"}
                    </p>
                  </div>
                  <StatusBadge status={task.status} />
                </div>

                {reassigned ? (
                  <p className="mt-2 inline-flex items-center gap-1.5 rounded-md bg-[var(--que-bg-muted)] px-2 py-1 text-xs font-medium text-[var(--que-text-secondary)]">
                    <ArrowRight className="size-3.5" aria-hidden />
                    {ov?.reassignedToName}(으)로 이관됨
                  </p>
                ) : (
                  <div className="mt-2 flex flex-col gap-2 sm:flex-row">
                    {/* 담당자 변경 */}
                    <label className="flex min-w-0 flex-1 flex-col gap-1">
                      <span className="inline-flex items-center gap-1 text-xs font-medium text-[var(--que-text-secondary)]">
                        <UserRoundCog className="size-3.5" aria-hidden />
                        담당자 변경
                      </span>
                      <Select value="" onValueChange={(v) => v && reassign(task, v)}>
                        <SelectTrigger
                          size="lg"
                          className="min-h-10 w-full"
                          aria-label={`${task.title} 담당자 변경`}
                        >
                          <SelectValue placeholder="옮길 사람 선택" />
                        </SelectTrigger>
                        <SelectContent>
                          {assigneeOptions.map((r) => (
                            <SelectItem key={r.userId} value={r.userId}>
                              {r.name} · {r.ratio == null ? "미입력" : `${r.ratio}%`}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </label>

                    {/* 마감 미루기 */}
                    <label className="flex min-w-0 flex-1 flex-col gap-1">
                      <span className="inline-flex items-center gap-1 text-xs font-medium text-[var(--que-text-secondary)]">
                        <CalendarClock className="size-3.5" aria-hidden />
                        마감 미루기
                      </span>
                      <Input
                        type="date"
                        value={dueValue}
                        onChange={(e) => pushDue(task, e.target.value)}
                        className="min-h-10"
                        aria-label={`${task.title} 마감일`}
                      />
                    </label>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
