"use client";

import { useState } from "react";
import { Flag } from "lucide-react";
import { createMilestoneAction } from "@/app/(app)/planning/actions";
import { useSafeAction } from "@/components/app/use-safe-action";
import {
  DuePicker,
  joinDateTimeLocal,
  splitDateTimeLocal,
} from "@/components/app/due-picker";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

// /projects 툴바용 마일스톤 추가 다이얼로그 — /planning의 CreateMilestoneForm과 **같은 server
// action(createMilestoneAction)**을 재사용한다(중복 mutation 금지). 권한(담당자·관리자)은 core가 강제.
// 성공 시 useSafeAction의 router.refresh로 현재 /projects(간트·캘린더 마일스톤 레인)가 갱신된다.
export function AddMilestoneDialog({
  projects,
  lockedProjectId,
}: {
  projects: { id: string; name: string }[];
  /** 특정 프로젝트 선택 중이면 그 id로 고정(프로젝트 선택 숨김). 전체 보기면 undefined → 선택 노출. */
  lockedProjectId?: string;
}) {
  const { run, pending } = useSafeAction();
  const [open, setOpen] = useState(false);
  const [projectId, setProjectId] = useState(
    lockedProjectId ?? projects[0]?.id ?? "",
  );
  const [title, setTitle] = useState("");
  const [dueAt, setDueAt] = useState("");
  const [critical, setCritical] = useState(false);

  const effectiveProjectId = lockedProjectId ?? projectId;
  const lockedName = lockedProjectId
    ? projects.find((p) => p.id === lockedProjectId)?.name
    : undefined;
  const canSubmit = Boolean(effectiveProjectId && title.trim() && dueAt) && !pending;

  const reset = () => {
    setTitle("");
    setDueAt("");
    setCritical(false);
  };

  const submit = () => {
    run(
      () =>
        createMilestoneAction({
          projectId: effectiveProjectId,
          title,
          dueAt: new Date(dueAt).toISOString(),
          critical,
        }),
      {
        success: `"${title}" 마일스톤을 등록했습니다.`,
        onSuccess: () => {
          reset();
          setOpen(false);
        },
      },
    );
  };

  return (
    <>
      <Button
        type="button"
        variant="outline"
        className="h-10 gap-1.5 rounded-lg text-xs"
        disabled={projects.length === 0}
        onClick={() => setOpen(true)}
      >
        <Flag className="size-4" aria-hidden />
        마일스톤 추가
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>마일스톤 추가</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-3">
            {lockedProjectId ? (
              <Field>
                <FieldLabel>프로젝트</FieldLabel>
                <p className="flex h-10 items-center rounded-lg border border-[var(--que-border)] bg-[var(--que-bg-muted)] px-3 text-sm text-[var(--que-text)]">
                  {lockedName ?? "현재 프로젝트"}
                </p>
              </Field>
            ) : (
              <Field>
                <FieldLabel>프로젝트</FieldLabel>
                <Select
                  items={Object.fromEntries(projects.map((p) => [p.id, p.name]))}
                  value={projectId}
                  onValueChange={(v) => v && setProjectId(v)}
                >
                  <SelectTrigger aria-label="프로젝트 선택" className="!h-10 w-full rounded-lg text-sm">
                    <SelectValue placeholder="프로젝트 선택" />
                  </SelectTrigger>
                  <SelectContent>
                    {projects.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            )}
            <Field>
              <FieldLabel htmlFor="add-ms-title">제목</FieldLabel>
              <Input
                id="add-ms-title"
                className="h-10 rounded-lg"
                placeholder="예: 결제 QA 완료"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </Field>
            <Field>
              <FieldLabel>기한</FieldLabel>
              <DuePicker
                dueDate={splitDateTimeLocal(dueAt).date}
                dueTime={splitDateTimeLocal(dueAt).time}
                timeMin="08:00"
                timeMax="20:00"
                emptyLabel="기한 미정"
                onSelectDate={(d) =>
                  setDueAt(joinDateTimeLocal(d, splitDateTimeLocal(dueAt).time, "17:00"))
                }
                onSelectDueTime={(t) =>
                  setDueAt(joinDateTimeLocal(splitDateTimeLocal(dueAt).date, t, "17:00"))
                }
                onClear={() => setDueAt("")}
                triggerAriaLabel="마일스톤 기한 설정"
              />
            </Field>
            <label className="flex w-fit cursor-pointer items-center gap-2 text-sm text-[var(--que-text-secondary)]">
              <Checkbox
                checked={critical}
                onCheckedChange={(v) => setCritical(v === true)}
                aria-label="중요 마일스톤"
              />
              중요 마일스톤 (붉은 표시 — 최종 런칭일 등)
            </label>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              className="h-10 rounded-lg"
              disabled={pending}
              onClick={() => setOpen(false)}
            >
              취소
            </Button>
            <Button
              className="h-10 rounded-lg bg-[var(--que-brand)] text-[var(--que-on-brand)] hover:bg-[var(--que-brand-hover)]"
              disabled={!canSubmit}
              onClick={submit}
            >
              {pending ? "등록 중…" : "마일스톤 등록"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
