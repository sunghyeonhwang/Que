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

  const run = <R extends ActionResult>(
    action: () => Promise<R>,
    options: {
      success: string;
      onSuccess?: () => void;
      /** 실패(도메인 거부·예외) 시 호출 — 인라인 편집의 낙관적 표시를 원값으로 되돌리는 데 쓴다.
       *  (글래도스 시트 심사 지적: 저장 실패 후에도 화면에 미저장 값이 남는 유령 상태 방지) */
      onError?: () => void;
      refresh?: boolean;
      /** 성공 토스트에 [실행 취소] 버튼을 붙인다 — 결과(이전 값 포함)를 받아 되돌리기 액션을 돌려준다.
       *  undefined를 돌려주면 버튼 없음(되돌릴 것이 없는 경우). */
      undo?: (result: R & { ok: true }) => { label?: string; onClick: () => void } | undefined;
    },
  ) => {
    startTransition(async () => {
      try {
        const result = await action();
        if (result.ok) {
          const undoAction = options.undo?.(result as R & { ok: true });
          toast.success(
            options.success,
            undoAction
              ? { action: { label: undoAction.label ?? "실행 취소", onClick: undoAction.onClick } }
              : undefined,
          );
          options.onSuccess?.();
          if (options.refresh !== false) router.refresh();
        } else {
          toast.error(result.error);
          options.onError?.();
        }
      } catch (error) {
        reportError(error, { source: "server-action" });
        toast.error(UNEXPECTED_ERROR_MESSAGE);
        options.onError?.();
      }
    });
  };

  return { run, pending, startTransition };
}
