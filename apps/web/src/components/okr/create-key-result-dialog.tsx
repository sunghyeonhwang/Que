"use client";

import { useState } from "react";
import { Lock, Plus, X } from "lucide-react";
import type { KeyResultMetricType, StateCheckInput } from "@que/core";
import { createKeyResultAction } from "@/app/(app)/daily/okr-actions";
import { useSafeAction } from "@/components/app/use-safe-action";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { OkrMember } from "./okr-board";

const METRIC_ITEMS: Record<KeyResultMetricType, string> = {
  manual: "수동 지표 (직접 수치 입력)",
  task_auto: "작업 자동 (연결 작업 완료율)",
  state: "상태 체크 (체크리스트 완료율)",
};

/** 생성 폼에 노출하는 측정 방식(전 3종). state는 체크 항목 입력 UI를 함께 노출한다. */
const VISIBLE_METRIC_KEYS: KeyResultMetricType[] = ["manual", "task_auto", "state"];

/** 체크 항목 에디터의 로컬 행(제출 시 label 정리 후 StateCheckInput로 변환). */
interface CheckDraft {
  label: string;
  requiresAdminConfirm: boolean;
}

const MAX_CHECKS = 7;

/** 분기 키의 3개 월(YYYY-MM). Q1=01~03 … Q4=10~12. */
function monthsForPeriod(period: string): string[] {
  const m = /^(\d{4})-Q([1-4])$/.exec(period);
  if (!m) return [];
  const year = m[1];
  const start = (Number(m[2]) - 1) * 3 + 1;
  return [0, 1, 2].map((i) => `${year}-${String(start + i).padStart(2, "0")}`);
}

