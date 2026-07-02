"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  CHECK_IN_RESPONSE_LABELS,
  type CheckInResponse,
  type StatusDetail,
} from "@que/core";
import { answerCheckInAction } from "@/app/(app)/today/actions";
import { Button } from "@/components/ui/button";
import { StatusDetailForm } from "./status-detail-form";

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
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [issueOpen, setIssueOpen] = useState(false);

  const respond = (response: CheckInResponse, detail?: StatusDetail) => {
    startTransition(async () => {
      const result = await answerCheckInAction({ checkInId, response, detail });
      if (result.ok) {
        toast.success(`체크인 응답 완료: ${CHECK_IN_RESPONSE_LABELS[response]}`);
        setIssueOpen(false);
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  };

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm font-medium">{question}</p>
      <p className="text-xs text-muted-foreground">
        응답하면 팀 현황판과 프로젝트 화면에 즉시 반영됩니다.
      </p>
      <div className="flex flex-wrap gap-2" role="group" aria-label="체크인 응답 선택">
        {CHOICES.map((choice) => (
          <Button
            key={choice}
            variant={choice === "issue" ? "destructive" : "outline"}
            size="sm"
            className="h-10"
            disabled={pending}
            onClick={() => {
              if (choice === "issue") {
                setIssueOpen((open) => !open);
              } else {
                respond(choice);
              }
            }}
          >
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
