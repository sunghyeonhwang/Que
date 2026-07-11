"use client";

import { useState } from "react";
import { ChevronDown, Plus } from "lucide-react";
import type { ObjectiveStatus } from "@que/core";
import type { OkrKeyResultView, OkrObjectiveView } from "@/lib/okr-data";
import { updateKeyResultProgressAction } from "@/app/(app)/daily/okr-actions";
import { useSafeAction } from "@/components/app/use-safe-action";
import { ToneBadge, type BadgeTone } from "@/components/app/tone-badge";
import { MemberAvatars } from "@/components/projects/member-avatars";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CreateKeyResultDialog } from "./create-key-result-dialog";
import { periodLabel, type OkrMember } from "./okr-board";
import { cn } from "@/lib/utils";

const OBJ_STATUS: Record<ObjectiveStatus, { label: string; tone: BadgeTone }> = {
  draft: { label: "초안", tone: "neutral" },
  active: { label: "진행", tone: "blue" },
  done: { label: "완료", tone: "green" },
  cancelled: { label: "취소", tone: "red" },
};

/** KR 평균 진척(0~100, 반올림). KR이 없으면 0. Objective 전체 진척 표시용. */
function averageProgress(keyResults: OkrKeyResultView[]): number {
  if (keyResults.length === 0) return 0;
  const sum = keyResults.reduce((acc, kr) => acc + kr.progress, 0);
  return Math.round(sum / keyResults.length);
}

/** 중립/브랜드 진척 바(상태색 아님 — 기획 §4). */
function ProgressBar({ value, className }: { value: number; className?: string }) {
  return (
    <div
      className={cn("h-2 w-full overflow-hidden rounded-full bg-[var(--que-bg-muted)]", className)}
      role="progressbar"
      aria-valuenow={value}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div
        className="h-full rounded-full bg-[var(--que-brand)] transition-all"
        style={{ width: `${Math.min(100, Math.max(0, value))}%` }}
      />
    </div>
  );
}

/**
 * Objective 카드(아코디언) — 헤더: 제목·기간·소유자·상태·전체 진척(KR 평균).
 * 펼치면 월 KR 행들 + (canManage) 핵심결과 추가.
 */
