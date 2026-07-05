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
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export interface ActionRowData {
  id: string;
  title: string;
  sourceText: string;
  noteName: string;
  status: ActionItemStatus;
  assigneeId?: string;
  dueDate?: string; // YYYY-MM-DD
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

/** Action 후보 한 줄 — 담당자/마감일 지정과 생성/보류/무시 처리. */
export function ActionRow({ item }: { item: ActionRowData }) {
  const { run: runAction, pending } = useSafeAction();
  const [assigneeId, setAssigneeId] = useState(item.assigneeId ?? "");
  const [dueDate, setDueDate] = useState(item.dueDate ?? "");
  const resolved = item.status === "created" || item.status === "ignored";

  const run = (fn: Parameters<typeof runAction>[0], successMessage: string) => {
    runAction(fn, { success: successMessage });
  };

  const dirty = assigneeId !== (item.assigneeId ?? "") || dueDate !== (item.dueDate ?? "");

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
        <div className="mt-2 flex flex-wrap items-end gap-2">
          <div className="w-36">
            <Select
              items={USER_ITEMS}
              value={assigneeId}
              onValueChange={(v) => setAssigneeId(v ?? "")}
            >
              <SelectTrigger
                aria-label={`${item.title} 담당자 선택`}
                className="!h-10 w-full rounded-lg text-sm"
              >
                <SelectValue placeholder="담당자 미지정" />
              </SelectTrigger>
              <SelectContent>
                {USERS.map((user) => (
                  <SelectItem key={user.id} value={user.id}>
                    {user.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Input
            type="date"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
            aria-label={`${item.title} 마감일`}
            className="h-10 w-40 rounded-lg text-sm"
          />
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
                      dueDate: dueDate || undefined,
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
              disabled={pending || dirty}
              title={dirty ? "먼저 저장해주세요" : undefined}
              onClick={() =>
                run(
                  () => confirmActionItemAction(item.id),
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
      )}
    </div>
  );
}
