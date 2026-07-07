"use client";

import { useState } from "react";
import { WEEKDAY_LABELS, type RecurrenceFrequency } from "@que/core";
import { createRecurringTemplateAction } from "@/app/(app)/projects/actions";
import { useRoster } from "@/components/app/roster-provider";
import { useSafeAction } from "@/components/app/use-safe-action";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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

/** 반복 업무 템플릿 등록 폼 — 매주/매월 반복되는 정기 업무를 한 번 등록하면
 *  다음 회차 Task를 자동으로 만들어준다 (기획서 "반복 업무 템플릿"). */
export function CreateTemplateForm({
  projects,
}: {
  projects: { id: string; name: string }[];
}) {
  const roster = useRoster();
  const { run, pending } = useSafeAction();
  const [title, setTitle] = useState("");
  // 기본 담당자 = 명단 첫 번째(재직자). 명단이 비면 빈 값(제출 시 core가 거부).
  const [assigneeId, setAssigneeId] = useState("");
  const effectiveAssignee = assigneeId || roster[0]?.id || "";
  const [projectId, setProjectId] = useState("");
  const [frequency, setFrequency] = useState<RecurrenceFrequency>("weekly");
  const [dayOfWeek, setDayOfWeek] = useState("1");
  const [dayOfMonth, setDayOfMonth] = useState("1");
  const [startTime, setStartTime] = useState("10:00");
  const [durationMinutes, setDurationMinutes] = useState("60");
  const [description, setDescription] = useState("");

  const canSubmit = title.trim() && startTime && !pending;

  const submit = () => {
    run(
      () =>
        createRecurringTemplateAction({
          title,
          assigneeId: effectiveAssignee,
          projectId: projectId || undefined,
          frequency,
          dayOfWeek: frequency === "weekly" ? Number(dayOfWeek) : undefined,
          dayOfMonth: frequency === "monthly" ? Number(dayOfMonth) : undefined,
          startTime,
          durationMinutes: Number(durationMinutes) || 60,
          description: description || undefined,
        }),
      {
        success: `"${title}" 반복 템플릿을 등록했습니다. 다가오는 회차부터 Task가 자동으로 생성됩니다.`,
        onSuccess: () => {
          setTitle("");
          setDescription("");
        },
      },
    );
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">반복 업무 템플릿 등록</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <Field>
          <FieldLabel htmlFor="tmpl-title">제목</FieldLabel>
          <Input
            id="tmpl-title"
            className="h-10"
            placeholder="예: 주간 스탠드업 준비"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field>
            <FieldLabel>담당자</FieldLabel>
            <Select
              items={Object.fromEntries(roster.map((u) => [u.id, u.name]))}
              value={effectiveAssignee}
              onValueChange={(v) => v && setAssigneeId(v)}
            >
              <SelectTrigger aria-label="담당자 선택" size="lg">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {roster.map((u) => (
                  <SelectItem key={u.id} value={u.id}>
                    {u.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field>
            <FieldLabel>프로젝트</FieldLabel>
            <Select
              items={Object.fromEntries(projects.map((p) => [p.id, p.name]))}
              value={projectId}
              onValueChange={(v) => setProjectId(v ?? "")}
            >
              <SelectTrigger aria-label="프로젝트 선택" size="lg">
                <SelectValue placeholder="선택 안 함" />
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
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field>
            <FieldLabel>주기</FieldLabel>
            <Select
              items={{ weekly: "매주", monthly: "매월" }}
              value={frequency}
              onValueChange={(v) => v && setFrequency(v as RecurrenceFrequency)}
            >
              <SelectTrigger aria-label="주기 선택" size="lg">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="weekly">매주</SelectItem>
                <SelectItem value="monthly">매월</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          {frequency === "weekly" ? (
            <Field>
              <FieldLabel>요일</FieldLabel>
              <Select
                items={Object.fromEntries(WEEKDAY_LABELS.map((label, i) => [String(i), `${label}요일`]))}
                value={dayOfWeek}
                onValueChange={(v) => v && setDayOfWeek(v)}
              >
                <SelectTrigger aria-label="요일 선택" size="lg">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {WEEKDAY_LABELS.map((label, i) => (
                    <SelectItem key={i} value={String(i)}>
                      {label}요일
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          ) : (
            <Field>
              <FieldLabel htmlFor="tmpl-day-of-month">매월 며칠</FieldLabel>
              <Input
                id="tmpl-day-of-month"
                type="number"
                min={1}
                max={28}
                className="h-10"
                value={dayOfMonth}
                onChange={(e) => setDayOfMonth(e.target.value)}
              />
            </Field>
          )}
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field>
            <FieldLabel htmlFor="tmpl-start-time">시작 시각</FieldLabel>
            <Input
              id="tmpl-start-time"
              type="time"
              className="h-10"
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="tmpl-duration">소요 시간(분)</FieldLabel>
            <Input
              id="tmpl-duration"
              type="number"
              min={1}
              className="h-10"
              value={durationMinutes}
              onChange={(e) => setDurationMinutes(e.target.value)}
            />
          </Field>
        </div>
        <Field>
          <FieldLabel htmlFor="tmpl-description">설명 (선택)</FieldLabel>
          <Textarea
            id="tmpl-description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
          />
        </Field>
        <Button className="h-10" disabled={!canSubmit} onClick={submit}>
          {pending ? "등록 중…" : "템플릿 등록"}
        </Button>
      </CardContent>
    </Card>
  );
}
