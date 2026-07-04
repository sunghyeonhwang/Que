"use client";

import { useActionState, useState } from "react";
import { Check, Copy, KeyRound } from "lucide-react";
import {
  adminResetPasswordAction,
  type ResetPasswordState,
} from "@/app/(app)/members/[id]/reset-actions";

const initial: ResetPasswordState = {};

/**
 * 관리자 전용 — 팀원 비밀번호 재설정 카드.
 * 실행하면 임시 비밀번호를 1회 보여주고, 관리자가 본인에게 안전한 채널로 전달한다.
 * 대상은 다음 로그인 때 새 비밀번호로 바꾸도록 강제된다.
 */
export function AdminResetPassword({
  targetId,
  targetName,
}: {
  targetId: string;
  targetName: string;
}) {
  const [state, formAction, pending] = useActionState(adminResetPasswordAction, initial);
  const [confirming, setConfirming] = useState(false);
  const [copied, setCopied] = useState(false);

  async function copy() {
    if (!state.tempPassword) return;
    try {
      await navigator.clipboard.writeText(state.tempPassword);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* 클립보드 권한 없으면 직접 복사 */
    }
  }

  return (
    <section className="rounded-xl border border-[var(--que-border)] bg-[var(--que-bg)] p-4 shadow-[var(--que-shadow-sm)]">
      <h2 className="flex items-center gap-2 text-base font-semibold text-[var(--que-text)]">
        <span className="flex size-8 items-center justify-center rounded-lg bg-[var(--que-brand-subtle)] text-[var(--que-brand)]">
          <KeyRound className="size-[18px]" aria-hidden />
        </span>
        비밀번호 재설정
        <span className="rounded-full bg-[var(--que-bg-muted)] px-2 py-0.5 text-xs font-medium text-[var(--que-text-tertiary)]">
          관리자
        </span>
      </h2>
      <p className="mt-1.5 text-sm text-[var(--que-text-secondary)]">
        {targetName}님이 비밀번호를 잊었을 때, 임시 비밀번호를 새로 발급해요. 발급하면 지금 쓰던
        비밀번호는 바로 무효가 되고, {targetName}님은 다음 로그인 때 새 비밀번호로 바꾸게 돼요.
      </p>

      {state.tempPassword ? (
        <div className="mt-3 rounded-lg border border-[var(--que-success)]/30 bg-[var(--que-success-bg)] p-3">
          <p className="text-sm text-[var(--que-text-secondary)]">
            임시 비밀번호가 발급됐어요. <b className="font-semibold text-[var(--que-text)]">이 화면을
            벗어나면 다시 볼 수 없어요.</b> 지금 복사해서 {targetName}님에게 안전하게 전달하세요.
          </p>
          <div className="mt-2 flex items-center gap-2">
            <code className="flex-1 rounded-md border border-[var(--que-border)] bg-[var(--que-bg)] px-3 py-2 font-mono text-sm text-[var(--que-text)]">
              {state.tempPassword}
            </code>
            <button
              type="button"
              onClick={copy}
              className="flex h-9 items-center gap-1.5 rounded-lg border border-[var(--que-border-strong)] bg-[var(--que-bg)] px-3 text-sm font-medium text-[var(--que-text-secondary)] hover:bg-[var(--que-bg-muted)]"
            >
              {copied ? (
                <>
                  <Check className="size-4 text-[var(--que-success)]" aria-hidden /> 복사됨
                </>
              ) : (
                <>
                  <Copy className="size-4" aria-hidden /> 복사
                </>
              )}
            </button>
          </div>
        </div>
      ) : (
        <form action={formAction} className="mt-3">
          <input type="hidden" name="targetId" value={targetId} />
          {state.error && (
            <p role="alert" className="mb-2 text-sm text-[var(--que-error)]">
              {state.error}
            </p>
          )}
          {confirming ? (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm text-[var(--que-text-secondary)]">정말 재설정할까요?</span>
              <button
                type="submit"
                disabled={pending}
                className="h-10 rounded-lg bg-[var(--que-error)] px-4 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-60"
              >
                {pending ? "발급 중…" : "네, 임시 비밀번호 발급"}
              </button>
              <button
                type="button"
                onClick={() => setConfirming(false)}
                className="h-10 rounded-lg border border-[var(--que-border-strong)] px-4 text-sm font-medium text-[var(--que-text-secondary)] hover:bg-[var(--que-bg-muted)]"
              >
                취소
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setConfirming(true)}
              className="h-10 rounded-lg border border-[var(--que-border-strong)] px-4 text-sm font-medium text-[var(--que-text)] hover:bg-[var(--que-bg-muted)]"
            >
              임시 비밀번호 발급
            </button>
          )}
        </form>
      )}
    </section>
  );
}
