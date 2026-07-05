"use client";

import { useState } from "react";
import { ACTION_ITEM_STATUS_LABELS, USERS, type ActionItemStatus } from "@que/core";
import { useSafeAction } from "@/components/app/use-safe-action";
import {
  confirmActionItemAction,
  setActionItemStatusAction,
  updateActionItemAction,
} from "@/app/(app)/action/actions";
import { ToneBadge, type BadgeTone } from "@/components/app/tone-badge";
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

/** 프로젝트 선택 옵션 — name은 "클라이언트 · 프로젝트" 병기 라벨(조립은 서버에서). */
export interface ActionProjectOption {
  id: string;
  name: string;
}

export interface ActionRowData {
  id: string;
  title: string;
  sourceText: string;
  noteName: string;
  status: ActionItemStatus;
  assigneeId?: string;
  projectId?: string;
  dueDate?: string; // YYYY-MM-DD
  dueTime?: string; // HH:mm
  projectName?: string;
}

/** Base UI Select가 선택값을 라벨로 표시하도록 하는 매핑 (id 노출 방지) */
const USER_ITEMS = Object.fromEntries(USERS.map((u) => [u.id, u.name]));

// 상태 색상 의미 고정: 확인 필요=violet(응답대기) · 후보=blue(정보) · 생성=green(완료) ·
// 보류=amber(대기) · 무시=red(취소).
const STATUS_TONE: Record<ActionItemStatus, BadgeTone> = {
  needs_review: "violet",
  candidate: "blue",
  created: "green",
  held: "amber",
  ignored: "red",
};

