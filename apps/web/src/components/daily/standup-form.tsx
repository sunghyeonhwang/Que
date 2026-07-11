"use client";

import { useRef, useState, useSyncExternalStore } from "react";
import {
  CheckCircle2,
  ClipboardList,
  MessagesSquare,
  Pencil,
  Sparkles,
} from "lucide-react";
import type { TaskStatus } from "@que/core";
import { format } from "date-fns";
import {
  generateStandupDraftAction,
  submitStandupEntryAction,
} from "@/app/(app)/daily/actions";
import { useSafeAction } from "@/components/app/use-safe-action";
import { StatusBadge } from "@/components/app/status-badge";
import { StandupChat } from "@/components/daily/standup-chat";
import { Button } from "@/components/ui/button";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

const FOCUS_MAX = 200;

/** 입력 방식 선택 기억(localStorage). 기본=폼. SSR 안전하게 useSyncExternalStore로 구독. */
const MODE_KEY = "que:standup-input-mode";
const MODE_EVENT = "que:standup-input-mode-change";
type InputMode = "form" | "chat";

function readMode(): InputMode {
  if (typeof window === "undefined") return "form";
  return window.localStorage.getItem(MODE_KEY) === "chat" ? "chat" : "form";
}

function subscribeMode(onChange: () => void): () => void {
  window.addEventListener(MODE_EVENT, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(MODE_EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}

function useInputMode(): [InputMode, (next: InputMode) => void] {
  const mode = useSyncExternalStore(subscribeMode, readMode, () => "form" as InputMode);
  const switchMode = (next: InputMode) => {
    window.localStorage.setItem(MODE_KEY, next);
    window.dispatchEvent(new Event(MODE_EVENT));
  };
  return [mode, switchMode];
}

/** 막힘 후보 = 내 미완 작업 중 issue/on_hold. 서버(myStandup.blocked)에서 내려온다. */
export interface BlockerCandidate {
  id: string;
  title: string;
  status: TaskStatus;
}

/** 이미 제출한 내 체크인(직렬화 가능 부분집합). 있으면 "제출됨" 확정 표기로 접힌다. */
export interface StandupFormEntry {
  focus: string;
  note?: string;
  blockerText?: string;
  blockedTaskIds?: string[];
  aiDrafted: boolean;
  submittedAt: string;
}

interface StandupFormProps {
  blockerCandidates: BlockerCandidate[];
  myEntry?: StandupFormEntry;
}

/**
 * 데일리 스탠드업 내 체크인 폼(기획 §4 ⑴). 저장하는 것은 "사람이 쓴 말"뿐 —
 * 어제/오늘 작업은 서버가 자동으로 붙인다. AI 초안은 프리필만 하고 자동 저장하지 않는다.
 */
export function StandupForm({ blockerCandidates, myEntry }: StandupFormProps) {
  const { run, pending } = useSafeAction();
  const [drafting, setDrafting] = useState(false);
  // 제출됨 상태면 접어서 확정 표기 → "수정"으로 재오픈. 미제출이면 폼을 편다.
  const [editing, setEditing] = useState(!myEntry);
  // 입력 방식: 폼 vs 대화형 체크인. 기본=폼, 선택은 localStorage에 기억(SSR 안전).
  const [mode, switchMode] = useInputMode();

  const [focus, setFocus] = useState(myEntry?.focus ?? "");
  const [note, setNote] = useState(myEntry?.note ?? "");
  const [blockerText, setBlockerText] = useState(myEntry?.blockerText ?? "");
  const [blockedIds, setBlockedIds] = useState<string[]>(myEntry?.blockedTaskIds ?? []);
  const [focusError, setFocusError] = useState<string | null>(null);

  // AI 초안 추적: 초안으로 프리필되면 스냅샷을 잡고, 제출 시 값이 달라졌으면 draftEdited=true.
  const aiDrafted = useRef(myEntry?.aiDrafted ?? false);
  const draftSnapshot = useRef<{ focus: string; note: string; blocker: string } | null>(
    // 재제출: 기존이 AI 초안이면 현재 값을 기준선으로 잡아 편집 여부를 감지한다.
    myEntry?.aiDrafted
      ? { focus: myEntry.focus, note: myEntry.note ?? "", blocker: myEntry.blockerText ?? "" }
      : null,
  );

  const toggleBlocked = (id: string) => {
    setBlockedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  };

  const applyDraft = async () => {
    setDrafting(true);
    try {
      const result = await generateStandupDraftAction();
      if (!result.ok) {
        // 실패해도 폼은 빈 채로 정상 동작 — 조용히 알린다.
        setFocusError("AI 초안을 불러오지 못했습니다. 직접 입력해 주세요.");
        return;
      }
      const nextFocus = result.focus ?? "";
      const nextNote = result.note ?? "";
      const nextBlocker = result.blocker ?? "";
      setFocus(nextFocus);
      setNote(nextNote);
      setBlockerText(nextBlocker);
      setFocusError(null);
      aiDrafted.current = true;
      draftSnapshot.current = { focus: nextFocus, note: nextNote, blocker: nextBlocker };
    } finally {
      setDrafting(false);
    }
  };

  // 대화형 체크인이 초안을 그대로 채택했을 때 — 폼과 동일한 draftEdited 기준선을 잡는다.
  const handleDraftAdopted = (d: { focus: string; note: string; blocker: string }) => {
    aiDrafted.current = true;
    draftSnapshot.current = { focus: d.focus, note: d.note, blocker: d.blocker };
  };

  const submit = () => {
    const trimmed = focus.trim();
    if (!trimmed) {
      setFocusError("오늘의 포커스는 필수입니다.");
      return;
    }
    setFocusError(null);
    const snapshot = draftSnapshot.current;
    const draftEdited =
      aiDrafted.current && snapshot
        ? trimmed !== snapshot.focus.trim() ||
          note.trim() !== snapshot.note.trim() ||
          blockerText.trim() !== snapshot.blocker.trim()
        : undefined;

    run(
      () =>
        submitStandupEntryAction({
          focus: trimmed,
          note: note.trim() || undefined,
          blockerText: blockerText.trim() || undefined,
          blockedTaskIds: blockedIds.length > 0 ? blockedIds : undefined,
          aiDrafted: aiDrafted.current,
          draftEdited,
        }),
      {
        success: "체크인 제출 완료",
        onSuccess: () => setEditing(false),
      },
    );
  };

  // 제출됨 확정 표기(접힌 상태) — 수정 버튼으로 재오픈.
  if (!editing && myEntry) {
    return (
      <section
        aria-label="내 체크인"
        className="rounded-xl border bg-card p-4"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2">
            <CheckCircle2 className="size-5 shrink-0 text-emerald-600" aria-hidden />
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground">
                제출됨 · {format(new Date(myEntry.submittedAt), "HH:mm")}
                {myEntry.aiDrafted ? " · AI 초안" : ""}
              </p>
              <p className="truncate text-base font-semibold">{focus}</p>
            </div>
          </div>
          <Button
            variant="outline"
            className="h-10 shrink-0"
            onClick={() => setEditing(true)}
          >
            <Pencil className="size-4" aria-hidden />
            수정
          </Button>
        </div>
        {note && <p className="mt-2 text-sm text-muted-foreground">{note}</p>}
      </section>
    );
  }

  return (
    <section
      aria-label="내 체크인 입력"
      // 미제출 = 최상단 강조 카드(운영 도구 톤: 장식 없이 테두리 강조).
      className="rounded-xl border-2 border-primary/40 bg-card p-4"
    >
      {/* 입력 방식 토글: 대화로 체크인 / 폼으로 입력 (기본=폼, localStorage 기억) */}
      <div
        role="group"
        aria-label="입력 방식"
        className="mb-3 flex w-fit gap-1 rounded-lg bg-muted p-1"
      >
        <Button
          variant={mode === "chat" ? "default" : "ghost"}
          size="sm"
          className="h-10"
          aria-pressed={mode === "chat"}
          onClick={() => switchMode("chat")}
        >
          <MessagesSquare className="size-4" aria-hidden />
          대화로 체크인
        </Button>
        <Button
          variant={mode === "form" ? "default" : "ghost"}
          size="sm"
          className="h-10"
          aria-pressed={mode === "form"}
          onClick={() => switchMode("form")}
        >
          <ClipboardList className="size-4" aria-hidden />
          폼으로 입력
        </Button>
      </div>

      {mode === "chat" ? (
        <StandupChat
          setFocus={setFocus}
          setNote={setNote}
          setBlockerText={setBlockerText}
          onDraftAdopted={handleDraftAdopted}
          onSubmit={submit}
          onSwitchToForm={() => switchMode("form")}
          pending={pending}
        />
      ) : (
        <>
          <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
            <div>
              <h2 className="text-base font-semibold">내 체크인</h2>
              <p className="mt-0.5 text-xs text-muted-foreground">
                오늘의 포커스 한마디면 충분합니다 — 어제·오늘 작업은 자동으로 붙습니다.
              </p>
            </div>
            <Button
              variant="outline"
              className="h-10"
              onClick={applyDraft}
              disabled={drafting || pending}
            >
              <Sparkles className="size-4" aria-hidden />
              {drafting ? "초안 작성 중…" : "AI 초안 받기"}
            </Button>
          </div>

          <div className="flex flex-col gap-3">
        <Field data-invalid={focusError ? true : undefined}>
          <FieldLabel htmlFor="standup-focus">
            오늘의 포커스 <span className="text-destructive">*</span>
          </FieldLabel>
          <Input
            id="standup-focus"
            className="h-10"
            value={focus}
            maxLength={FOCUS_MAX}
            aria-invalid={focusError ? true : undefined}
            aria-describedby={focusError ? "standup-focus-error" : undefined}
            onChange={(e) => {
              setFocus(e.target.value);
              if (focusError) setFocusError(null);
            }}
            placeholder="오늘의 포커스 한마디"
          />
          {focusError ? (
            <p id="standup-focus-error" className="text-xs text-destructive">
              {focusError}
            </p>
          ) : (
            <p className="text-xs text-muted-foreground">
              {focus.length}/{FOCUS_MAX}
            </p>
          )}
        </Field>

        <Field>
          <FieldLabel htmlFor="standup-note">부연 (선택)</FieldLabel>
          <Textarea
            id="standup-note"
            rows={2}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="덧붙일 말이 있으면 적습니다."
          />
        </Field>

        <Field>
          <FieldLabel htmlFor="standup-blocker">막힘 (선택)</FieldLabel>
          {blockerCandidates.length > 0 && (
            <div className="flex flex-col gap-1.5">
              <p className="text-xs text-muted-foreground">
                막힌 작업을 고르면 함께 표시됩니다.
              </p>
              <div className="flex flex-wrap gap-2">
                {blockerCandidates.map((task) => {
                  const active = blockedIds.includes(task.id);
                  return (
                    <button
                      key={task.id}
                      type="button"
                      aria-pressed={active}
                      onClick={() => toggleBlocked(task.id)}
                      className={`flex min-h-10 items-center gap-2 rounded-lg border px-3 text-sm transition-colors ${
                        active
                          ? "border-destructive bg-destructive/10 text-foreground"
                          : "border-border hover:bg-muted"
                      }`}
                    >
                      <span className="max-w-[16rem] truncate">{task.title}</span>
                      <StatusBadge status={task.status} />
                    </button>
                  );
                })}
              </div>
            </div>
          )}
          <Textarea
            id="standup-blocker"
            rows={2}
            value={blockerText}
            onChange={(e) => setBlockerText(e.target.value)}
            placeholder="막힌 것이 있으면 무엇이 필요한지 적습니다."
          />
        </Field>

        <div className="flex items-center gap-2">
          <Button className="h-10" onClick={submit} disabled={pending || drafting}>
            {pending ? "제출 중…" : myEntry ? "다시 제출" : "체크인 제출"}
          </Button>
          {myEntry && (
            <Button
              variant="ghost"
              className="h-10"
              onClick={() => setEditing(false)}
              disabled={pending}
            >
              취소
            </Button>
          )}
          </div>
        </div>
        </>
      )}
    </section>
  );
}
