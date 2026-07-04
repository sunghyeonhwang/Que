"use client";

import { useState } from "react";
import { createMilestoneAction } from "@/app/(app)/planning/actions";
import { useSafeAction } from "@/components/app/use-safe-action";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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

  const canSubmit = projectId && title.trim() && dueAt && !pending;

  const submit = () => {
    run(
      () =>
        createMilestoneAction({
          projectId,
          title,
          dueAt: new Date(dueAt).toISOString(),
        }),
      {
        success: `"${title}" 마일스톤을 등록했습니다.`,
        onSuccess: () => {
          setTitle("");
          setDueAt("");
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
            <SelectTrigger aria-label="프로젝트 선택">
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
            placeholder="예: 결제 QA 완료"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="ms-due">기한</FieldLabel>
          <Input
            id="ms-due"
            type="datetime-local"
            value={dueAt}
            onChange={(e) => setDueAt(e.target.value)}
          />
        </Field>
        <Button className="h-10" disabled={!canSubmit} onClick={submit}>
          {pending ? "등록 중…" : "마일스톤 등록"}
        </Button>
      </CardContent>
    </Card>
  );
}
