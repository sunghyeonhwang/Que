"use client";

import { useState } from "react";
import type { KeyResultMetricType } from "@que/core";
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
};

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

  const titleEmpty = title.trim() === "";
  const targetNum = Number(target);
  const targetInvalid = metricType === "manual" && (target.trim() === "" || Number.isNaN(targetNum) || targetNum <= 0);
  const canSubmit = !titleEmpty && ownerId && month && !targetInvalid && !pending;

  const reset = () => {
    setTitle("");
    setOwnerId(members[0]?.id ?? "");
    setMonth(defaultMonth);
    setMetricType("manual");
    setTarget("");
    setUnit("");
  };

  const submit = () => {
    if (!canSubmit) return;
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
                {(Object.keys(METRIC_ITEMS) as KeyResultMetricType[]).map((k) => (
                  <SelectItem key={k} value={k}>
                    {METRIC_ITEMS[k]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-[var(--que-text-tertiary)]">
              수동 지표는 사람이 현재치를 입력합니다. 작업 자동은 이 핵심결과에 연결된 작업의 완료율로
              진척이 자동 계산됩니다.
            </p>
          </Field>

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
