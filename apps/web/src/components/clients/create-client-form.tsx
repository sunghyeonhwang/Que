"use client";

import { useState } from "react";
import { createClientAction } from "@/app/(app)/clients/actions";
import { useSafeAction } from "@/components/app/use-safe-action";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";

/** 클라이언트(거래처) 등록 폼 — 관리자만. 폼 상태는 planning 선례(useState + useSafeAction)를 따른다. */
export function CreateClientForm() {
  const { run, pending } = useSafeAction();
  const [name, setName] = useState("");

  const trimmed = name.trim();
  const tooLong = trimmed.length > 200;
  const canSubmit = trimmed.length > 0 && !tooLong && !pending;

  const submit = () => {
    run(() => createClientAction({ name: trimmed }), {
      success: `"${trimmed}" 클라이언트를 등록했습니다.`,
      onSuccess: () => setName(""),
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">클라이언트 등록</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <Field>
          <FieldLabel htmlFor="client-name">이름</FieldLabel>
          <Input
            id="client-name"
            placeholder="예: 멘딕스"
            value={name}
            aria-invalid={tooLong}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && canSubmit) submit();
            }}
          />
          {tooLong && (
            <p className="text-xs text-[var(--que-error)]">이름은 200자 이내여야 해요.</p>
          )}
        </Field>
        <Button className="h-10" disabled={!canSubmit} onClick={submit}>
          {pending ? "등록 중…" : "클라이언트 등록"}
        </Button>
      </CardContent>
    </Card>
  );
}
