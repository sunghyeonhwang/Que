"use client";

import { useMemo, useState } from "react";
import { Plus } from "lucide-react";
import type { ProjectMeta, TaskPriority } from "@/lib/projects-data";
import { dueDateToIso } from "@/lib/pm-columns";
import { createTaskAction } from "@/app/(app)/projects/pm-actions";
import { useSafeAction } from "@/components/app/use-safe-action";
import { Button } from "@/components/ui/button";
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

const PRIORITY_ITEMS: Record<TaskPriority, string> = {
  high: "높음",
  normal: "보통",
  low: "낮음",
};
const PRIORITY_ORDER: TaskPriority[] = ["high", "normal", "low"];

const UNASSIGNED = "__unassigned__";

/**
 * 태스크 생성 Dialog. 이름(필수)·설명·우선순위·마감일·담당자를 받아 createTaskAction 호출.
 * 새 카드는 항상 예정(scheduled)으로 생성된다. 담당자 미지정 시 core가 본인으로 배정.
 */
export function CreateTaskDialog({ projectId, meta }: { projectId: string; meta: ProjectMeta }) {
  const { run, pending } = useSafeAction();
  const [open, setOpen] = useState(false);

  const [title, setTitle] = useState("");
  // blur 또는 제출 시도 후에만 필수 에러를 노출한다(입력 전 침묵).
  const [titleTouched, setTitleTouched] = useState(false);
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<TaskPriority>("normal");
  const [dueDate, setDueDate] = useState("");
  const [assigneeId, setAssigneeId] = useState<string>(UNASSIGNED);

  const assigneeItems = useMemo(
    () => ({
      [UNASSIGNED]: "나에게 배정",
      ...Object.fromEntries(meta.members.map((m) => [m.id, m.name])),
    }),
    [meta.members],
  );

  // 빈 값(한 번도 입력 안 함)과 공백만 입력한 경우를 하나로 통합해 같은 에러를 낸다.
  const titleError =
    titleTouched && title.trim().length === 0 ? "작업 이름을 입력하세요." : null;
  const canSubmit = title.trim().length > 0 && !pending;

  const reset = () => {
    setTitle("");
    setTitleTouched(false);
    setDescription("");
    setPriority("normal");
    setDueDate("");
    setAssigneeId(UNASSIGNED);
  };

  const submit = () => {
    setTitleTouched(true);
    if (!canSubmit) return;
    run(
      () =>
        createTaskAction({
          projectId,
          title: title.trim(),
          description: description.trim() || undefined,
          endAt: dueDateToIso(dueDate) ?? undefined,
          priority,
          assigneeId: assigneeId === UNASSIGNED ? undefined : assigneeId,
        }),
      {
        success: `"${title.trim()}" 작업을 추가했습니다.`,
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
          <DialogDescription>작업 정보를 입력해 예정 열에 추가합니다.</DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-3">
          <Field>
            <FieldLabel htmlFor="ct-title">
              작업 이름
              <span className="ml-0.5 text-[var(--que-error)]" aria-hidden>
                *
              </span>
              <span className="sr-only">(필수)</span>
            </FieldLabel>
            <Input
              id="ct-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onBlur={() => setTitleTouched(true)}
              onKeyDown={(e) => {
                if (e.key === "Enter") submit();
              }}
              placeholder="예: 상세페이지 QA"
              className="h-10"
              required
              aria-required
              aria-invalid={titleError ? true : undefined}
              autoFocus
            />
            {titleError && <p className="text-sm text-destructive">{titleError}</p>}
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
              <FieldLabel>우선순위</FieldLabel>
              <Select
                items={PRIORITY_ITEMS}
                value={priority}
                onValueChange={(v) => setPriority((v as TaskPriority) ?? "normal")}
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

            <Field>
              <FieldLabel htmlFor="ct-due">마감일</FieldLabel>
              <Input
                id="ct-due"
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="h-10"
              />
            </Field>
          </div>

          <Field>
            <FieldLabel>담당자</FieldLabel>
            <Select
              items={assigneeItems}
              value={assigneeId}
              onValueChange={(v) => setAssigneeId((v as string) ?? UNASSIGNED)}
            >
              <SelectTrigger aria-label="담당자 선택" className="h-10 min-h-10 w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={UNASSIGNED}>나에게 배정</SelectItem>
                {meta.members.map((m) => (
                  <SelectItem key={m.id} value={m.id}>
                    <span
                      className="flex size-5 items-center justify-center rounded-full text-[10px] font-semibold text-white"
                      style={{ backgroundColor: m.avatarColor }}
                      aria-hidden
                    >
                      {m.name.slice(1)}
                    </span>
                    {m.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
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
