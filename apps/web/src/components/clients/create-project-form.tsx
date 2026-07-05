"use client";

import { useState } from "react";
import { createProjectAction } from "@/app/(app)/clients/actions";
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
import type { UserOption } from "@/components/clients/client-groups";

// 클라이언트 미배정(내부 잡무)을 나타내는 select 센티널 — 서버로는 clientId 미전달로 변환한다.
const NO_CLIENT = "__none__";

/** 프로젝트 등록 폼 — 관리자만. 이름 + 클라이언트(선택) + 담당자. */
export function CreateProjectForm({
  clients,
  users,
  defaultOwnerId,
}: {
  clients: { id: string; name: string }[];
  users: UserOption[];
  defaultOwnerId: string;
}) {
  const { run, pending } = useSafeAction();
  const [name, setName] = useState("");
  const [clientId, setClientId] = useState<string>(NO_CLIENT);
  const [ownerId, setOwnerId] = useState(defaultOwnerId);

  const trimmed = name.trim();
  const tooLong = trimmed.length > 200;
  const canSubmit = trimmed.length > 0 && !tooLong && !!ownerId && !pending;

  const submit = () => {
    run(
      () =>
        createProjectAction({
          name: trimmed,
          clientId: clientId === NO_CLIENT ? undefined : clientId,
          ownerId,
        }),
      {
        success: `"${trimmed}" 프로젝트를 등록했습니다.`,
        onSuccess: () => {
          setName("");
          setClientId(NO_CLIENT);
          setOwnerId(defaultOwnerId);
        },
      },
    );
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">프로젝트 등록</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <Field>
          <FieldLabel htmlFor="project-name">이름</FieldLabel>
          <Input
            id="project-name"
            placeholder="예: 여름 프로모션"
            value={name}
            aria-invalid={tooLong}
            onChange={(e) => setName(e.target.value)}
          />
          {tooLong && (
            <p className="text-xs text-[var(--que-error)]">이름은 200자 이내여야 해요.</p>
          )}
        </Field>

        <Field>
          <FieldLabel>클라이언트</FieldLabel>
          <Select value={clientId} onValueChange={(v) => v && setClientId(v)}>
            <SelectTrigger aria-label="클라이언트 선택" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NO_CLIENT}>미배정 (내부)</SelectItem>
              {clients.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>

        <Field>
          <FieldLabel>담당자</FieldLabel>
          <Select value={ownerId} onValueChange={(v) => v && setOwnerId(v)}>
            <SelectTrigger aria-label="담당자 선택" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {users.map((u) => (
                <SelectItem key={u.id} value={u.id}>
                  {u.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>

        <Button className="h-10" disabled={!canSubmit} onClick={submit}>
          {pending ? "등록 중…" : "프로젝트 등록"}
        </Button>
      </CardContent>
    </Card>
  );
}
