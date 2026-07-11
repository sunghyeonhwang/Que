"use client";

import { useEffect, useRef, useState } from "react";
import { Pencil, Send, Sparkles } from "lucide-react";
import { generateStandupDraftAction } from "@/app/(app)/daily/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

// 데일리 스탠드업 대화형 체크인(기획 §3-b(a)). 폼 대신 AI가 진행자가 되어 1문 1답으로 묻고,
// 답하면 다음으로 넘어간다. 서버 왕복은 시작 시 개인 초안(flash) 1회뿐 — 이후는 결정적 클라이언트
// 스크립트(LLM 프리플로우 아님)라 빠르고 비용이 0에 가깝다. 제출은 부모의 submitStandupEntryAction
// 재사용(값은 부모 state로 동기화). 접근성: 채팅 영역 aria-live polite · 버튼 40px · Enter 제출.

interface DraftValues {
  focus: string;
  note: string;
  blocker: string;
}

interface ChatMessage {
  id: number;
  role: "ai" | "user";
  text: string;
}

interface StandupChatProps {
  /** 부모 값 setter — 대화 진행에 맞춰 폼과 같은 state를 채운다(폼 전환 시 값 유지). */
  setFocus: (v: string) => void;
  setNote: (v: string) => void;
  setBlockerText: (v: string) => void;
  /** AI 초안을 그대로 채택했을 때 — 부모가 aiDrafted/draftEdited 기준선을 잡는다. */
  onDraftAdopted: (draft: DraftValues) => void;
  /** 요약 확인 카드에서 제출(부모 submit 재사용 — 값은 이미 동기화됨). */
  onSubmit: () => void;
  /** "수정" — 폼으로 전환(값 유지). */
  onSwitchToForm: () => void;
  /** 제출 진행 중(부모). */
  pending: boolean;
}

type Phase =
  | "loading"
  | "focus-suggest"
  | "focus-input"
  | "blocker-ask"
  | "blocker-input"
  | "summary";

