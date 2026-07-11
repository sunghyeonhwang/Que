"use client";

import { useState } from "react";
import { FileWarning } from "lucide-react";
import { createChangeRequestAction } from "@/app/(app)/daily/change-actions";
import { useSafeAction } from "@/components/app/use-safe-action";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
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

// OS-2b 외부 변경 접수 다이얼로그(부록 C). 접수 시 카드가 생성되고 24h SLA가 시작된다.
// 접수는 프로젝트 담당자·관리자만(서버 액션·core가 최종 강제). 이 컴포넌트는 그 대상에게만 렌더한다.

export interface ChangeRequestProjectOption {
  id: string;
  name: string;
  milestones: { id: string; title: string }[];
}

const NO_MILESTONE = "__none__";

export function CreateChangeRequestDialog({
  projects,
}: {
  projects: ChangeRequestProjectOption[];
}) {
  const { run, pending } = useSafeAction();
  const [open, setOpen] = useState(false);
  const [projectId, setProjectId] = useState(projects[0]?.id ?? "");
  const [milestoneId, setMilestoneId] = useState<string>(NO_MILESTONE);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");

  const project = projects.find((p) => p.id === projectId);
  const milestones = project?.milestones ?? [];
  const titleEmpty = title.trim() === "";
  const canSubmit = !titleEmpty && projectId && !pending;

  const reset = () => {
    setProjectId(projects[0]?.id ?? "");
    setMilestoneId(NO_MILESTONE);
    setTitle("");
    setDescription("");
  };

  const submit = () => {
    if (!canSubmit) return;
    run(
      () =>
        createChangeRequestAction({
          projectId,
          milestoneId: milestoneId === NO_MILESTONE ? undefined : milestoneId,
          title: title.trim(),
          description: description.trim() || undefined,
        }),
      {
        success: "외부 변경을 접수했습니다. 24시간 영향 분석 SLA가 시작됩니다.",
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
        if (!next) reset();
        setOpen(next);
      }}
    >
      <DialogTrigger
        render={
          <Button
            variant="outline"
            className="h-10 gap-2 border-[var(--que-error)]/40 text-[var(--que-error)] hover:bg-[var(--que-error-bg)]"
          />
        }
      >
        <FileWarning className="size-4" aria-hidden />
        외부 변경 접수
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>외부 변경 접수</DialogTitle>
          <DialogDescription>
            클라이언트·환경발 변경 요청을 접수합니다. 접수하면 24시간 영향 분석 마감이 걸리고,
            마감을 넘기면 재촉·에스컬레이션이 이어집니다.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-3">
          <Field>
            <FieldLabel>프로젝트</FieldLabel>
            <Select
              items={Object.fromEntries(projects.map((p) => [p.id, p.name]))}
              value={projectId}
              onValueChange={(v) => {
                if (!v) return;
                setProjectId(v);
                setMilestoneId(NO_MILESTONE);
              }}
            >
              <SelectTrigger aria-label="프로젝트 선택" size="lg" className="w-full">
                <SelectValue />
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

          <Field>
            <FieldLabel>마일스톤 (선택)</FieldLabel>
            <Select
              items={{
                [NO_MILESTONE]: "연결 안 함",
                ...Object.fromEntries(milestones.map((m) => [m.id, m.title])),
              }}
              value={milestoneId}
              onValueChange={(v) => v && setMilestoneId(v)}
            >
              <SelectTrigger aria-label="마일스톤 선택" size="lg" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NO_MILESTONE}>연결 안 함</SelectItem>
                {milestones.map((m) => (
                  <SelectItem key={m.id} value={m.id}>
                    {m.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>

          <Field>
            <FieldLabel htmlFor="cr-title">제목</FieldLabel>
            <Input
              id="cr-title"
              className="h-10"
              placeholder="예: 런칭 페이지 범위 변경 요청"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              aria-invalid={titleEmpty}
            />
            {titleEmpty ? (
              <p className="text-xs text-[var(--que-error)]">제목을 입력하세요.</p>
            ) : null}
          </Field>

          <Field>
            <FieldLabel htmlFor="cr-desc">설명 (선택)</FieldLabel>
            <Textarea
              id="cr-desc"
              rows={3}
              placeholder="변경 내용·배경을 간단히 적습니다."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </Field>
        </div>

        <DialogFooter>
          <DialogClose render={<Button variant="outline" className="h-10" />}>취소</DialogClose>
          <Button
            className="h-10 bg-[var(--que-brand)] text-[var(--que-on-brand)] hover:bg-[var(--que-brand-hover)]"
            disabled={!canSubmit}
            onClick={submit}
          >
            {pending ? "접수 중…" : "접수"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
