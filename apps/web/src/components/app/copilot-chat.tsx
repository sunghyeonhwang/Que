"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { ArrowLeft, CornerDownLeft, Maximize2, RotateCw, Sparkles } from "lucide-react";
import {
  askCopilotAction,
  executeCopilotDraftAction,
} from "@/app/(app)/copilot-actions";
import type { CopilotDraft, CopilotDraftLabels, CopilotReply } from "@/lib/ai/copilot";
import type { CopilotSource } from "@/lib/ai/copilot-tools";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

// Que Copilot 채팅 뷰(기획 모듈 D — ⌘K 공존 설계 D-4). 커맨드 팔레트가 chat 모드일 때 본문을 이 컴포넌트로
// 교체한다. 대화 이력은 세션 로컬(저장 안 함 — 기록되는 것은 확정 실행뿐). 조회 답변은 실데이터 도구 결과로만
// 오고(환각 방어), 쓰기 intent는 확인 카드(draft) → 사람이 [실행]을 눌러야 core mutation이 돈다(via:"chat").
// 룩은 데일리 스탠드업 대화형 체크인(standup-chat.tsx)을 재사용한다: AI 좌측 Sparkles·사용자 우측 말풍선.

/** 상태 전환 라벨(client 순수 매핑 — core 미접촉). */
const STATUS_LABEL: Record<string, string> = {
  scheduled: "예정",
  in_progress: "진행중",
  done: "완료",
  needs_reschedule: "시간변경필요",
  on_hold: "홀드",
  issue: "문제발생",
};

