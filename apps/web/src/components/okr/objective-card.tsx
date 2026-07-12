"use client";

import { useEffect, useRef, useState } from "react";
import { useAnimate } from "motion/react";
import { format } from "date-fns";
import { ChevronDown, ListChecks, Lock, Plus } from "lucide-react";
import type { ObjectiveStatus, StateCheck } from "@que/core";
import type { OkrKeyResultView, OkrObjectiveView } from "@/lib/okr-data";
import {
  toggleKeyResultCheckAction,
  updateKeyResultProgressAction,
} from "@/app/(app)/daily/okr-actions";
import { useSafeAction } from "@/components/app/use-safe-action";
import { ToneBadge, type BadgeTone } from "@/components/app/tone-badge";
import { MemberAvatars } from "@/components/projects/member-avatars";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
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
                <KrRow
                  key={kr.keyResult.id}
                  view={kr}
                  owner={memberById.get(kr.keyResult.ownerId)}
                  memberById={memberById}
                />
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
  state: "상태 체크",
};

/** 월 KR 행 — 진척 바·측정방식 뱃지·소유자·연결 작업 수·월. 확장 시 진척 입력/자동 안내/상태 체크리스트. */
function KrRow({
  view,
  owner,
  memberById,
}: {
  view: OkrKeyResultView;
  owner?: OkrMember;
  memberById: Map<string, OkrMember>;
}) {
  const {
    keyResult: kr,
    progress,
    linkedTaskCount,
    doneTaskCount,
    ownerName,
    canEditProgress,
    canToggleChecks,
    isAdmin,
  } = view;
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState(String(kr.currentValue ?? 0));
  const { run, pending } = useSafeAction();

  const numeric = Number(value);
  const invalid = value.trim() === "" || Number.isNaN(numeric) || numeric < 0;
  const isState = kr.metricType === "state";

  const save = () => {
    if (invalid) return;
    run(() => updateKeyResultProgressAction({ keyResultId: kr.id, currentValue: numeric }), {
      success: "진척을 저장했습니다.",
    });
  };

  const toggleCheck = (checkId: string, done: boolean) => {
    run(() => toggleKeyResultCheckAction({ keyResultId: kr.id, checkId, done }), {
      success: done ? "체크했습니다." : "체크를 해제했습니다.",
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
        <span
          className={cn(
            "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium",
            isState
              ? "border-[var(--que-border-strong)] text-[var(--que-text)]"
              : "border-[var(--que-border)] text-[var(--que-text-secondary)]",
          )}
        >
          {isState ? <ListChecks className="size-3" aria-hidden /> : null}
          {METRIC_LABEL[kr.metricType]}
        </span>
        <span className="text-xs text-[var(--que-text-tertiary)] tabular-nums">{kr.month}</span>
        {owner ? (
          <MemberAvatars members={[owner]} size={22} />
        ) : (
          <span className="text-xs text-[var(--que-text-tertiary)]">{ownerName}</span>
        )}
        {isState ? (
          <span className="text-xs text-[var(--que-text-tertiary)] tabular-nums">
            체크 {(kr.stateChecks ?? []).filter((c) => c.done).length}/
            {(kr.stateChecks ?? []).length}
          </span>
        ) : (
          <span className="text-xs text-[var(--que-text-tertiary)] tabular-nums">
            연결 작업 {linkedTaskCount}
            <span className="text-[var(--que-success)]"> (완료 {doneTaskCount})</span>
          </span>
        )}
        <div className="flex w-32 shrink-0 items-center gap-2">
          <ProgressBar value={progress} />
          <span className="w-9 text-right text-xs font-medium tabular-nums text-[var(--que-text-secondary)]">
            {progress}%
          </span>
        </div>
      </button>

      {open && (
        <div className="border-t border-[var(--que-border)] px-3 py-3">
          {isState ? (
            <StateChecklist
              checks={kr.stateChecks ?? []}
              canToggle={canToggleChecks}
              isAdmin={isAdmin}
              pending={pending}
              memberById={memberById}
              onToggle={toggleCheck}
            />
          ) : kr.metricType === "task_auto" ? (
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

/**
 * 상태형 KR(OS-1)의 체크리스트. 각 항목은 판정 기준 — Task를 자동 생성하지 않는다(Task ≠ KR).
 * 일반 항목은 소유자·admin이 토글, requiresAdminConfirm 항목은 admin만(잠금 아이콘+뱃지, 비-admin은 비활성+툴팁).
 * 완료 항목은 우측에 doneAt·확인자를 표시한다(시안 ①). 토글은 낙관 없이 서버 액션 결과로 갱신한다.
 */
function StateChecklist({
  checks,
  canToggle,
  isAdmin,
  pending,
  memberById,
  onToggle,
}: {
  checks: StateCheck[];
  canToggle: boolean;
  isAdmin: boolean;
  pending: boolean;
  memberById: Map<string, OkrMember>;
  onToggle: (checkId: string, done: boolean) => void;
}) {
  if (checks.length === 0) {
    return (
      <p className="text-sm text-[var(--que-text-tertiary)]">등록된 체크 항목이 없습니다.</p>
    );
  }
  return (
    <div className="flex flex-col gap-2">
      {checks.map((c) => (
        <StateCheckRow
          key={c.id}
          check={c}
          canToggle={canToggle}
          isAdmin={isAdmin}
          pending={pending}
          memberById={memberById}
          onToggle={onToggle}
        />
      ))}
      <p className="mt-1 rounded-md bg-[var(--que-bg-muted)] px-3 py-2 text-xs leading-relaxed text-[var(--que-text-secondary)]">
        체크 항목은 <b className="font-medium text-[var(--que-text)]">판정 기준</b>입니다 — 작업이
        자동 생성되지 않습니다. 모든 체크는 기록으로 남습니다.
      </p>
      {!canToggle ? (
        <p className="text-xs text-[var(--que-text-tertiary)]">
          체크는 핵심결과 소유자 본인 또는 관리자만 할 수 있습니다.
        </p>
      ) : null}
    </div>
  );
}

/**
 * 상태형 KR 체크 한 줄. 체크를 켜는 순간 체크마크가 살짝 바운스(scale 0→오버슈트→1 스프링),
 * 끌 때는 단순 fade. 애니메이션은 체크박스를 감싼 span의 transform/opacity만 건드리므로
 * 토글 서버 액션·낙관 없음 로직과 완전히 분리된다(체크박스는 리마운트하지 않아 포커스도 유지).
 */
function StateCheckRow({
  check: c,
  canToggle,
  isAdmin,
  pending,
  memberById,
  onToggle,
}: {
  check: StateCheck;
  canToggle: boolean;
  isAdmin: boolean;
  pending: boolean;
  memberById: Map<string, OkrMember>;
  onToggle: (checkId: string, done: boolean) => void;
}) {
  const [scope, animate] = useAnimate();
  const prevDone = useRef(c.done);

  useEffect(() => {
    if (prevDone.current === c.done) return;
    prevDone.current = c.done;
    if (!scope.current) return;
    if (c.done) {
      // 켤 때 — 0 근처에서 스프링으로 튀어 오르며 안착(살짝 오버슈트).
      animate(
        scope.current,
        { scale: [0.4, 1] },
        { type: "spring", visualDuration: 0.25, bounce: 0.5 },
      );
    } else {
      // 끌 때 — 담백하게 fade만.
      animate(scope.current, { scale: 1, opacity: [0.4, 1] }, { duration: 0.15 });
    }
  }, [c.done, animate, scope]);

  const adminLocked = c.requiresAdminConfirm && !isAdmin;
  const disabled = pending || !canToggle || adminLocked;
  const confirmerName = c.confirmedBy
    ? (memberById.get(c.confirmedBy)?.name ?? c.confirmedBy)
    : undefined;
  const checkbox = (
    <span ref={scope} className="inline-flex">
      <Checkbox
        checked={c.done}
        disabled={disabled}
        onCheckedChange={(v) => onToggle(c.id, v === true)}
        aria-label={`${c.label} ${c.done ? "체크 해제" : "체크"}`}
      />
    </span>
  );

  return (
    <div className="flex min-h-10 items-center gap-2.5 rounded-lg border border-[var(--que-border)] px-3 py-2">
      {adminLocked ? (
        <Tooltip>
          <TooltipTrigger render={<span className="inline-flex" tabIndex={0} />}>
            {checkbox}
          </TooltipTrigger>
          <TooltipContent>관리자만 확인할 수 있는 항목입니다.</TooltipContent>
        </Tooltip>
      ) : (
        checkbox
      )}
      <span
        className={cn(
          "flex-1 text-sm",
          c.done ? "text-[var(--que-text-secondary)] line-through" : "text-[var(--que-text)]",
        )}
      >
        {c.label}
      </span>
      {c.requiresAdminConfirm ? (
        <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-[var(--que-warning)]/40 px-2 py-0.5 text-[11px] font-medium text-[var(--que-warning)]">
          <Lock className="size-3" aria-hidden />
          관리자 확인
        </span>
      ) : null}
      {c.done && (c.doneAt || confirmerName) ? (
        <span className="shrink-0 text-[11px] tabular-nums text-[var(--que-text-tertiary)]">
          {c.doneAt ? format(new Date(c.doneAt), "M/d") : ""}
          {confirmerName ? ` ${confirmerName}` : ""}
        </span>
      ) : null}
    </div>
  );
}
