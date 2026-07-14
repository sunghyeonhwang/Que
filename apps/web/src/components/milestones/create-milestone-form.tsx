"use client";

import { useState } from "react";
import { createMilestoneAction } from "@/app/(app)/planning/actions";
import { useSafeAction } from "@/components/app/use-safe-action";
import {
  DuePicker,
  joinDateTimeLocal,
  splitDateTimeLocal,
} from "@/components/app/due-picker";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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

/** 마일스톤 등록 폼 — 프로젝트 담당자·관리자만 자기 프로젝트에 마일스톤을 만든다. */
export function CreateMilestoneForm({
  projects,
}: {
  projects: { id: string; name: string }[];
}) {
  const { run, pending } = useSafeAction();
  const [projectId, setProjectId] = useState(projects[0]?.id ?? "");
  const [title, setTitle] = useState("");
  const [dueAt, setDueAt] = useState("");
  const [critical, setCritical] = useState(false);

  const canSubmit = projectId && title.trim() && dueAt && !pending;

  const submit = () => {
    run(
      () =>
        createMilestoneAction({
          projectId,
          title,
          dueAt: new Date(dueAt).toISOString(),
          critical,
        }),
      {
        success: `"${title}" 마일스톤을 등록했습니다.`,
        onSuccess: () => {
          setTitle("");
          setDueAt("");
          setCritical(false);
        },
      },
    );
  };

  if (projects.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">마일스톤 등록</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            마일스톤을 만들 수 있는 프로젝트가 없어요. 프로젝트 담당자나 관리자만 등록할 수 있어요.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">마일스톤 등록</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <Field>
          <FieldLabel>프로젝트</FieldLabel>
          <Select
            items={Object.fromEntries(projects.map((p) => [p.id, p.name]))}
            value={projectId}
            onValueChange={(v) => v && setProjectId(v)}
          >
            <SelectTrigger aria-label="프로젝트 선택" size="lg">
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
          <FieldLabel htmlFor="ms-title">제목</FieldLabel>
          <Input
            id="ms-title"
            className="h-10"
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
        {/* 중요 마일스톤 — 최종 런칭일 등. 켜면 전 화면 칩이 붉은 그라데이션으로 표기된다. */}
        <label className="flex w-fit cursor-pointer items-center gap-2 text-sm text-[var(--que-text-secondary)]">
          <Checkbox
            checked={critical}
            onCheckedChange={(v) => setCritical(v === true)}
            aria-label="중요 마일스톤"
          />
          중요 마일스톤 (붉은 표시 — 최종 런칭일 등)
        </label>
        <Button
          className="h-10 bg-[var(--que-brand)] text-[var(--que-on-brand)] hover:bg-[var(--que-brand-hover)]"
          disabled={!canSubmit}
          onClick={submit}
        >
          {pending ? "등록 중…" : "마일스톤 등록"}
        </Button>
      </CardContent>
    </Card>
  );
}
