"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { reportError } from "@/lib/report-error";
import { UNEXPECTED_ERROR_MESSAGE } from "./use-safe-action";

// 낙관적(optimistic) 서버 액션 훅 — "일단 반응하고, 서버는 뒤에서 처리".
// useSafeAction과의 차이: useSafeAction은 서버 응답 → 토스트 → router.refresh 후에야
// 화면이 바뀐다(프로덕션은 전체 스냅샷 로드라 refresh가 수 초 → 느리게 느껴짐).
// 이 훅은 클릭 즉시 로컬 상태를 반영(apply)하고, 액션은 startTransition으로 백그라운드에서
// 커밋한다. 실패(도메인 규칙 거부/예외)일 때만 rollback으로 되돌린다. home-todo-row가 원형.
//
// ── 언제 쓰나 (토글·상태 반영형) ────────────────────────────────────────────
//  · 완료 토글, 반복 템플릿 on/off, 체크인 응답, 알림 읽음, 선행 작업 체크, 열 이동 등
//    "항목 자체의 시각 상태"를 즉시 뒤집으면 되는 조작.
//  · 즉시 반영할 로컬 상태를 apply/rollback으로 명시할 수 있는 경우.
//
// ── 언제 쓰지 않나 (기존 useSafeAction 유지) ──────────────────────────────────
//  · 생성 폼: 새 엔티티 id가 서버에서 와야 함(낙관적으로 흉내 낼 수 없음).
//  · 삭제 등 파괴적 조작: 확정 후 반영이 안전(낙관 반영이 오해를 부름).
//  · AI 생성·업로드 등 진행 표시가 정직해야 하는 조작.
//  · 인증·설정류.
//
// ── 파생값 주의 ──────────────────────────────────────────────────────────────
//  서버가 만드는 파생값(정렬·카운트·집계)은 억지로 흉내 내지 말 것. 항목 자체의 시각
//  상태만 즉시 반영하고, 파생값은 다음 자연 갱신(다음 방문·refresh)에 맡긴다.
//  refresh는 기본 false — 다른 화면 데이터 정합이 꼭 필요할 때만 명시적으로 true.

/** run에 넘기는 서버 액션의 결과 형태 (ActionResult·AlertActionResult 모두 호환). */
type OptimisticResult = { ok: boolean; error?: string };

export interface OptimisticRunOptions<R extends OptimisticResult = OptimisticResult> {
  /** 클릭 즉시 실행 — 로컬 상태를 낙관적으로 반영한다(setState 등). */
  apply: () => void;
  /** 실패 시 apply를 되돌린다. */
  rollback: () => void;
  /** 성공 토스트 문구. 조용한 토글은 생략 가능. */
  success?: string;
  /** 성공 토스트에 [실행 취소] 버튼을 붙인다(success가 있을 때만 표시).
   *  서버 결과(변경 전 값 포함)를 받아 되돌리기 액션을 돌려준다 — 클라이언트 prop은 revalidate
   *  경로에 따라 stale일 수 있으므로(연속 조작), 이전 값은 서버 반환을 신뢰한다.
   *  undefined를 돌려주면 버튼 없음. */
  undo?: (result: R & { ok: true }) => { label?: string; onClick: () => void } | undefined;
  /** true일 때만 router.refresh — 다른 화면 데이터 정합이 필요한 경우. 기본 false. */
  refresh?: boolean;
  /** reportError 태그(예외 추적용). 기본 "optimistic-action". */
  source?: string;
}

export function useOptimisticAction() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const run = <R extends OptimisticResult>(
    action: () => Promise<R>,
    options: OptimisticRunOptions<R>,
  ) => {
    options.apply(); // 낙관적 즉시 반영
    startTransition(async () => {
      try {
        const result = await action();
        if (!result.ok) {
          options.rollback(); // 도메인 규칙 거부 — 롤백
          toast.error(result.error ?? UNEXPECTED_ERROR_MESSAGE);
          return;
        }
        if (options.success) {
          const undoAction = options.undo?.(result as R & { ok: true });
          toast.success(
            options.success,
            undoAction
              ? { action: { label: undoAction.label ?? "실행 취소", onClick: undoAction.onClick } }
              : undefined,
          );
        }
        if (options.refresh) router.refresh();
      } catch (error) {
        options.rollback();
        reportError(error, { source: options.source ?? "optimistic-action" });
        toast.error(UNEXPECTED_ERROR_MESSAGE);
      }
    });
  };

  return { run, pending, startTransition };
}
