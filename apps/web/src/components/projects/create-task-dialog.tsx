"use client";

import { useMemo, useState } from "react";
import { Plus } from "lucide-react";
import type { ProjectMeta, PmPriority } from "@/lib/pm-data";
import { createTaskAction } from "@/app/(app)/projects/pm-actions";
import { useSafeAction } from "@/components/app/use-safe-action";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
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

const PRIORITY_ITEMS: Record<PmPriority, string> = {
  high: "높음",
  normal: "보통",
  low: "낮음",
};
const PRIORITY_ORDER: PmPriority[] = ["high", "normal", "low"];

/**
 * 태스크 생성 Dialog. 이름(필수)·설명·그룹·우선순위·마감일·담당자를 받아 createTaskAction 호출.
 * 성공 시 토스트 + 닫기 + 초기화. 그룹 목록은 meta에서 온다(하드코딩 없음).
 */
export function CreateTaskDialog({ meta }: { meta: ProjectMeta }) {
  const { run, pending } = useSafeAction();
  const [open, setOpen] = useState(false);

  const defaultGroupId = meta.groups[0]?.id ?? "";
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [groupId, setGroupId] = useState(defaultGroupId);
  const [priority, setPriority] = useState<PmPriority>("normal");
  const [dueAt, setDueAt] = useState("");
  const [assigneeIds, setAssigneeIds] = useState<string[]>([]);

  const groupItems = useMemo(
    () => Object.fromEntries(meta.groups.map((g) => [g.id, g.name])),
    [meta.groups],
  );

  const nameError = name.length > 0 && !name.trim() ? "작업 이름을 입력하세요." : null;
  const canSubmit = name.trim().length > 0 && groupId.length > 0 && !pending;

  const reset = () => {
    setName("");
    setDescription("");
    setGroupId(defaultGroupId);
    setPriority("normal");
    setDueAt("");
    setAssigneeIds([]);
  };

  const toggleAssignee = (id: string) => {
    setAssigneeIds((prev) =>
      prev.includes(id) ? prev.filter((v) => v !== id) : [...prev, id],
    );
  };

  const submit = () => {
    if (!canSubmit) return;
    run(
      () =>
        createTaskAction({
          groupId,
          name: name.trim(),
          description: description.trim() || undefined,
          dueAt: dueAt || null,
          priority,
          assigneeIds,
        }),
      {
        success: `"${name.trim()}" 작업을 추가했습니다.`,
        onSuccess: () => {
          reset();
          setOpen(false);
        },
      },
    );
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) reset();
      }}
    >
      <DialogTrigger
        render={
          <Button className="h-10 gap-1.5 rounded-lg bg-[var(--que-brand)] px-3.5 text-[var(--que-on-brand)] hover:bg-[var(--que-brand-hover)]" />
        }
      >
        <Plus className="size-4" aria-hidden />
        새로 추가
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>새 작업</DialogTitle>
          <DialogDescription>작업 정보를 입력해 그룹에 추가합니다.</DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-3">
          <Field>
            <FieldLabel htmlFor="ct-name">작업 이름</FieldLabel>
            <Input
              id="ct-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") submit();
              }}
              placeholder="예: 상세페이지 QA"
              className="h-10"
              aria-invalid={nameError ? true : undefined}
              autoFocus
            />
            {nameError && <p className="text-sm text-destructive">{nameError}</p>}
          </Field>

          <Field>
            <FieldLabel htmlFor="ct-desc">설명</FieldLabel>
            <Textarea
              id="ct-desc"
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="선택 사항"
            />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field>
              <FieldLabel>그룹</FieldLabel>
              <Select
                items={groupItems}
                value={groupId}
                onValueChange={(v) => setGroupId((v as string) ?? defaultGroupId)}
              >
                <SelectTrigger aria-label="그룹 선택" className="h-10 min-h-10 w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {meta.groups.map((g) => (
                    <SelectItem key={g.id} value={g.id}>
                      <span
                        className="size-2.5 rounded-full"
                        style={{ backgroundColor: g.color }}
                        aria-hidden
                      />
                      {g.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>

            <Field>
              <FieldLabel>우선순위</FieldLabel>
              <Select
                items={PRIORITY_ITEMS}
                value={priority}
                onValueChange={(v) => setPriority(((v as PmPriority) ?? "normal"))}
              >
                <SelectTrigger aria-label="우선순위 선택" className="h-10 min-h-10 w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PRIORITY_ORDER.map((p) => (
                    <SelectItem key={p} value={p}>
                      {PRIORITY_ITEMS[p]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </div>

          <Field>
            <FieldLabel htmlFor="ct-due">마감일</FieldLabel>
            <Input
              id="ct-due"
              type="date"
              value={dueAt}
              onChange={(e) => setDueAt(e.target.value)}
              className="h-10"
            />
          </Field>

          <Field>
            <FieldLabel>담당자</FieldLabel>
            <div className="max-h-40 overflow-y-auto rounded-lg border border-[var(--que-border)] p-1">
              {meta.members.map((m) => (
                <label
                  key={m.id}
                  className="flex min-h-10 cursor-pointer items-center gap-2.5 rounded-md px-1.5 text-sm text-[var(--que-text)] hover:bg-[var(--que-bg-muted)]"
                >
                  <Checkbox
                    checked={assigneeIds.includes(m.id)}
                    onCheckedChange={() => toggleAssignee(m.id)}
                  />
                  <span
                    className="flex size-6 items-center justify-center rounded-full text-[11px] font-semibold text-white"
                    style={{ backgroundColor: m.avatarColor }}
                    aria-hidden
                  >
                    {m.name.slice(1)}
                  </span>
                  <span className="truncate">{m.name}</span>
                </label>
              ))}
            </div>
          </Field>
        </div>

        <DialogFooter>
          <Button variant="outline" className="h-10" onClick={() => setOpen(false)}>
            취소
          </Button>
          <Button
            className="h-10 bg-[var(--que-brand)] text-[var(--que-on-brand)] hover:bg-[var(--que-brand-hover)]"
            disabled={!canSubmit}
            onClick={submit}
          >
            {pending ? "추가 중…" : "추가"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
