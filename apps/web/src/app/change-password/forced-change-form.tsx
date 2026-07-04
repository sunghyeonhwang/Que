"use client";

import { useActionState, useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { PASSWORD_MIN_LENGTH } from "@/lib/auth/policy";
import { forcedChangeAction, type ForcedChangeState } from "./actions";

const initial: ForcedChangeState = {};

export function ForcedChangeForm() {
  const [state, formAction, pending] = useActionState(forcedChangeAction, initial);

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <Field name="current" label="지금 쓰는(임시) 비밀번호" autoComplete="current-password" />
      <Field name="next" label={`새 비밀번호 (${PASSWORD_MIN_LENGTH}자 이상)`} autoComplete="new-password" min />
      <Field name="confirm" label="새 비밀번호 확인" autoComplete="new-password" min />

      {state.error && (
        <p role="alert" className="text-sm text-[var(--que-error)]">
          {state.error}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="mt-1 flex h-12 items-center justify-center rounded-lg bg-[var(--que-brand)] text-base font-semibold text-[var(--que-on-brand)] transition-colors hover:bg-[var(--que-brand-hover)] disabled:opacity-60"
      >
        {pending ? "바꾸는 중…" : "비밀번호 바꾸고 계속하기"}
      </button>
      <p className="text-center text-xs text-[var(--que-text-tertiary)]">
        바꾸고 나면 새 비밀번호로 다시 로그인해요.
      </p>
    </form>
  );
}

function Field({
  name,
  label,
  autoComplete,
  min,
}: {
  name: string;
  label: string;
  autoComplete: string;
  min?: boolean;
}) {
  const [show, setShow] = useState(false);
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={`fc-${name}`} className="text-sm font-medium text-[var(--que-text)]">
        {label}
      </label>
      <div className="relative">
        <input
          id={`fc-${name}`}
          name={name}
          type={show ? "text" : "password"}
          autoComplete={autoComplete}
          required
          minLength={min ? PASSWORD_MIN_LENGTH : undefined}
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
