"use client";

import { useState, useTransition } from "react";
import { HandHelping, Loader2, Check } from "lucide-react";
import { toast } from "sonner";
import { offerHelpAction } from "@/app/(app)/daily/help-actions";
import { reportError } from "@/lib/report-error";
import { UNEXPECTED_ERROR_MESSAGE } from "@/components/app/use-safe-action";
import { Button } from "@/components/ui/button";

// 데일리 "내가 도울게요" 소형 버튼(명세 C). 막힌 팀원 카드에서만 노출(본인 카드는 미노출 — 상위에서 걸러 렌더).
// 클릭 → offerHelpAction(막힘 작업이 있으면 그 작업에 댓글 + 대상자 DM). 성공하면 "돕기로 했습니다"로 잠근다.
// 같은 날 중복은 서버가 dedup하지만, 즉시 피드백을 위해 로컬 state로도 버튼을 비활성화한다.

/** 서버 결과(commented·notified 조합)를 사람이 읽는 토스트 문구로. */
function successMessage(commented: boolean, notified: boolean): string {
  if (commented && notified) return "댓글을 남기고 DM을 보냈습니다.";
  if (notified) return "DM을 보냈습니다.";
  if (commented) return "댓글을 남겼습니다.";
  return "도움 제안을 기록했습니다.";
}

export function OfferHelpButton({
  targetUserId,
  taskId,
  date,
}: {
  targetUserId: string;
  /** 막힘 연결 작업 id(1개면 그 작업, 여러 개면 첫 번째). 없으면 DM만. */
  taskId?: string;
  date: string;
}) {
  const [pending, startTransition] = useTransition();
  const [done, setDone] = useState(false);

  const onClick = () => {
    startTransition(async () => {
      try {
        const result = await offerHelpAction({ targetUserId, taskId, date });
        if (result.ok) {
          setDone(true);
          toast.success(successMessage(result.commented, result.notified));
        } else {
          toast.error(result.error);
        }
      } catch (error) {
        reportError(error, { source: "offer-help" });
        toast.error(UNEXPECTED_ERROR_MESSAGE);
      }
    });
  };

  if (done) {
    return (
      <Button variant="outline" size="sm" className="h-10 gap-1.5" disabled>
        <Check className="size-4" aria-hidden />
        돕기로 했습니다
      </Button>
    );
  }

  return (
    <Button
      variant="outline"
      size="sm"
      className="h-10 gap-1.5"
      onClick={onClick}
      disabled={pending}
    >
      {pending ? (
        <Loader2 className="size-4 animate-spin" aria-hidden />
      ) : (
        <HandHelping className="size-4" aria-hidden />
      )}
      도울게요
    </Button>
  );
}