/** ISO datetime을 사람이 읽는 표기로. 파싱 실패 시 원문 유지. */
function formatWhen(iso?: string): string {
  if (!iso) return "미정";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("ko-KR", {
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** 확인 카드 draft를 kind별 필드 요약으로 (표시용 — 실행은 draft 원본 그대로 전달). */
// 확인 카드는 사람이 "무엇을" 실행하는지 이름으로 검증하는 최종 방어다 — 서버가 해석한
// 라벨(draftLabels)을 우선 표기하고, 해석 실패 시에만 id를 노출한다(게이트 M-3).
function draftSummary(
  draft: CopilotDraft,
  labels?: CopilotDraftLabels,
): { heading: string; rows: { label: string; value: string }[] } {
  switch (draft.kind) {
    case "create_task":
      return {
        heading: "작업 생성",
        rows: [
          { label: "제목", value: draft.title },
          { label: "담당", value: labels?.assigneeName ?? (draft.assigneeId ?? "본인") },
          // 프로젝트 행은 항상 표시 — 비어 있으면 "없음"을 드러내야 사람이 카드에서 알아챈다(2026-07-12).
          { label: "프로젝트", value: draft.projectId ? (labels?.projectName ?? draft.projectId) : "없음" },
          { label: "기한", value: formatWhen(draft.endAt) },
        ],
      };
    case "create_project":
      return {
        heading: "프로젝트 생성",
        rows: [
          { label: "이름", value: draft.name },
          { label: "클라이언트", value: draft.clientId ? (labels?.projectName ?? draft.clientId) : "없음" },
          { label: "담당", value: labels?.assigneeName ?? (draft.ownerId ?? "본인") },
        ],
      };
    case "create_milestone":
      return {
        heading: "마일스톤 생성",
        rows: [
          { label: "프로젝트", value: labels?.projectName ?? draft.projectId },
          { label: "제목", value: draft.title },
          { label: "기한", value: formatWhen(draft.dueAt) },
        ],
      };
    case "change_status":
      return {
        heading: "상태 변경",
        rows: [
          { label: "작업", value: labels?.taskTitle ?? draft.taskId },
          { label: "전환", value: `→ ${STATUS_LABEL[draft.to] ?? draft.to}` },
          { label: "사유", value: draft.detail?.reason ?? "—" },
        ],
      };
    case "help_request":
      return {
        heading: "도움 요청",
        rows: [
          { label: "작업", value: labels?.taskTitle ?? draft.taskId },
          {
            label: "대상",
            value: labels?.helpUserNames?.length
              ? labels.helpUserNames.join(", ")
              : draft.helpUserIds.join(", "),
          },
          { label: "내용", value: draft.body },
        ],
      };
  }
}

type DraftState =
  | { status: "idle" }
  | { status: "executing" }
  | { status: "done" }
  | { status: "cancelled" }
  | { status: "error"; message: string };

interface ChatMessage {
  id: number;
  role: "user" | "assistant";
  text: string;
  sources?: CopilotSource[];
  /** 확인 카드들 — 나열 요청이면 여러 장(2026-07-12 복수화). */
  drafts?: CopilotDraft[];
  draftLabelsList?: CopilotDraftLabels[];
}

/** 예시 질문 칩(page 빈 화면 전용). 클릭 즉시 send로 전송된다. */
const PAGE_EXAMPLES = [
  "오늘 나 뭐 해야 해?",
  "이번 주 팀에서 막힌 것 요약해줘",
  "다가오는 마일스톤 알려줘",
  "내일 오전 10시에 작업 하나 잡아줘",
];

interface CopilotChatProps {
  /** 팔레트 열림 시 seed된 첫 질문(있으면 마운트 즉시 전송). */
  seedQuestion?: string;
  /** 출처 칩·내부 이동 — 부모(팔레트)가 닫고 router.push 한다. */
  onNavigate: (href: string) => void;
  /** "← 검색으로" · Esc — 검색 모드로 복귀. page 변형에서는 없어도 된다(optional). */
  onBackToSearch?: () => void;
  /**
   * 표시 형태.
   * - "palette"(기본): ⌘K 팔레트 안 — 고정 높이 h-[min(70vh,32rem)], "← 검색으로" 헤더·Esc 캡처.
   * - "page": /copilot 풀 페이지 — 높이는 부모가 결정(h-full), 헤더·Esc 없음, 빈 화면 시작 카드, 중앙 max-w-3xl.
   */
  variant?: "palette" | "page";
}

/**
 * Que Copilot 채팅 뷰. 세션 로컬 messages로 1턴씩 askCopilotAction을 호출하고,
 * 확인 카드(draft)는 [실행]으로 executeCopilotDraftAction을 돈다(core 거부 사유가 그대로 사용자 문구).
 * variant로 ⌘K 팔레트와 /copilot 풀 페이지를 공유한다(palette 동작은 기본값으로 회귀 없이 보존).
 */
export function CopilotChat({
  seedQuestion,
  onNavigate,
  onBackToSearch,
  variant = "palette",
}: CopilotChatProps) {
  const isPage = variant === "page";
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [pending, setPending] = useState(false);
  const [turnError, setTurnError] = useState<string | null>(null);
  const [draftStates, setDraftStates] = useState<Record<number, DraftState>>({});
  const msgId = useRef(0);
  const logRef = useRef<HTMLDivElement>(null);
  const seeded = useRef(false);

  // 새 말풍선/로딩 시 맨 아래로 스크롤.
  useEffect(() => {
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight });
  }, [messages, pending, turnError]);

  // askCopilotAction 1턴. 대화 이력(role+text)만 서버로 — draft/sources는 표시 전용.
  const runTurn = useCallback(async (history: ChatMessage[]) => {
    setPending(true);
    setTurnError(null);
    const payload = history.map((m) => ({ role: m.role, text: m.text }));
    const result = await askCopilotAction(payload);
    setPending(false);
    if (!result.ok) {
      setTurnError(result.error);
      return;
    }
    const reply: CopilotReply = result.reply;
    setMessages((prev) => [
      ...prev,
      {
        id: msgId.current++,
        role: "assistant",
        text: reply.text,
        sources: reply.sources.length > 0 ? reply.sources : undefined,
        drafts: reply.drafts,
        draftLabelsList: reply.draftLabelsList,
      },
    ]);
  }, []);

  // 사용자 발화 전송(입력창·seed 공용).
  // ⚠️ runTurn을 setMessages updater 안에서 부르면 렌더 단계에서 실행돼 "setState during render"
  // 에러가 나고 StrictMode에서 updater 재실행으로 서버 액션이 이중 호출된다 — 이벤트 핸들러의
  // messages 클로저로 다음 이력을 만들어 updater 밖에서 부른다(실측 회귀).
  const send = useCallback(
    (raw: string) => {
      const text = raw.trim();
      if (!text || pending) return;
      setInput("");
      const next = [...messages, { id: msgId.current++, role: "user" as const, text }];
      setMessages(next);
      void runTurn(next);
    },
    [messages, pending, runTurn],
  );

  // 턴 오류 재시도 — 마지막 사용자 메시지까지의 이력으로 다시 실행(중복 append 없음).
  const retry = useCallback(() => {
    if (pending) return;
    void runTurn(messages);
  }, [messages, pending, runTurn]);

  // seedQuestion 있으면 마운트 즉시 1회 전송.
  useEffect(() => {
    if (seeded.current) return;
    seeded.current = true;
    // 마운트 직후 동기 setState를 피해 마이크로태스크로 미룬다(cascading render 경고 방지).
    if (seedQuestion && seedQuestion.trim()) queueMicrotask(() => send(seedQuestion));
  }, [seedQuestion, send]);

  // 확인 카드 실행 — 성공 토스트 / 실패는 카드 아래 error 그대로(core 거부 사유 = 사용자 문구).
  const execute = useCallback(async (id: number, draft: CopilotDraft) => {
    setDraftStates((prev) => ({ ...prev, [id]: { status: "executing" } }));
    const result = await executeCopilotDraftAction(draft);
    if (result.ok) {
      setDraftStates((prev) => ({ ...prev, [id]: { status: "done" } }));
      toast.success("실행했습니다.");
    } else {
      setDraftStates((prev) => ({ ...prev, [id]: { status: "error", message: result.error } }));
    }
  }, []);

  const cancelDraft = useCallback((id: number) => {
    // 취소는 '완료'가 아니다 — 실행 안 한 카드에 완료 문구가 뜨면 신뢰 계약이 깨진다(게이트 M-1).
    setDraftStates((prev) => ({ ...prev, [id]: { status: "cancelled" } }));
  }, []);

  // 채팅 컨테이너에서 Escape를 캡처해 검색으로 복귀(다이얼로그 닫힘보다 우선 — capture + stopPropagation).
  // page 변형에는 복귀 대상이 없으므로 캡처하지 않는다(브라우저 기본 Esc 유지).
  const onContainerKeyDownCapture = useCallback(
    (e: React.KeyboardEvent) => {
      if (!onBackToSearch) return;
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        onBackToSearch();
      }
    },
    [onBackToSearch],
  );

  const empty = messages.length === 0 && !pending && !turnError;

  // 대화 본문(말풍선·출처·확인 카드·로딩·오류) — palette/page가 공유한다.
  const conversation = (
    <>
      {messages.map((m) =>
          m.role === "assistant" ? (
            <div key={m.id} className="flex items-start gap-2">
              <span
                className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-[var(--que-brand-subtle)] text-[var(--que-brand)]"
                aria-hidden
              >
                <Sparkles className="size-3.5" />
              </span>
              <div className="flex min-w-0 max-w-[85%] flex-col gap-2">
                <p className="whitespace-pre-wrap rounded-lg rounded-tl-none bg-[var(--que-bg-muted)] px-3 py-2 text-sm text-[var(--que-text)]">
                  {m.text}
                </p>

                {/* 출처 칩 — 내부 이동(ExternalLink 아님) */}
                {m.sources && m.sources.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {m.sources.map((s) => (
                      <button
                        key={s.href}
                        type="button"
                        onClick={() => onNavigate(s.href)}
                        className="inline-flex min-h-8 items-center gap-1 rounded-full border border-[var(--que-border)] bg-[var(--que-bg)] px-2.5 py-1 text-xs text-[var(--que-text-secondary)] transition-colors hover:bg-[var(--que-bg-muted)] hover:text-[var(--que-text)]"
                      >
                        <CornerDownLeft className="size-3 shrink-0 opacity-60" aria-hidden />
                        <span className="truncate">{s.label}</span>
                      </button>
                    ))}
                  </div>
                )}

                {/* 확인 카드(들) — 쓰기는 사람이 확정. 나열 요청이면 항목 수만큼. */}
                {m.drafts?.map((draft, di) => {
                  const key = m.id * 100 + di; // 메시지·카드별 상태 키(카드 ≤ 수 개 — 충돌 없음)
                  return (
                    <DraftCard
                      key={key}
                      draft={draft}
                      labels={m.draftLabelsList?.[di]}
                      state={draftStates[key] ?? { status: "idle" }}
                      onExecute={() => execute(key, draft)}
                      onCancel={() => cancelDraft(key)}
                    />
                  );
                })}
              </div>
            </div>
          ) : (
            <div key={m.id} className="flex justify-end">
              <p className="max-w-[85%] whitespace-pre-wrap rounded-lg rounded-tr-none bg-[var(--que-brand)] px-3 py-2 text-sm text-[var(--que-on-brand)]">
                {m.text}
              </p>
            </div>
          ),
        )}

        {/* 로딩 말풍선 */}
        {pending && (
          <div className="flex items-start gap-2">
            <span
              className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-[var(--que-brand-subtle)] text-[var(--que-brand)]"
              aria-hidden
            >
              <Sparkles className="size-3.5" />
            </span>
            <p className="flex items-center gap-2 rounded-lg rounded-tl-none bg-[var(--que-bg-muted)] px-3 py-2 text-sm text-[var(--que-text-secondary)]">
              <RotateCw className="size-3.5 animate-spin" aria-hidden />
              생각 중…
            </p>
          </div>
        )}

        {/* 턴 오류 — 재시도 */}
        {turnError && (
          <div className="flex items-start gap-2">
            <span
              className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-[var(--que-error-bg)] text-[var(--que-error)]"
              aria-hidden
            >
              <Sparkles className="size-3.5" />
            </span>
            <div className="flex max-w-[85%] flex-col items-start gap-2">
              <p className="rounded-lg rounded-tl-none bg-[var(--que-error-bg)] px-3 py-2 text-sm text-[var(--que-error)]">
                {turnError}
              </p>
              <Button variant="outline" className="h-10 gap-1.5" onClick={retry}>
                <RotateCw className="size-4" aria-hidden />
                다시 시도
              </Button>
            </div>
          </div>
        )}
    </>
  );

  return (
    <div
      className={cn("flex flex-col", isPage ? "h-full" : "h-[min(70vh,32rem)]")}
      onKeyDownCapture={onContainerKeyDownCapture}
    >
      {/* 상단 바 — 검색으로 복귀(palette 전용). page는 페이지 헤더가 대신한다. */}
      {!isPage && (
        <div className="flex items-center justify-between gap-2 border-b border-[var(--que-border)] px-2 py-1.5">
          <Button
            variant="ghost"
            className="h-10 gap-1.5 px-2 text-sm text-[var(--que-text-secondary)]"
            onClick={onBackToSearch}
          >
            <ArrowLeft className="size-4" aria-hidden />
            검색으로
          </Button>
          <div className="flex items-center gap-1.5 pr-1">
            {/* 전체 화면 — 팔레트 좁을 때 /copilot 풀 페이지로. 현재 대화는 이관하지 않는다(단순 이동). */}
            <Button
              variant="ghost"
              size="sm"
              aria-label="전체 화면으로 열기"
              className="h-8 gap-1 px-2 text-xs text-[var(--que-text-secondary)]"
              onClick={() => onNavigate("/copilot")}
            >
              <Maximize2 className="size-3.5" aria-hidden />
              전체 화면
            </Button>
            <span className="flex items-center gap-1.5 text-xs font-medium text-[var(--que-brand)]">
              <Sparkles className="size-3.5" aria-hidden />
              Que Copilot
              <kbd className="ml-1 rounded border border-[var(--que-border)] px-1 text-[10px] text-[var(--que-text-tertiary)]">
                Esc
              </kbd>
            </span>
          </div>
        </div>
      )}

      {/* 대화 로그 — 새 말풍선을 스크린리더가 읽도록 polite live region. 이 영역만 내부 스크롤. */}
      <div
        ref={logRef}
        aria-live="polite"
        aria-label="Que Copilot 대화"
        className={cn(
          "flex flex-1 flex-col overflow-y-auto",
          isPage ? "px-4 py-6 max-md:px-3 max-md:py-4" : "gap-3 px-3 py-3",
        )}
      >
        {isPage ? (
          <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-3">
            {empty ? (
              <PageStartScreen onPick={send} />
            ) : (
              conversation
            )}
          </div>
        ) : (
          <>
            {empty && (
              <p className="m-auto max-w-[85%] text-center text-sm text-[var(--que-text-tertiary)]">
                무엇이든 물어보세요. 오늘 할 일·막힌 작업·프로젝트 진행을 실데이터로 정리해 드립니다.
              </p>
            )}
            {conversation}
          </>
        )}
      </div>

      {/* 입력창 — 하단 고정. Enter 전송·Shift+Enter 줄바꿈 */}
      <div
        className={cn(
          "border-t border-[var(--que-border)]",
          isPage ? "px-4 py-3 max-md:px-3" : "px-3 py-2.5",
        )}
      >
        <div className={cn(isPage && "mx-auto w-full max-w-3xl")}>
          <div className="flex items-end gap-2">
            <Textarea
              rows={1}
              value={input}
              aria-label="Que Copilot에게 보낼 메시지"
              placeholder="무엇이든 물어보세요 — 예: 오늘 나 뭐 해야 해?"
              className="max-h-28 min-h-10 resize-none"
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  send(input);
                }
              }}
            />
            <Button
              className="h-10 shrink-0 gap-1.5"
              onClick={() => send(input)}
              disabled={pending || !input.trim()}
            >
              <CornerDownLeft className="size-4" aria-hidden />
              전송
            </Button>
          </div>
          <p className="mt-1.5 text-center text-[11px] text-[var(--que-text-tertiary)]">
            답변은 실제 데이터에서만 가져오며, 변경은 확인 후에만 실행됩니다.
          </p>
        </div>
      </div>
    </div>
  );
}

