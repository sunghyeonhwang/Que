"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { Eye, EyeOff, ShieldCheck } from "lucide-react";
import {
  changePasswordAction,
  type ChangePasswordState,
} from "@/app/(app)/settings/security-actions";
import { PASSWORD_MIN_LENGTH } from "@/lib/auth/policy";

const initial: ChangePasswordState = {};

/** 설정 > 보안 — 본인 비밀번호 변경 카드. 현재/새/확인 3칸. */
export function PasswordSettings() {
  const [state, formAction, pending] = useActionState(changePasswordAction, initial);
  const formRef = useRef<HTMLFormElement>(null);

  // 성공하면 입력값을 비운다.
  useEffect(() => {
    if (state.success) formRef.current?.reset();
  }, [state.success]);

  return (
    <section className="rounded-xl border border-[var(--que-border)] bg-[var(--que-bg)] p-5 shadow-[var(--que-shadow-sm)]">
      <h2 className="flex items-center gap-2 text-base font-semibold text-[var(--que-text)]">
        <span className="flex size-8 items-center justify-center rounded-lg bg-[var(--que-brand-subtle)] text-[var(--que-brand)]">
          <ShieldCheck className="size-[18px]" aria-hidden />
        </span>
        비밀번호 변경
      </h2>
      <p className="mt-1.5 text-sm text-[var(--que-text-secondary)]">
        보안을 위해 처음 받은 공용 비밀번호는 본인만 아는 비밀번호로 바꿔주세요.
        {PASSWORD_MIN_LENGTH}자 이상이면 돼요.
      </p>

      <form ref={formRef} action={formAction} className="mt-4 flex max-w-md flex-col gap-3">
        <PasswordField name="current" label="현재 비밀번호" autoComplete="current-password" />
        <PasswordField name="next" label="새 비밀번호" autoComplete="new-password" />
        <PasswordField name="confirm" label="새 비밀번호 확인" autoComplete="new-password" />

        {state.error && (
          <p role="alert" className="text-sm text-[var(--que-error)]">
            {state.error}
          </p>
        )}
        {state.success && (
          <p role="status" className="text-sm text-[var(--que-success)]">
            비밀번호를 바꿨어요. 다음 로그인부터 새 비밀번호를 쓰세요.
          </p>
        )}

        <button
          type="submit"
          disabled={pending}
          className="mt-1 flex h-11 w-fit items-center justify-center rounded-lg bg-[var(--que-brand)] px-5 text-sm font-semibold text-[var(--que-on-brand)] transition-colors hover:bg-[var(--que-brand-hover)] disabled:opacity-60"
        >
          {pending ? "바꾸는 중…" : "비밀번호 바꾸기"}
        </button>
      </form>
    </section>
  );
}

function PasswordField({
  name,
  label,
  autoComplete,
}: {
  name: string;
  label: string;
  autoComplete: string;
}) {
  const [show, setShow] = useState(false);
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={`pw-${name}`} className="text-sm font-medium text-[var(--que-text)]">
        {label}
      </label>
      <div className="relative">
        <input
          id={`pw-${name}`}
          name={name}
          type={show ? "text" : "password"}
          autoComplete={autoComplete}
          required
          minLength={name === "current" ? undefined : PASSWORD_MIN_LENGTH}
          className="h-11 w-full rounded-lg border border-[var(--que-border-strong)] bg-[var(--que-bg)] pr-11 pl-3 text-sm text-[var(--que-text)] outline-none placeholder:text-[var(--que-placeholder)] focus:border-[var(--que-brand)] focus:ring-2 focus:ring-[var(--que-brand)]/20"
        />
        <button
          type="button"
          onClick={() => setShow((v) => !v)}
          aria-label={show ? "비밀번호 숨기기" : "비밀번호 표시"}
          className="absolute inset-y-0 right-0 flex w-11 items-center justify-center text-[var(--que-placeholder)] hover:text-[var(--que-text-secondary)]"
        >
          {show ? <EyeOff className="size-5" aria-hidden /> : <Eye className="size-5" aria-hidden />}
        </button>
      </div>
    </div>
  );
}