export function StandupChat({
  setFocus,
  setNote,
  setBlockerText,
  onDraftAdopted,
  onSubmit,
  onSwitchToForm,
  pending,
}: StandupChatProps) {
  const [phase, setPhase] = useState<Phase>("loading");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [textValue, setTextValue] = useState("");
  const draft = useRef<DraftValues | null>(null);
  // 대화가 확정한 최종 값(요약 카드 표시용 — 부모 setter와 별개로 로컬에도 보관).
  const [finalFocus, setFinalFocus] = useState("");
  const [finalNote, setFinalNote] = useState("");
  const [finalBlocker, setFinalBlocker] = useState("");
  const msgId = useRef(0);
  const started = useRef(false);

  const push = (role: ChatMessage["role"], text: string) => {
    setMessages((prev) => [...prev, { id: msgId.current++, role, text }]);
  };

  // 시작 시 개인 초안(flash) 1회 호출 → 맥락+제안 focus 말풍선. 이후 서버 왕복 없음.
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    push("ai", "잠깐만요, 어제·오늘 작업을 살펴보고 있어요…");
    (async () => {
      const result = await generateStandupDraftAction();
      if (result.ok && result.focus) {
        draft.current = {
          focus: result.focus,
          note: result.note ?? "",
          blocker: result.blocker ?? "",
        };
        push(
          "ai",
          `오늘의 포커스를 이렇게 적을까요? "${result.focus}"`,
        );
        setPhase("focus-suggest");
      } else {
        push("ai", "오늘의 포커스 한마디를 적어 주세요.");
        setPhase("focus-input");
      }
    })();
  }, []);

  // focus 확정 후 막힘 질문으로.
  const askBlocker = () => {
    push("ai", "막힌 건 없나요?");
    setPhase("blocker-ask");
  };

  // ⑴ 제안 그대로 쓰기 — 초안 채택(aiDrafted).
  const adoptDraft = () => {
    const d = draft.current;
    if (!d) return;
    setFocus(d.focus);
    setNote(d.note);
    setFinalFocus(d.focus);
    setFinalNote(d.note);
    onDraftAdopted(d);
    push("user", "그대로 쓸게요");
    askBlocker();
  };

  // ⑴ 직접 입력 선택.
  const chooseManualFocus = () => {
    push("user", "직접 입력할게요");
    push("ai", "오늘의 포커스를 한마디로 적어 주세요.");
    setPhase("focus-input");
  };

  // focus 텍스트 확정.
  const confirmFocus = () => {
    const v = textValue.trim();
    if (!v) return;
    setFocus(v);
    setFinalFocus(v);
    push("user", v);
    setTextValue("");
    askBlocker();
  };

  // ⑵ 막힘 없음.
  const noBlocker = () => {
    setBlockerText("");
    setFinalBlocker("");
    push("user", "없어요");
    goSummary();
  };

  // ⑵ 막힘 있음 → 입력.
  const hasBlocker = () => {
    push("user", "있어요");
    push("ai", "무엇이 막혔는지, 무엇이 필요한지 적어 주세요.");
    setPhase("blocker-input");
  };

  // 막힘 텍스트 확정.
  const confirmBlocker = () => {
    const v = textValue.trim();
    if (!v) return;
    setBlockerText(v);
    setFinalBlocker(v);
    push("user", v);
    setTextValue("");
    goSummary();
  };

  const goSummary = () => {
    push("ai", "아래 내용으로 제출할게요. 맞으면 제출, 고칠 게 있으면 수정을 눌러 주세요.");
    setPhase("summary");
  };

  return (
    <div className="flex flex-col gap-3">
      {/* 채팅 로그 — 스크린리더가 새 말풍선을 읽도록 polite live region. */}
      <div
        aria-live="polite"
        aria-label="스탠드업 대화"
        className="flex max-h-[24rem] flex-col gap-2 overflow-y-auto rounded-lg border bg-muted/20 p-3"
      >
        {messages.map((m) =>
          m.role === "ai" ? (
            <div key={m.id} className="flex items-start gap-2">
              <span
                className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-muted"
                aria-hidden
              >
                <Sparkles className="size-3.5" />
              </span>
              <p className="max-w-[85%] rounded-lg rounded-tl-none bg-card px-3 py-2 text-sm shadow-sm">
                {m.text}
              </p>
            </div>
          ) : (
            <div key={m.id} className="flex justify-end">
              <p className="max-w-[85%] whitespace-pre-wrap rounded-lg rounded-tr-none bg-primary px-3 py-2 text-sm text-primary-foreground">
                {m.text}
              </p>
            </div>
          ),
        )}
      </div>

      {/* 단계별 응답 컨트롤 */}
      {phase === "focus-suggest" && (
        <div className="flex flex-wrap gap-2">
          <Button className="h-10" onClick={adoptDraft}>
            그대로 쓸게요
          </Button>
          <Button variant="outline" className="h-10" onClick={chooseManualFocus}>
            직접 입력
          </Button>
        </div>
      )}

      {phase === "focus-input" && (
        <div className="flex items-start gap-2">
          <Input
            className="h-10"
            value={textValue}
            autoFocus
            aria-label="오늘의 포커스"
            maxLength={200}
            placeholder="오늘의 포커스 한마디"
            onChange={(e) => setTextValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                confirmFocus();
              }
            }}
          />
          <Button
            className="h-10 shrink-0"
            onClick={confirmFocus}
            disabled={!textValue.trim()}
          >
            <Send className="size-4" aria-hidden />
            확인
          </Button>
        </div>
      )}

      {phase === "blocker-ask" && (
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" className="h-10" onClick={noBlocker}>
            없어요
          </Button>
          <Button variant="outline" className="h-10" onClick={hasBlocker}>
            있어요
          </Button>
        </div>
      )}

      {phase === "blocker-input" && (
        <div className="flex items-start gap-2">
          <Textarea
            rows={2}
            value={textValue}
            autoFocus
            aria-label="막힌 내용"
            placeholder="막힌 것이 있으면 무엇이 필요한지 적습니다."
            onChange={(e) => setTextValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                e.preventDefault();
                confirmBlocker();
              }
            }}
          />
          <Button
            className="h-10 shrink-0"
            onClick={confirmBlocker}
            disabled={!textValue.trim()}
          >
            <Send className="size-4" aria-hidden />
            확인
          </Button>
        </div>
      )}

      {phase === "summary" && (
        <div className="flex flex-col gap-3 rounded-lg border bg-card p-3">
          <div className="flex flex-col gap-2 text-sm">
            <div>
              <span className="text-xs text-muted-foreground">오늘의 포커스</span>
              <p className="font-medium">{finalFocus}</p>
            </div>
            {finalNote && (
              <div>
                <span className="text-xs text-muted-foreground">부연</span>
                <p className="whitespace-pre-wrap">{finalNote}</p>
              </div>
            )}
            <div>
              <span className="text-xs text-muted-foreground">막힘</span>
              <p className="whitespace-pre-wrap">
                {finalBlocker || "없음"}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button className="h-10" onClick={onSubmit} disabled={pending}>
              {pending ? "제출 중…" : "제출"}
            </Button>
            <Button
              variant="outline"
              className="h-10"
              onClick={onSwitchToForm}
              disabled={pending}
            >
              <Pencil className="size-4" aria-hidden />
              수정
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