/** /copilot 빈 대화 시작 화면 — 중앙 타이틀 + 신뢰 문구 + 예시 질문 칩 4개(클릭=즉시 전송). */
function PageStartScreen({ onPick }: { onPick: (q: string) => void }) {
  return (
    <div className="m-auto flex max-w-xl flex-col items-center gap-5 py-10 text-center">
      <span
        className="flex size-14 items-center justify-center rounded-2xl bg-[var(--que-brand-subtle)] text-[var(--que-brand)]"
        aria-hidden
      >
        <Sparkles className="size-7" />
      </span>
      <div className="flex flex-col gap-1.5">
        <h2 className="text-xl font-semibold text-[var(--que-text)]">Que Copilot</h2>
        <p className="text-sm text-[var(--que-text-secondary)]">
          실제 데이터로 답하고, 변경은 확인 후에만 실행합니다.
        </p>
      </div>
      <div className="flex flex-wrap justify-center gap-2">
        {PAGE_EXAMPLES.map((q) => (
          <button
            key={q}
            type="button"
            onClick={() => onPick(q)}
            className="inline-flex min-h-10 items-center rounded-full border border-[var(--que-border)] bg-[var(--que-bg)] px-3.5 py-2 text-sm text-[var(--que-text-secondary)] transition-colors hover:bg-[var(--que-bg-muted)] hover:text-[var(--que-text)]"
          >
            {q}
          </button>
        ))}
      </div>
    </div>
  );
}

