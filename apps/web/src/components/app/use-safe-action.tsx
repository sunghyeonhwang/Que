"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { reportError } from "@/lib/report-error";
import type { ActionResult } from "@/app/(app)/today/actions";

// 서버 액션 호출의 공통 결과 처리 (que-error-reporting-plan.md 2.2).
// - ok: 성공 토스트 + router.refresh (+ onSuccess)
// - ok:false (도메인 규칙 거부): 사유를 그대로 토스트 — 정상 동작, 리포팅 안 함
// - throw (예상 못 한 예외): reportError + 안내 토스트 — 조용히 죽지 않는다

export const UNEXPECTED_ERROR_MESSAGE =
  "알 수 없는 오류가 발생했습니다. 오류가 기록됐으니 반복되면 개발팀에 알려주세요.";

export function useSafeAction() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const run = (
    action: () => Promise<ActionResult>,
    options: { success: string; onSuccess?: () => void; refresh?: boolean },
  ) => {
    startTransition(async () => {
      try {
        const result = await action();
        if (result.ok) {
          toast.success(options.success);
          options.onSuccess?.();
          if (options.refresh !== false) router.refresh();
        } else {
          toast.error(result.error);
        }
      } catch (error) {
        reportError(error, { source: "server-action" });
        toast.error(UNEXPECTED_ERROR_MESSAGE);
      }
    });
  };

  return { run, pending, startTransition };
}
