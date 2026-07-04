"use client";

import { useState } from "react";
import { toast } from "sonner";
import {
  CHECK_IN_RESPONSE_LABELS,
  type CheckInResponse,
  type StatusDetail,
} from "@que/core";
import { answerCheckInAction } from "@/app/(app)/today/actions";
import { Button } from "@/components/ui/button";
import { StatusDetailForm } from "./status-detail-form";
import { useSafeAction } from "./use-safe-action";

const CHOICES: CheckInResponse[] = [
  "working",
  "done",
  "needs_reschedule",
  "issue",
  "not_needed",
  "merged",
  "later",
];

/** 자동 체크인 응답 패널. 문제발생 선택 시 사유 입력 폼이 열린다. */
export function CheckInPanel({
  checkInId,
  question,
}: {
  checkInId: string;
  question: string;
}) {
  const { run, pending } = useSafeAction();
  const [issueOpen, setIssueOpen] = useState(false);

  const respond = (response: CheckInResponse, detail?: StatusDetail) => {
    run(() => answerCheckInAction({ checkInId, response, detail }), {
      success: `체크인 응답 완료: ${CHECK_IN_RESPONSE_LABELS[response]}`,
      onSuccess: () => setIssueOpen(false),
    });
  };

  const choose = (choice: CheckInResponse) => {
    if (pending) return;
    if (choice === "issue") {
      setIssueOpen((open) => !open);
    } else if (choice === "merged") {
      // 병합은 대상 작업 선택이 필요 — 타임라인의 작업 상세에서 처리하도록 안내
      toast.info("병합은 타임라인에서 작업을 열어 대상 작업을 선택해 처리해주세요.");
    } else {
      respond(choice);
    }
  };

  // 숫자키 1~7 = 응답 버튼. 패널에 포커스가 있을 때만 동작(오늘 화면에 패널이 여럿일 수 있어
  // 전역 키는 어느 패널인지 모호). 사유 입력 중(input/textarea)엔 무시한다.
  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    // 사유 폼이 열려 있으면 숫자키 무시 — 폼의 버튼/Select에 포커스가 있을 때
    // 숫자를 누르면 작성 중이던 사유가 유실되고 오응답이 나간다(입력칸 밖 포커스도 가드).
    if (issueOpen) return;
    const target = e.target as HTMLElement;
    if (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable) {
      return;
    }
    const idx = Number(e.key) - 1;
    if (!Number.isInteger(idx) || idx < 0 || idx >= CHOICES.length) return;
    e.preventDefault();
    choose(CHOICES[idx]);
  };

  return (
    <div
      className="flex flex-col gap-3 rounded-md focus-within:outline-2 focus-within:outline-offset-4 focus-within:outline-ring"
      tabIndex={0}
      onKeyDown={onKeyDown}
      aria-label="체크인 응답 (숫자키 1–7로 빠르게 응답)"
    >
      <p className="text-sm font-medium">{question}</p>
      <p className="text-xs text-muted-foreground">
        응답하면 팀 현황판과 프로젝트 화면에 즉시 반영됩니다. 숫자키 1–7로도 응답할 수 있어요.
      </p>
      <div className="flex flex-wrap gap-2" role="group" aria-label="체크인 응답 선택">
        {CHOICES.map((choice, i) => (
          <Button
            key={choice}
            variant={choice === "issue" ? "destructive" : "outline"}
            size="sm"
            className="h-10 gap-1.5"
            disabled={pending}
            onClick={() => choose(choice)}
          >
            <span
              aria-hidden
              className="grid size-4 place-items-center rounded bg-black/5 text-[10px] font-semibold tabular-nums text-muted-foreground dark:bg-white/10"
            >
              {i + 1}
            </span>
            {CHECK_IN_RESPONSE_LABELS[choice]}
          </Button>
        ))}
      </div>
      {issueOpen && (
        <div className="rounded-md border p-3">
          <StatusDetailForm
            submitLabel="문제발생으로 응답"
            pending={pending}
            onSubmit={(detail) => respond("issue", detail)}
          />
        </div>
      )}
    </div>
  );
}
