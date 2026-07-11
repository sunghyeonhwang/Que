"use client";

import { useState } from "react";
import { Send, Sparkles, X } from "lucide-react";
import {
  parseMeetingCommandAction,
  type MeetingCommandDraft,
} from "@/app/(app)/daily/actions";
import { createMilestoneAction } from "@/app/(app)/planning/actions";
import { createTaskAction } from "@/app/(app)/today/actions";
import { useSafeAction } from "@/components/app/use-safe-action";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

// 회의 진행 모드 LLM 채팅 입력 콘솔(기획 §1-f) — 신규 등록(마일스톤·작업)의 기본 인터페이스.
// 흐름: 자연어 입력 → parseMeetingCommandAction(확인 카드용 draft) → 확인 카드에서 보정 →
// [등록](기존 createMilestoneAction·createTaskAction 재사용) / [취소]. 신규 실행 경로를 만들지 않는다.

type Draft = Extract<MeetingCommandDraft, { ok: true }>;

export function MeetingCommand() {
  const { run, pending } = useSafeAction();
  const [text, setText] = useState("");
  const [parsing, setParsing] = useState(false);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [error, setError] = useState<string | null>(null);

  // 확인 카드에서 보정 가능한 값(프로젝트/담당자 선택·마감일 보완).
  const [projectId, setProjectId] = useState<string>("");
  const [assigneeId, setAssigneeId] = useState<string>("");
  const [dueAt, setDueAt] = useState<string>("");

  const parse = async () => {
    const trimmed = text.trim();
    if (!trimmed) return;
    setParsing(true);
    setError(null);
    try {
      const result = await parseMeetingCommandAction(trimmed);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setDraft(result);
      setDueAt(result.dueAt ?? "");
      if (result.intent === "create_milestone") setProjectId(result.projectId ?? "");
      if (result.intent === "create_task") setAssigneeId(result.assigneeId ?? "");
    } finally {
      setParsing(false);
    }
  };

  const reset = () => {
    setDraft(null);
    setProjectId("");
    setAssigneeId("");
    setDueAt("");
    setError(null);
  };

  const register = () => {
    if (!draft) return;
    if (draft.intent === "create_milestone") {
      if (!projectId || !dueAt) return;
      run(() => createMilestoneAction({ projectId, title: draft.title, dueAt }), {
        success: `마일스톤 "${draft.title}"을(를) 등록했습니다.`,
        onSuccess: () => {
          reset();
          setText("");
        },
      });
      return;
    }
    // create_task
    run(
      () =>
        createTaskAction({
          title: draft.title,
          assigneeId: assigneeId || draft.assigneeId,
          startAt: dueAt || undefined,
        }),
      {
        success: `작업 "${draft.title}"을(를) 등록했습니다.`,
        onSuccess: () => {
          reset();
          setText("");
        },
      },
    );
  };

  const milestoneReady =
    draft?.intent === "create_milestone" ? Boolean(projectId && dueAt) : true;

  return (
    <div className="rounded-xl border border-[var(--que-border)] bg-[var(--que-bg)] p-3">
      <div className="mb-2 flex items-center gap-2 text-sm font-medium text-[var(--que-text-secondary)]">
        <Sparkles className="size-4 text-[var(--que-brand)]" aria-hidden />
        회의 액션 콘솔 — 새 마일스톤·작업을 말로 등록합니다
      </div>

      <div className="flex items-start gap-2">
        <Input
          aria-label="회의 액션 입력"
          className="h-11"
          value={text}
          disabled={parsing || Boolean(draft)}
          placeholder="예: 에픽게임즈 8월 정산 리포트 마일스톤 8/7로"
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !draft) {
              e.preventDefault();
              parse();
            }
          }}
        />
        <Button
          className="h-11 shrink-0"
          disabled={!text.trim() || parsing || Boolean(draft)}
          onClick={parse}
        >
          <Send className="size-4" aria-hidden />
          {parsing ? "해석 중…" : "해석"}
        </Button>
      </div>

      {error && <p className="mt-2 text-sm text-[var(--que-error)]">{error}</p>}

      {draft && (
        <div className="mt-3 flex flex-col gap-3 rounded-lg border border-[var(--que-border)] bg-[var(--que-bg-muted)] p-3">
          <div className="flex items-center justify-between gap-2">
            <span className="rounded-md bg-[var(--que-brand-subtle)] px-2 py-0.5 text-xs font-semibold text-[var(--que-brand)]">
              {draft.intent === "create_milestone" ? "마일스톤 등록" : "작업 등록"}
            </span>
            <button
              type="button"
              aria-label="확인 카드 닫기"
              className="grid size-8 place-items-center rounded-md hover:bg-[var(--que-bg)]"
              onClick={reset}
            >
              <X className="size-4" aria-hidden />
            </button>
          </div>

          <dl className="grid gap-2 text-sm">
            <div className="flex gap-2">
              <dt className="w-16 shrink-0 text-[var(--que-text-tertiary)]">제목</dt>
              <dd className="font-medium text-[var(--que-text)]">{draft.title}</dd>
            </div>

            {draft.intent === "create_milestone" && (
              <div className="flex items-start gap-2">
                <dt className="w-16 shrink-0 pt-2 text-[var(--que-text-tertiary)]">프로젝트</dt>
                <dd className="min-w-0 flex-1">
                  {draft.projectCandidates ? (
                    <Select
                      items={Object.fromEntries(draft.projectCandidates.map((p) => [p.id, p.name]))}
                      value={projectId}
                      onValueChange={(v) => v && setProjectId(v)}
                    >
                      <SelectTrigger aria-label="프로젝트 선택" className="h-10 w-full">
                        <SelectValue placeholder="프로젝트를 선택하세요" />
                      </SelectTrigger>
                      <SelectContent>
                        {draft.projectCandidates.map((p) => (
                          <SelectItem key={p.id} value={p.id}>
                            {p.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <span className="font-medium text-[var(--que-text)]">{draft.projectName}</span>
                  )}
                </dd>
              </div>
            )}

            {draft.intent === "create_task" && (
              <div className="flex items-start gap-2">
                <dt className="w-16 shrink-0 pt-2 text-[var(--que-text-tertiary)]">담당</dt>
                <dd className="min-w-0 flex-1">
                  {draft.assigneeCandidates ? (
                    <Select
                      items={Object.fromEntries(draft.assigneeCandidates.map((u) => [u.id, u.name]))}
                      value={assigneeId}
                      onValueChange={(v) => v && setAssigneeId(v)}
                    >
                      <SelectTrigger aria-label="담당자 선택" className="h-10 w-full">
                        <SelectValue placeholder="담당자를 선택하세요" />
                      </SelectTrigger>
                      <SelectContent>
                        {draft.assigneeCandidates.map((u) => (
                          <SelectItem key={u.id} value={u.id}>
                            {u.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <span className="font-medium text-[var(--que-text)]">{draft.assigneeName}</span>
                  )}
                </dd>
              </div>
            )}

            <div className="flex items-center gap-2">
              <dt className="w-16 shrink-0 text-[var(--que-text-tertiary)]">
                기한{draft.intent === "create_milestone" && <span className="text-[var(--que-error)]"> *</span>}
              </dt>
              <dd className="min-w-0 flex-1">
                <Input
                  type="datetime-local"
                  aria-label="기한"
                  className="h-10 w-[13.5rem] dark:[color-scheme:dark]"
                  value={dueAt}
                  onChange={(e) => setDueAt(e.target.value)}
                />
              </dd>
            </div>
          </dl>

          {draft.questions.length > 0 && (
            <ul className="flex flex-col gap-0.5 text-xs text-[var(--que-warning)]">
              {draft.questions.map((q) => (
                <li key={q}>· {q}</li>
              ))}
            </ul>
          )}

          <div className="flex items-center gap-2">
            <Button className="h-10" disabled={pending || !milestoneReady} onClick={register}>
              {pending ? "등록 중…" : "등록"}
            </Button>
            <Button variant="ghost" className="h-10" disabled={pending} onClick={reset}>
              취소
            </Button>
            {draft.intent === "create_milestone" && !milestoneReady && (
              <span className="text-xs text-[var(--que-text-tertiary)]">
                프로젝트와 기한을 채우면 등록할 수 있습니다.
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
