"use client";

import { useState } from "react";
import type { RevisionNoteStatus } from "@que/core";
import { createRevisionNoteAction } from "@/app/(app)/revisions/actions";
import { useSafeAction } from "@/components/app/use-safe-action";
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
import {
  REVISION_MENU_OPTIONS,
  REVISION_STATUSES,
  REVISION_STATUS_LABELS,
} from "./revision-meta";

const MENU_ITEMS = Object.fromEntries(REVISION_MENU_OPTIONS.map((m) => [m, m]));
const STATUS_ITEMS = Object.fromEntries(
  REVISION_STATUSES.map((s) => [s, REVISION_STATUS_LABELS[s]]),
);
const DEFAULT_MENU = REVISION_MENU_OPTIONS[0];

/** 수정사항 등록 폼 — 테스트 중 발견한 이슈를 바로 적는다. 작성자·시간은 백엔드 자동. */
export function RevisionForm() {
  const { run, pending } = useSafeAction();
  const [menu, setMenu] = useState(DEFAULT_MENU);
  const [location, setLocation] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState<RevisionNoteStatus>("unresolved");

  const canSubmit = description.trim().length > 0 && !pending;

  const submit = () => {
    run(
      () =>
        createRevisionNoteAction({
          menu,
          location: location.trim() || undefined,
          description: description.trim(),
          status,
        }),
      {
        success: "수정사항을 등록했습니다.",
        onSuccess: () => {
          setLocation("");
          setDescription("");
          setStatus("unresolved");
        },
      },
    );
  };

  return (
    <section className="flex h-fit flex-col rounded-xl border border-[var(--que-border)] bg-[var(--que-bg)]">
      <header className="border-b border-[var(--que-border)] px-4 py-3">
        <h2 className="text-base font-semibold text-[var(--que-text)]">수정사항 등록</h2>
        <p className="mt-0.5 text-xs text-[var(--que-text-tertiary)]">
          작성자와 시간은 자동으로 기록됩니다.
        </p>
      </header>
      <div className="flex flex-col gap-3 p-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field>
            <FieldLabel>메뉴</FieldLabel>
            <Select
              items={MENU_ITEMS}
              value={menu}
              onValueChange={(v) => setMenu((v as string) ?? DEFAULT_MENU)}
            >
              <SelectTrigger aria-label="메뉴 선택" className="h-10 w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {REVISION_MENU_OPTIONS.map((m) => (
                  <SelectItem key={m} value={m}>
                    {m}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field>
            <FieldLabel htmlFor="rev-location">위치 (선택)</FieldLabel>
            <Input
              id="rev-location"
              className="h-10"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="예: 상단 필터, 3번째 행, 등록 버튼"
            />
          </Field>
        </div>
        <Field>
          <FieldLabel htmlFor="rev-desc">오류사항</FieldLabel>
          <Textarea
            id="rev-desc"
            rows={3}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="어떤 문제가 있는지 적습니다."
          />
        </Field>
        <Field>
          <FieldLabel>상태</FieldLabel>
          <Select
            items={STATUS_ITEMS}
            value={status}
            onValueChange={(v) => setStatus((v as RevisionNoteStatus) ?? "unresolved")}
          >
            <SelectTrigger aria-label="상태 선택" className="h-10 w-full sm:w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {REVISION_STATUSES.map((s) => (
                <SelectItem key={s} value={s}>
                  {REVISION_STATUS_LABELS[s]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Button
          className="h-10 rounded-lg bg-[var(--que-brand)] text-[var(--que-on-brand)] hover:bg-[var(--que-brand-hover)]"
          disabled={!canSubmit}
          onClick={submit}
        >
          {pending ? "등록 중…" : "등록"}
        </Button>
      </div>
    </section>
  );
}
