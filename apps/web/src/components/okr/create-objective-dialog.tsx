"use client";

import { useState } from "react";
import { createObjectiveAction } from "@/app/(app)/daily/okr-actions";
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
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { periodLabel, type OkrMember } from "./okr-board";

/** anchor 분기 기준 앞뒤 분기 옵션(이전 1 ~ 이후 3). 신규 목표는 보통 이번/다음 분기다. */
function quarterOptions(anchor: string): { value: string; label: string }[] {
  const m = /^(\d{4})-Q([1-4])$/.exec(anchor);
  const now = new Date();
  const year = m ? Number(m[1]) : now.getFullYear();
  const q = m ? Number(m[2]) : Math.floor(now.getMonth() / 3) + 1;
  const set = new Set<string>([anchor]);
  for (let delta = -1; delta <= 3; delta++) {
    const idx = q - 1 + delta;
    const y = year + Math.floor(idx / 4);
    const qq = ((idx % 4) + 4) % 4;
    set.add(`${y}-Q${qq + 1}`);
  }
  return [...set].sort((a, b) => b.localeCompare(a)).map((p) => ({ value: p, label: periodLabel(p) }));
}

/** 분기 목표(Objective) 생성 다이얼로그 — 관리자만 노출(서버 액션이 최종 강제). */
export function CreateObjectiveDialog({
  open,
  onOpenChange,
  defaultPeriod,
  members,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultPeriod: string;
  members: OkrMember[];
}) {
  const { run, pending } = useSafeAction();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [period, setPeriod] = useState(defaultPeriod);
  const [ownerId, setOwnerId] = useState(members[0]?.id ?? "");

  const options = quarterOptions(defaultPeriod);
  const titleEmpty = title.trim() === "";
  const canSubmit = !titleEmpty && period && ownerId && !pending;

  const reset = () => {
    setTitle("");
    setDescription("");
    setPeriod(defaultPeriod);
    setOwnerId(members[0]?.id ?? "");
  };

  const submit = () => {
    if (!canSubmit) return;
    run(
      () =>
        createObjectiveAction({
          title: title.trim(),
          description: description.trim() || undefined,
          period,
          ownerId,
        }),
      {
        success: `"${title.trim()}" 목표를 만들었습니다.`,
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
          <DialogTitle>분기 목표 추가</DialogTitle>
          <DialogDescription>
            분기 동안 이루고자 하는 목표를 등록합니다. 이후 이 목표 안에 월 핵심결과(KR)를 추가하세요.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-3">
          <Field>
            <FieldLabel htmlFor="obj-title">제목</FieldLabel>
            <Input
              id="obj-title"
              className="h-10"
              placeholder="예: 여름 캠페인 성공"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              aria-invalid={titleEmpty}
            />
            {titleEmpty ? (
              <p className="text-xs text-[var(--que-error)]">제목을 입력하세요.</p>
            ) : null}
          </Field>

          <Field>
            <FieldLabel htmlFor="obj-desc">설명 (선택)</FieldLabel>
            <Textarea
              id="obj-desc"
              className="min-h-20"
              placeholder="목표의 배경이나 의미를 간단히 적습니다."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </Field>

          <Field>
            <FieldLabel>분기</FieldLabel>
            <Select
              items={Object.fromEntries(options.map((o) => [o.value, o.label]))}
              value={period}
              onValueChange={(v) => v && setPeriod(v)}
            >
              <SelectTrigger aria-label="분기 선택" size="lg" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {options.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>

          <Field>
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
        </div>

        <DialogFooter>
          <DialogClose render={<Button variant="outline" className="h-10" />}>취소</DialogClose>
          <Button
            className="h-10 bg-[var(--que-brand)] text-[var(--que-on-brand)] hover:bg-[var(--que-brand-hover)]"
            disabled={!canSubmit}
            onClick={submit}
          >
            {pending ? "만드는 중…" : "목표 추가"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