/** Action 후보 한 줄 — 담당자·프로젝트·마감일·시각 지정과 생성/보류/무시 처리. */
export function ActionRow({
  item,
  projects,
}: {
  item: ActionRowData;
  projects: ActionProjectOption[];
}) {
  const { run: runAction, pending } = useSafeAction();
  const [assigneeId, setAssigneeId] = useState(item.assigneeId ?? "");
  const [projectId, setProjectId] = useState(item.projectId ?? "");
  const [dueDate, setDueDate] = useState(item.dueDate ?? "");
  const [dueTime, setDueTime] = useState(item.dueTime ?? "");
  const [startTime, setStartTime] = useState("");
  const resolved = item.status === "created" || item.status === "ignored";

  const projectItems = Object.fromEntries(projects.map((p) => [p.id, p.name]));

  const run = (fn: Parameters<typeof runAction>[0], successMessage: string) => {
    runAction(fn, { success: successMessage });
  };

  // 저장 대상: 담당자·프로젝트·마감일·마감시각. 시작시각은 확정 전용(저장 대상 아님).
  const dirty =
    assigneeId !== (item.assigneeId ?? "") ||
    projectId !== (item.projectId ?? "") ||
    dueDate !== (item.dueDate ?? "") ||
    dueTime !== (item.dueTime ?? "");

  return (
    <div className="rounded-xl border border-[var(--que-border)] bg-[var(--que-bg)] p-3.5">
      <div className="flex flex-wrap items-center gap-2">
        <ToneBadge tone={STATUS_TONE[item.status]}>
          {ACTION_ITEM_STATUS_LABELS[item.status]}
        </ToneBadge>
        <p className="min-w-0 flex-1 truncate text-sm font-medium text-[var(--que-text)]">
          {item.title}
        </p>
      </div>
      <p className="mt-1 text-xs text-[var(--que-text-tertiary)]">
        원문: “{item.sourceText}” — {item.noteName}
        {item.projectName ? ` · ${item.projectName}` : ""}
      </p>

      {!resolved && (
        <div className="mt-2.5 flex flex-col gap-2.5">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <Field>
              <FieldLabel>담당자</FieldLabel>
              <Select
                items={USER_ITEMS}
                value={assigneeId}
                onValueChange={(v) => setAssigneeId(v ?? "")}
              >
                <SelectTrigger
                  aria-label={`${item.title} 담당자 선택`}
                  className="!h-10 w-full rounded-lg text-sm"
                >
                  <SelectValue placeholder="미지정" />
                </SelectTrigger>
                <SelectContent>
                  {USERS.map((user) => (
                    <SelectItem key={user.id} value={user.id}>
                      {user.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field>
              <FieldLabel>프로젝트</FieldLabel>
              <Select
                items={projectItems}
                value={projectId}
                onValueChange={(v) => setProjectId(v ?? "")}
                disabled={projects.length === 0}
              >
                <SelectTrigger
                  aria-label={`${item.title} 프로젝트 선택`}
                  className="!h-10 w-full rounded-lg text-sm"
                >
                  <SelectValue placeholder="미지정" />
                </SelectTrigger>
                <SelectContent>
                  {projects.map((project) => (
                    <SelectItem key={project.id} value={project.id}>
                      {project.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field>
              <FieldLabel htmlFor={`due-${item.id}`}>마감일</FieldLabel>
              <Input
                id={`due-${item.id}`}
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                aria-label={`${item.title} 마감일`}
                className="h-10 w-full rounded-lg text-sm"
              />
            </Field>
            <Field>
              <FieldLabel htmlFor={`due-time-${item.id}`}>마감 시각 (선택)</FieldLabel>
              <Input
                id={`due-time-${item.id}`}
                type="time"
                value={dueTime}
                onChange={(e) => setDueTime(e.target.value)}
                aria-label={`${item.title} 마감 시각`}
                className="h-10 w-full rounded-lg text-sm"
              />
            </Field>
          </div>

          <div className="flex flex-wrap items-end gap-2">
            <Field className="w-40">
              <FieldLabel htmlFor={`start-time-${item.id}`}>시작 시각 (선택)</FieldLabel>
              <Input
                id={`start-time-${item.id}`}
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                aria-label={`${item.title} 시작 시각`}
                className="h-10 w-full rounded-lg text-sm"
              />
            </Field>
            {dirty && (
              <Button
                variant="outline"
                size="sm"
                className="h-10 rounded-lg"
                disabled={pending}
                onClick={() =>
                  run(
                    () =>
                      updateActionItemAction({
                        actionItemId: item.id,
                        assigneeId: assigneeId || undefined,
                        projectId: projectId || undefined,
                        dueDate: dueDate || undefined,
                        dueTime: dueTime || undefined,
                      }),
                    "후보 정보를 저장했습니다.",
                  )
                }
              >
                저장
              </Button>
            )}
            <span className="ml-auto flex gap-2">
              <Button
                size="sm"
                className="h-10 rounded-lg bg-[var(--que-brand)] px-3.5 text-[var(--que-on-brand)] hover:bg-[var(--que-brand-hover)]"
                disabled={pending}
                onClick={() =>
                  run(
                    () =>
                      confirmActionItemAction(item.id, {
                        assigneeId: assigneeId || undefined,
                        projectId: projectId || undefined,
                        dueDate: dueDate || undefined,
                        dueTime: dueTime || undefined,
                        startTime: startTime || undefined,
                      }),
                    "Task가 생성되어 캘린더와 담당자 오늘 화면에 표시됩니다.",
                  )
                }
              >
                Task 생성
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-10 rounded-lg"
                disabled={pending}
                onClick={() =>
                  run(
                    () => setActionItemStatusAction({ actionItemId: item.id, to: "held" }),
                    "보류했습니다.",
                  )
                }
              >
                보류
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-10 rounded-lg border-[var(--que-error)]/40 text-[var(--que-error)] hover:bg-[var(--que-error-bg)] hover:text-[var(--que-error)]"
                disabled={pending}
                onClick={() =>
                  run(
                    () => setActionItemStatusAction({ actionItemId: item.id, to: "ignored" }),
                    "무시했습니다.",
                  )
                }
              >
                무시
              </Button>
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
