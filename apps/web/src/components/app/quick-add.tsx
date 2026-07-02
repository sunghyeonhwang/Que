"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { USERS, type TaskDraft } from "@que/core";
import { createTaskAction, parseTaskAction } from "@/app/(app)/today/actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const USER_ITEMS = Object.fromEntries(USERS.map((u) => [u.id, u.name]));

function toLocalDate(iso?: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function toLocalTime(iso?: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

/** 자연어 빠른 입력 + 확인 카드 (기획: 등록 전 확인 단계를 반드시 둔다). */
export function QuickAdd({ currentUserId }: { currentUserId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [text, setText] = useState("");
  const [draft, setDraft] = useState<TaskDraft | null>(null);
  const [title, setTitle] = useState("");
  const [assigneeId, setAssigneeId] = useState("");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");

  const parse = () => {
    if (!text.trim()) return;
    startTransition(async () => {
      const result = await parseTaskAction(text);
      setDraft(result);
      setTitle(result.title);
      setAssigneeId(result.assigneeId ?? currentUserId);
      setDate(toLocalDate(result.startAt));
      setTime(toLocalTime(result.startAt));
    });
  };

  const register = () => {
    startTransition(async () => {
      let startAt: string | undefined;
      let endAt: string | undefined;
      if (date) {
        const [y, m, d] = date.split("-").map(Number);
        const [hh, mm] = (time || "09:00").split(":").map(Number);
        const start = new Date(y, m - 1, d, hh, mm);
        startAt = start.toISOString();
        endAt = new Date(start.getTime() + 60 * 60 * 1000).toISOString();
      }
      const result = await createTaskAction({ title, assigneeId, startAt, endAt });
      if (result.ok) {
        toast.success(`"${title}" 작업이 등록되어 캘린더와 담당자 오늘 화면에 표시됩니다.`);
        setDraft(null);
        setText("");
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  };

  return (
    <div className="mb-4">
      <div className="flex gap-2">
        <Input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") parse();
          }}
          placeholder='예: "내일 오후 3시에 황성현씨 상세페이지 QA 넣어줘"'
          aria-label="자연어 작업 입력"
          className="h-10 flex-1"
        />
        <Button className="h-10" disabled={pending || !text.trim()} onClick={parse}>
          {pending && !draft ? "해석 중…" : "해석"}
        </Button>
      </div>

      {draft && (
        <Card className="mt-2">
          <CardContent className="flex flex-col gap-3 pt-4">
            <p className="text-sm font-medium">이렇게 등록할까요?</p>
            {draft.questions.length > 0 && (
              <ul className="flex flex-col gap-1 text-xs text-muted-foreground">
                {draft.questions.map((question) => (
                  <li key={question}>· {question}</li>
                ))}
              </ul>
            )}
            <div className="grid gap-3 sm:grid-cols-2">
              <Field>
                <FieldLabel htmlFor="qa-title">작업명</FieldLabel>
                <Input id="qa-title" value={title} onChange={(e) => setTitle(e.target.value)} />
              </Field>
              <Field>
                <FieldLabel>담당자</FieldLabel>
                <Select
                  items={USER_ITEMS}
                  value={assigneeId}
                  onValueChange={(v) => setAssigneeId(v ?? currentUserId)}
                >
                  <SelectTrigger aria-label="담당자 선택" className="h-10">
                    <SelectValue />
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
                <FieldLabel htmlFor="qa-date">날짜</FieldLabel>
                <Input
                  id="qa-date"
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="qa-time">시작 시간</FieldLabel>
                <Input
                  id="qa-time"
                  type="time"
                  value={time}
                  onChange={(e) => setTime(e.target.value)}
                />
              </Field>
            </div>
            <div className="flex gap-2">
              <Button className="h-10" disabled={pending || !title.trim()} onClick={register}>
                등록
              </Button>
              <Button
                variant="outline"
                className="h-10"
                disabled={pending}
                onClick={() => setDraft(null)}
              >
                취소
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
