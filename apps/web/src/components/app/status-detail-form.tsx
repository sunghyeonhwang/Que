"use client";

import { useState } from "react";
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
  const [helpUserId, setHelpUserId] = useState<string>("");
  const [recheckTime, setRecheckTime] = useState("");

  const canSubmit = reason.trim().length > 0 && !pending;

  const handleSubmit = () => {
    const detail: StatusDetail = { reason: reason.trim() };
    if (nextAction.trim()) detail.nextAction = nextAction.trim();
    if (helpUserId) detail.helpUserId = helpUserId;
    if (recheckTime) {
      const [hour, minute] = recheckTime.split(":").map(Number);
      const d = new Date();
      d.setHours(hour, minute, 0, 0);
      detail.recheckAt = d.toISOString();
    }
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
      <div className="grid grid-cols-2 gap-3">
        <Field>
          <FieldLabel>도움 필요한 사람</FieldLabel>
          <Select
            items={Object.fromEntries(USERS.map((u) => [u.id, u.name]))}
            value={helpUserId}
            onValueChange={(v) => setHelpUserId(v ?? "")}
          >
            <SelectTrigger aria-label="도움 필요한 사람 선택">
              <SelectValue placeholder="선택 안 함" />
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
          <FieldLabel htmlFor="status-recheck">다시 확인할 시간</FieldLabel>
          <Input
            id="status-recheck"
            type="time"
            value={recheckTime}
            onChange={(e) => setRecheckTime(e.target.value)}
          />
        </Field>
      </div>
      <Button onClick={handleSubmit} disabled={!canSubmit} className="h-10">
        {pending ? "처리 중…" : submitLabel}
      </Button>
    </div>
  );
}
