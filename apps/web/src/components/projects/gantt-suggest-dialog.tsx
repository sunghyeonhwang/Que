"use client";

import { useState, useTransition } from "react";
import { ArrowRight, Check, RefreshCw, Sparkles, X } from "lucide-react";
import {
  suggestPredecessorsAction,
  applyPredecessorSuggestionAction,
  type PredecessorSuggestion,
} from "@/app/(app)/projects/suggest-actions";
import { useSafeAction } from "@/components/app/use-safe-action";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

// AI 선행 연결 제안 다이얼로그 — 간트 뷰(단일 프로젝트) 전용, 온디맨드.
// AI는 제안만 하고 아무것도 저장하지 않는다. 연결은 사용자가 [연결]을 누른 건만
// 서버 액션(core setTaskPredecessors 경유)으로 커밋된다 — 확인 카드 규칙의 정신.

type Fetch =
  | { state: "idle" }
  | { state: "loading" }
  | { state: "error"; message: string }
  | { state: "done"; suggestions: PredecessorSuggestion[] };

export function GanttSuggestDialog({ projectId }: { projectId: string }) {
  const [open, setOpen] = useState(false);
  const [fetch, setFetch] = useState<Fetch>({ state: "idle" });
  // 건별 처리 상태 — key: "pred->task". applied=연결됨(성공), dismissed=무시(목록에서 시각적 제거).
  const [applied, setApplied] = useState<Set<string>>(new Set());
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const [applyingKey, setApplyingKey] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const { run, pending } = useSafeAction();

  const keyOf = (s: PredecessorSuggestion) => `${s.predecessorId}->${s.taskId}`;

  const load = () => {
    setFetch({ state: "loading" });
    setApplied(new Set());
    setDismissed(new Set());
    startTransition(async () => {
      try {
        const result = await suggestPredecessorsAction({ projectId });
        if (result.ok) setFetch({ state: "done", suggestions: result.suggestions });
        else setFetch({ state: "error", message: result.error });
      } catch {
        setFetch({ state: "error", message: "제안 요청이 중단되었습니다. 잠시 후 다시 시도하세요." });
      }
    });
  };

  const openAndLoad = () => {
    setOpen(true);
    load();
  };

  const apply = (s: PredecessorSuggestion) => {
    const key = keyOf(s);
    setApplyingKey(key);
    run(
      () => applyPredecessorSuggestionAction({ taskId: s.taskId, predecessorId: s.predecessorId }),
      {
        success: `'${s.predecessorTitle}' → '${s.taskTitle}' 선행을 연결했습니다`,
        onSuccess: () => setApplied((prev) => new Set(prev).add(key)),
      },
    );
  };

  const visible =
    fetch.state === "done" ? fetch.suggestions.filter((s) => !dismissed.has(keyOf(s))) : [];

  return (
    <>
      <Button variant="outline" className="h-10" onClick={openAndLoad}>
        <Sparkles className="size-4 text-[var(--que-brand)]" aria-hidden />
        AI 연결 제안
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[85vh] gap-0 overflow-y-auto sm:max-w-xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="size-4 text-[var(--que-brand)]" aria-hidden />
              AI 선행 연결 제안
            </DialogTitle>
            <DialogDescription>
              작업 제목과 날짜 흐름을 보고 빠져 있는 &ldquo;앞의 일 → 뒤의 일&rdquo; 연결을
              제안합니다. <b>[연결]을 누른 것만 적용됩니다.</b>
            </DialogDescription>
          </DialogHeader>

          <div className="mt-4 flex flex-col gap-2.5">
            {fetch.state === "loading" && (
              <p className="flex items-center gap-2 py-6 text-sm text-[var(--que-text-secondary)]">
                <RefreshCw className="size-4 animate-spin" aria-hidden />
                작업 흐름을 분석하고 있습니다… (10초 안팎)
              </p>
            )}

            {fetch.state === "error" && (
              <div className="flex flex-col gap-2 py-4">
                <p role="alert" className="text-sm text-[var(--que-error)]">
                  {fetch.message}
                </p>
                <Button variant="outline" className="h-10 w-fit" onClick={load}>
                  다시 시도
                </Button>
              </div>
            )}

            {fetch.state === "done" && visible.length === 0 && (
              <p className="py-6 text-center text-sm text-[var(--que-text-secondary)]">
                {fetch.suggestions.length === 0
                  ? "빠져 보이는 연결을 찾지 못했습니다. 이미 잘 연결돼 있거나, 날짜가 지정된 작업이 적을 수 있습니다."
                  : "남은 제안이 없습니다."}
              </p>
            )}

            {visible.map((s) => {
              const key = keyOf(s);
              const isApplied = applied.has(key);
              return (
                <div
                  key={key}
                  className="flex flex-col gap-2 rounded-xl border border-[var(--que-border)] bg-[var(--que-bg)] px-3.5 py-3"
                >
                  <p className="flex min-w-0 flex-wrap items-center gap-1.5 text-sm font-medium text-[var(--que-text)]">
                    <span className="truncate">{s.predecessorTitle}</span>
                    <ArrowRight className="size-3.5 shrink-0 text-[var(--que-text-tertiary)]" aria-hidden />
                    <span className="truncate">{s.taskTitle}</span>
                  </p>
                  <p className="text-[13px] leading-relaxed text-[var(--que-text-secondary)]">{s.reason}</p>
                  <div className="flex items-center gap-2">
                    {isApplied ? (
                      <span className="flex h-10 items-center gap-1.5 text-sm font-medium text-[var(--que-success)]">
                        <Check className="size-4" aria-hidden />
                        연결됨
                      </span>
                    ) : (
                      <>
                        <Button
                          className="h-10"
                          onClick={() => apply(s)}
                          disabled={pending && applyingKey === key}
                        >
                          {pending && applyingKey === key ? (
                            <RefreshCw className="size-4 animate-spin" aria-hidden />
                          ) : (
                            <Check className="size-4" aria-hidden />
                          )}
                          연결
                        </Button>
                        <Button
                          variant="ghost"
                          className="h-10 text-[var(--que-text-secondary)]"
                          onClick={() => setDismissed((prev) => new Set(prev).add(key))}
                        >
                          <X className="size-4" aria-hidden />
                          무시
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          <p className="mt-4 border-t border-[var(--que-border)] pt-3 text-[11px] leading-relaxed text-[var(--que-text-tertiary)]">
            AI(Google Gemini)가 이 프로젝트의 이름과 작업의 제목·날짜·상태·담당자 이름·기존 선행
            연결을 읽고 생성한 참고 제안입니다. 생성 시 해당 데이터가 외부(Google)로 전송됩니다.
            제안 자체는 아무것도 바꾸지 않으며, [연결]을 누른 건만 기록(변경 이력)과 함께 적용됩니다.
          </p>
        </DialogContent>
      </Dialog>
    </>
  );
}
