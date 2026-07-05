"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { USERS, type StatusDetail } from "@que/core";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Field, FieldLabel } from "@/components/ui/field";

const USER_BY_ID = new Map(USERS.map((u) => [u.id, u]));

/** 문제발생/홀드 전환에 필요한 추가 정보 입력. 사유는 필수, 나머지는 선택. */
export function StatusDetailForm({
  submitLabel,
  pending,
  onSubmit,
}: {
  submitLabel: string;
  pending: boolean;
  onSubmit: (detail: StatusDetail) => void;
}) {
  const [reason, setReason] = useState("");
  const [nextAction, setNextAction] = useState("");
  // 도움 필요한 사람 — 다중(최대 10). 드롭다운에서 골라 칩으로 쌓고 X로 제거한다.
  const [helpUserIds, setHelpUserIds] = useState<string[]>([]);
  const [recheckAt, setRecheckAt] = useState("");

  const canSubmit = reason.trim().length > 0 && !pending;
  const remaining = USERS.filter((u) => !helpUserIds.includes(u.id));

  const handleSubmit = () => {
    const detail: StatusDetail = { reason: reason.trim() };
    if (nextAction.trim()) detail.nextAction = nextAction.trim();
    if (helpUserIds.length > 0) detail.helpUserIds = helpUserIds;
    // 날짜+시간을 함께 받는다 — 시간만 받으면 '내일 재확인'이 오늘 과거 시각이 되는 버그.
    if (recheckAt) detail.recheckAt = new Date(recheckAt).toISOString();
    onSubmit(detail);
  };

  return (
    <div className="flex flex-col gap-3">
      <Field>
        <FieldLabel htmlFor="status-reason">사유 (필수)</FieldLabel>
        <Textarea
          id="status-reason"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="무엇 때문에 막혔는지 적어주세요"
          rows={2}
        />
      </Field>
      <Field>
        <FieldLabel htmlFor="status-next">다음 액션</FieldLabel>
        <Input
          id="status-next"
          value={nextAction}
          onChange={(e) => setNextAction(e.target.value)}
          placeholder="예: API 응답 확인 후 재개"
        />
      </Field>
      <Field>
        <FieldLabel>도움 필요한 사람</FieldLabel>
        {helpUserIds.length > 0 && (
          <div className="mb-1.5 flex flex-wrap gap-1.5">
            {helpUserIds.map((id) => {
              const user = USER_BY_ID.get(id);
              if (!user) return null;
              return (
                <span
                  key={id}
                  className="flex items-center gap-1 rounded-full bg-muted py-1 pr-1 pl-2.5 text-sm"
                >
                  {user.name}
                  <button
                    type="button"
                    aria-label={`${user.name} 제거`}
                    onClick={() => setHelpUserIds((prev) => prev.filter((x) => x !== id))}
                    className="grid size-5 place-items-center rounded-full hover:bg-border"
                  >
                    <X className="size-3.5" aria-hidden />
                  </button>
                </span>
              );
            })}
          </div>
        )}
        <Select
          items={Object.fromEntries(remaining.map((u) => [u.id, u.name]))}
          value=""
          onValueChange={(v) => {
            if (v) setHelpUserIds((prev) => (prev.length >= 10 ? prev : [...prev, v as string]));
          }}
          disabled={remaining.length === 0}
        >
          <SelectTrigger aria-label="도움 필요한 사람 추가" className="h-10 w-full">
            <SelectValue placeholder={remaining.length === 0 ? "모두 추가됨" : "선택 안 함"} />
          </SelectTrigger>
          <SelectContent>
            {remaining.map((user) => (
              <SelectItem key={user.id} value={user.id}>
                {user.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>
      <Field>
        <FieldLabel htmlFor="status-recheck">다시 확인할 시간</FieldLabel>
        <Input
          id="status-recheck"
          type="datetime-local"
          value={recheckAt}
          onChange={(e) => setRecheckAt(e.target.value)}
        />
      </Field>
      <Button onClick={handleSubmit} disabled={!canSubmit} className="h-10">
        {pending ? "처리 중…" : submitLabel}
      </Button>
    </div>
  );
}