/** 쓰기 확인 카드. [실행]/[취소]. 실행 결과는 카드 안에서 상태로 표시. */
function DraftCard({
  draft,
  labels,
  state,
  onExecute,
  onCancel,
}: {
  draft: CopilotDraft;
  labels?: CopilotDraftLabels;
  state: DraftState;
  onExecute: () => void;
  onCancel: () => void;
}) {
  const { heading, rows } = draftSummary(draft, labels);
  const settled = state.status === "done" || state.status === "cancelled";
  const executing = state.status === "executing";

  return (
    <div className="flex flex-col gap-2.5 rounded-lg border border-[var(--que-border)] bg-[var(--que-bg)] p-3">
      <span className="flex items-center gap-1.5 text-xs font-semibold text-[var(--que-text-secondary)]">
        <Sparkles className="size-3.5 text-[var(--que-brand)]" aria-hidden />
        {heading} 확인
      </span>
      <dl className="flex flex-col gap-1 text-sm">
        {rows.map((r) => (
          <div key={r.label} className="flex gap-2">
            <dt className="w-14 shrink-0 text-xs text-[var(--que-text-tertiary)]">{r.label}</dt>
            <dd className="min-w-0 flex-1 break-words text-[var(--que-text)]">{r.value}</dd>
          </div>
        ))}
      </dl>

      {state.status === "error" && (
        <p className="rounded-md bg-[var(--que-error-bg)] px-2.5 py-1.5 text-xs text-[var(--que-error)]">
          {state.message}
        </p>
      )}

      {settled ? (
        state.status === "done" ? (
          <p className="text-xs font-medium text-[var(--que-success)]">완료했습니다.</p>
        ) : (
          <p className="text-xs font-medium text-[var(--que-text-tertiary)]">취소했습니다 — 실행하지 않았습니다.</p>
        )
      ) : (
        <div className="flex items-center gap-2">
          <Button className="h-10" onClick={onExecute} disabled={executing}>
            {executing ? (
              <>
                <RotateCw className="size-4 animate-spin" aria-hidden />
                실행 중…
              </>
            ) : (
              "실행"
            )}
          </Button>
          <Button variant="outline" className="h-10" onClick={onCancel} disabled={executing}>
            취소
          </Button>
        </div>
      )}
    </div>
  );
}