export function ObjectiveCard({
  view,
  members,
  memberById,
  currentMonth,
}: {
  view: OkrObjectiveView;
  members: OkrMember[];
  memberById: Map<string, OkrMember>;
  currentMonth: string;
}) {
  const { objective, keyResults, ownerName, canManage } = view;
  const [open, setOpen] = useState(true);
  const [krCreateOpen, setKrCreateOpen] = useState(false);
  const overall = averageProgress(keyResults);
  const status = OBJ_STATUS[objective.status];

  return (
    <div className="rounded-xl border border-[var(--que-border)] bg-[var(--que-bg)] shadow-[var(--que-shadow-sm)]">
      {/* 헤더(토글) */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full min-h-14 items-center gap-3 px-4 py-3 text-left"
      >
        <ChevronDown
          className={cn(
            "size-4 shrink-0 text-[var(--que-text-tertiary)] transition-transform",
            open ? "" : "-rotate-90",
          )}
          aria-hidden
        />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="truncate text-sm font-semibold text-[var(--que-text)]">
              {objective.title}
            </span>
            <ToneBadge tone={status.tone}>{status.label}</ToneBadge>
          </div>
          <p className="mt-0.5 truncate text-xs text-[var(--que-text-tertiary)]">
            {periodLabel(objective.period)} · 소유자 {ownerName} · 핵심결과 {keyResults.length}개
          </p>
        </div>
        <div className="flex w-28 shrink-0 items-center gap-2">
          <ProgressBar value={overall} />
          <span className="w-9 text-right text-xs font-medium tabular-nums text-[var(--que-text-secondary)]">
            {overall}%
          </span>
        </div>
      </button>

      {open && (
        <div className="border-t border-[var(--que-border)] px-4 py-3">
          {objective.description ? (
            <p className="mb-3 text-sm leading-relaxed text-[var(--que-text-secondary)]">
              {objective.description}
            </p>
          ) : null}

          {keyResults.length === 0 ? (
            <p className="py-3 text-center text-sm text-[var(--que-text-tertiary)]">
              아직 핵심결과(KR)가 없습니다. 이 목표를 측정할 월 핵심결과를 추가하세요.
            </p>
          ) : (
            <div className="flex flex-col gap-2">
              {keyResults.map((kr) => (
                <KrRow key={kr.keyResult.id} view={kr} owner={memberById.get(kr.keyResult.ownerId)} />
              ))}
            </div>
          )}

          {canManage && (
            <div className="mt-3">
              <Button
                variant="outline"
                className="h-10 gap-1.5 border-[var(--que-border)]"
                onClick={() => setKrCreateOpen(true)}
              >
                <Plus className="size-4" aria-hidden />
                핵심결과 추가
              </Button>
              <CreateKeyResultDialog
                open={krCreateOpen}
                onOpenChange={setKrCreateOpen}
                objectiveId={objective.id}
                objectiveTitle={objective.title}
                objectivePeriod={objective.period}
                members={members}
                currentMonth={currentMonth}
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

const METRIC_LABEL: Record<OkrKeyResultView["keyResult"]["metricType"], string> = {
  manual: "수동 지표",
  task_auto: "작업 자동",
};

/** 월 KR 행 — 진척 바·측정방식 뱃지·소유자·연결 작업 수·월. 확장 시 진척 입력/자동 안내. */
function KrRow({ view, owner }: { view: OkrKeyResultView; owner?: OkrMember }) {
  const { keyResult: kr, progress, linkedTaskCount, doneTaskCount, ownerName, canEditProgress } =
    view;
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState(String(kr.currentValue ?? 0));
  const { run, pending } = useSafeAction();

  const numeric = Number(value);
  const invalid = value.trim() === "" || Number.isNaN(numeric) || numeric < 0;

  const save = () => {
    if (invalid) return;
    run(() => updateKeyResultProgressAction({ keyResultId: kr.id, currentValue: numeric }), {
      success: "진척을 저장했습니다.",
    });
  };

  return (
    <div className="rounded-lg border border-[var(--que-border)]">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full min-h-12 flex-wrap items-center gap-x-3 gap-y-1.5 px-3 py-2.5 text-left"
      >
        <div className="flex min-w-0 flex-[2] items-center gap-2">
          <ChevronDown
            className={cn(
              "size-3.5 shrink-0 text-[var(--que-text-tertiary)] transition-transform",
              open ? "" : "-rotate-90",
            )}
            aria-hidden
          />
          <span className="truncate text-sm font-medium text-[var(--que-text)]">{kr.title}</span>
        </div>
        <span className="rounded-full border border-[var(--que-border)] px-2 py-0.5 text-[11px] font-medium text-[var(--que-text-secondary)]">
          {METRIC_LABEL[kr.metricType]}
        </span>
        <span className="text-xs text-[var(--que-text-tertiary)] tabular-nums">{kr.month}</span>
        {owner ? (
          <MemberAvatars members={[owner]} size={22} />
        ) : (
          <span className="text-xs text-[var(--que-text-tertiary)]">{ownerName}</span>
        )}
        <span className="text-xs text-[var(--que-text-tertiary)] tabular-nums">
          연결 작업 {linkedTaskCount}
          <span className="text-[var(--que-success)]"> (완료 {doneTaskCount})</span>
        </span>
        <div className="flex w-32 shrink-0 items-center gap-2">
          <ProgressBar value={progress} />
          <span className="w-9 text-right text-xs font-medium tabular-nums text-[var(--que-text-secondary)]">
            {progress}%
          </span>
        </div>
      </button>

      {open && (
        <div className="border-t border-[var(--que-border)] px-3 py-3">
          {kr.metricType === "task_auto" ? (
            <p className="text-sm text-[var(--que-text-secondary)]">
              연결된 작업의 완료율로 진척이 자동 계산됩니다. 현재 연결 작업 {linkedTaskCount}개 중{" "}
              {doneTaskCount}개 완료 ({progress}%). 작업을 이 핵심결과에 연결하려면 작업 상세에서
              &lsquo;핵심결과&rsquo;를 지정하세요.
            </p>
          ) : (
            <div className="flex flex-col gap-2">
              <p className="text-sm text-[var(--que-text-secondary)]">
                목표치 {kr.targetValue ?? 0}
                {kr.unit ? ` ${kr.unit}` : ""} 중 현재 진척을 입력합니다.
              </p>
              <div className="flex flex-wrap items-end gap-2">
                <label className="flex flex-col gap-1 text-xs text-[var(--que-text-secondary)]">
                  현재치{kr.unit ? ` (${kr.unit})` : ""}
                  <Input
                    type="number"
                    min={0}
                    className="h-10 w-36"
                    value={value}
                    onChange={(e) => setValue(e.target.value)}
                    disabled={!canEditProgress}
                    aria-invalid={invalid}
                    aria-label="현재 진척 값"
                  />
                </label>
                {canEditProgress ? (
                  <Button className="h-10" disabled={pending || invalid} onClick={save}>
                    {pending ? "저장 중…" : "저장"}
                  </Button>
                ) : null}
              </div>
              {invalid && value.trim() !== "" ? (
                <p className="text-xs text-[var(--que-error)]">0 이상의 숫자를 입력하세요.</p>
              ) : null}
              {!canEditProgress ? (
                <p className="text-xs text-[var(--que-text-tertiary)]">
                  진척은 핵심결과 소유자({ownerName}) 또는 관리자만 입력할 수 있습니다.
                </p>
              ) : null}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