/** 핵심결과(KR) 생성 다이얼로그 — 관리자 또는 목표 소유자만 노출(서버 액션이 최종 강제). */
export function CreateKeyResultDialog({
  open,
  onOpenChange,
  objectiveId,
  objectiveTitle,
  objectivePeriod,
  members,
  currentMonth,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  objectiveId: string;
  objectiveTitle: string;
  objectivePeriod: string;
  members: OkrMember[];
  currentMonth: string;
}) {
  const { run, pending } = useSafeAction();
  const monthOptions = monthsForPeriod(objectivePeriod);
  const defaultMonth = monthOptions.includes(currentMonth) ? currentMonth : (monthOptions[0] ?? "");

  const [title, setTitle] = useState("");
  const [ownerId, setOwnerId] = useState(members[0]?.id ?? "");
  const [month, setMonth] = useState(defaultMonth);
  const [metricType, setMetricType] = useState<KeyResultMetricType>("manual");
  const [target, setTarget] = useState("");
  const [unit, setUnit] = useState("");
  const [checks, setChecks] = useState<CheckDraft[]>([
    { label: "", requiresAdminConfirm: false },
  ]);

  const titleEmpty = title.trim() === "";
  const targetNum = Number(target);
  const targetInvalid = metricType === "manual" && (target.trim() === "" || Number.isNaN(targetNum) || targetNum <= 0);
  // state KR은 라벨이 채워진 체크 항목이 1개 이상 필요하다(core refine과 동일 규칙).
  const filledChecks = checks.filter((c) => c.label.trim() !== "");
  const checksInvalid = metricType === "state" && filledChecks.length < 1;
  const canSubmit = !titleEmpty && ownerId && month && !targetInvalid && !checksInvalid && !pending;

  const reset = () => {
    setTitle("");
    setOwnerId(members[0]?.id ?? "");
    setMonth(defaultMonth);
    setMetricType("manual");
    setTarget("");
    setUnit("");
    setChecks([{ label: "", requiresAdminConfirm: false }]);
  };

  const addCheck = () =>
    setChecks((prev) =>
      prev.length >= MAX_CHECKS ? prev : [...prev, { label: "", requiresAdminConfirm: false }],
    );
  const removeCheck = (index: number) =>
    setChecks((prev) => (prev.length <= 1 ? prev : prev.filter((_, i) => i !== index)));
  const updateCheck = (index: number, patch: Partial<CheckDraft>) =>
    setChecks((prev) => prev.map((c, i) => (i === index ? { ...c, ...patch } : c)));

  const submit = () => {
    if (!canSubmit) return;
    const stateChecks: StateCheckInput[] = filledChecks.map((c) => ({
      label: c.label.trim(),
      requiresAdminConfirm: c.requiresAdminConfirm,
    }));
    run(
      () =>
        createKeyResultAction({
          objectiveId,
          title: title.trim(),
          ownerId,
          month,
          metricType,
          ...(metricType === "manual"
            ? { targetValue: targetNum, currentValue: 0, unit: unit.trim() || undefined }
            : {}),
          ...(metricType === "state" ? { stateChecks } : {}),
        }),
      {
        success: `"${title.trim()}" 핵심결과를 만들었습니다.`,
        onSuccess: () => {
          reset();
          onOpenChange(false);
        },
      },
    );
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) reset();
        onOpenChange(next);
      }}
    >
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>핵심결과(KR) 추가</DialogTitle>
          <DialogDescription>
            &lsquo;{objectiveTitle}&rsquo; 목표를 측정할 월 핵심결과를 등록합니다.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-3">
          <Field>
            <FieldLabel htmlFor="kr-title">제목</FieldLabel>
            <Input
              id="kr-title"
              className="h-10"
              placeholder="예: 7월 신규 가입 500건"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              aria-invalid={titleEmpty}
            />
            {titleEmpty ? (
              <p className="text-xs text-[var(--que-error)]">제목을 입력하세요.</p>
            ) : null}
          </Field>

          <div className="flex gap-3">
            <Field className="flex-1">
              <FieldLabel>소유자</FieldLabel>
              <Select
                items={Object.fromEntries(members.map((m) => [m.id, m.name]))}
                value={ownerId}
                onValueChange={(v) => v && setOwnerId(v)}
              >
                <SelectTrigger aria-label="소유자 선택" size="lg" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {members.map((m) => (
                    <SelectItem key={m.id} value={m.id}>
                      {m.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>

            <Field className="flex-1">
              <FieldLabel>월</FieldLabel>
              <Select
                items={Object.fromEntries(monthOptions.map((mo) => [mo, mo]))}
                value={month}
                onValueChange={(v) => v && setMonth(v)}
              >
                <SelectTrigger aria-label="월 선택" size="lg" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {monthOptions.map((mo) => (
                    <SelectItem key={mo} value={mo}>
                      {mo}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </div>

          <Field>
            <FieldLabel>측정 방식</FieldLabel>
            <Select
              items={METRIC_ITEMS}
              value={metricType}
              onValueChange={(v) => v && setMetricType(v as KeyResultMetricType)}
            >
              <SelectTrigger aria-label="측정 방식 선택" size="lg" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {VISIBLE_METRIC_KEYS.map((k) => (
                  <SelectItem key={k} value={k}>
                    {METRIC_ITEMS[k]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-[var(--que-text-tertiary)]">
              수동 지표는 사람이 현재치를 입력합니다. 작업 자동은 연결 작업의 완료율로, 상태 체크는
              체크 항목의 완료 비율로 진척이 계산됩니다.
            </p>
          </Field>

          {metricType === "state" ? (
            <Field>
              <FieldLabel>체크 항목</FieldLabel>
              <p className="text-xs text-[var(--que-text-tertiary)]">
                판정 기준을 1~7개 적습니다. 완료된 항목 비율이 진척이 됩니다. &lsquo;관리자 확인&rsquo;을
                켜면 그 항목은 관리자만 체크할 수 있습니다.
              </p>
              <div className="mt-1 flex flex-col gap-2">
                {checks.map((c, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <Input
                      className="h-10 flex-1"
                      placeholder={`체크 항목 ${i + 1} (예: 사이트 런칭 완료)`}
                      value={c.label}
                      onChange={(e) => updateCheck(i, { label: e.target.value })}
                      aria-label={`체크 항목 ${i + 1} 라벨`}
                    />
                    <label className="flex h-10 shrink-0 items-center gap-1.5 rounded-md border border-[var(--que-border)] px-2.5 text-xs text-[var(--que-text-secondary)]">
                      <Checkbox
                        checked={c.requiresAdminConfirm}
                        onCheckedChange={(v) =>
                          updateCheck(i, { requiresAdminConfirm: v === true })
                        }
                        aria-label={`체크 항목 ${i + 1} 관리자 확인 필요`}
                      />
                      <Lock className="size-3" aria-hidden />
                      관리자 확인
                    </label>
                    <Button
                      type="button"
                      variant="outline"
                      className="size-10 shrink-0"
                      disabled={checks.length <= 1}
                      onClick={() => removeCheck(i)}
                      aria-label={`체크 항목 ${i + 1} 삭제`}
                    >
                      <X className="size-4" aria-hidden />
                    </Button>
                  </div>
                ))}
              </div>
              <Button
                type="button"
                variant="outline"
                className="mt-1 h-10 gap-1.5 self-start"
                disabled={checks.length >= MAX_CHECKS}
                onClick={addCheck}
              >
                <Plus className="size-4" aria-hidden />
                체크 항목 추가
              </Button>
              {checksInvalid ? (
                <p className="text-xs text-[var(--que-error)]">
                  체크 항목을 1개 이상 입력하세요.
                </p>
              ) : null}
            </Field>
          ) : null}

          {metricType === "manual" ? (
            <div className="flex gap-3">
              <Field className="flex-1">
                <FieldLabel htmlFor="kr-target">목표치</FieldLabel>
                <Input
                  id="kr-target"
                  type="number"
                  min={0}
                  className="h-10"
                  placeholder="예: 500"
                  value={target}
                  onChange={(e) => setTarget(e.target.value)}
                  aria-invalid={targetInvalid}
                />
                {targetInvalid && target.trim() !== "" ? (
                  <p className="text-xs text-[var(--que-error)]">0보다 큰 숫자를 입력하세요.</p>
                ) : null}
              </Field>
              <Field className="flex-1">
                <FieldLabel htmlFor="kr-unit">단위 (선택)</FieldLabel>
                <Input
                  id="kr-unit"
                  className="h-10"
                  placeholder="예: 건, %, 만원"
                  value={unit}
                  onChange={(e) => setUnit(e.target.value)}
                />
              </Field>
            </div>
          ) : null}
        </div>

        <DialogFooter>
          <DialogClose render={<Button variant="outline" className="h-10" />}>취소</DialogClose>
          <Button
            className="h-10 bg-[var(--que-brand)] text-[var(--que-on-brand)] hover:bg-[var(--que-brand-hover)]"
            disabled={!canSubmit}
            onClick={submit}
          >
            {pending ? "만드는 중…" : "핵심결과 추가"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
