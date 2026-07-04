"use client";

import { useActionState, useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { loginAction, type LoginState } from "./actions";

const initial: LoginState = {};

// 디자인(Figma QUE_All_Pages / 0 1 0 - Login) 기준 로그인 폼.
// 소셜 로그인·비밀번호 재설정·회원가입은 범위 밖(보류/미도입)이라 뺐다.
export function LoginForm() {
  const [state, formAction, pending] = useActionState(loginAction, initial);
  const [showPw, setShowPw] = useState(false);

  return (
    <div className="flex w-full max-w-[385px] flex-col items-center gap-5">
      {/* 로고 + 헤드라인 */}
      <div className="flex flex-col items-center gap-4">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/auth/logo.svg" alt="Que" className="size-[70px]" />
        <div className="flex flex-col items-center gap-0.5 text-center">
          <h1 className="text-2xl font-medium text-[var(--que-text)]">다시 오셨군요!</h1>
          <p className="text-sm text-[var(--que-text-secondary)]">여기서 프로젝트와 작업을 관리하세요.</p>
        </div>
      </div>

      <form action={formAction} className="flex w-full flex-col gap-5">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="email" className="text-sm font-medium text-[var(--que-text)]">
            이메일
          </label>
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="username"
            required
            placeholder="이메일 주소 입력"
            className="h-11 rounded-[10px] border border-[var(--que-border-strong)] bg-[var(--que-bg)] px-3 text-sm text-[var(--que-text)] outline-none placeholder:text-[var(--que-placeholder)] focus:border-[var(--que-brand)] focus:ring-2 focus:ring-[var(--que-brand)]/20"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="password" className="text-sm font-medium text-[var(--que-text)]">
            비밀번호
          </label>
          <div className="relative">
            <input
              id="password"
              name="password"
              type={showPw ? "text" : "password"}
              autoComplete="current-password"
              required
              placeholder="비밀번호 입력"
              className="h-11 w-full rounded-[10px] border-[1.5px] border-[var(--que-border-strong)] bg-[var(--que-bg)] pr-11 pl-3 text-sm text-[var(--que-text)] outline-none placeholder:text-[var(--que-placeholder)] focus:border-[var(--que-brand)] focus:ring-2 focus:ring-[var(--que-brand)]/20"
            />
            <button
              type="button"
              onClick={() => setShowPw((v) => !v)}
              aria-label={showPw ? "비밀번호 숨기기" : "비밀번호 표시"}
              className="absolute inset-y-0 right-0 flex w-11 items-center justify-center text-[var(--que-placeholder)] hover:text-[var(--que-text-secondary)]"
            >
              {showPw ? <EyeOff className="size-5" aria-hidden /> : <Eye className="size-5" aria-hidden />}
            </button>
          </div>
        </div>

        {state.error && (
          <p role="alert" className="-mt-2 text-center text-sm text-[var(--que-error)]">
            {state.error}
          </p>
        )}

        <button
          type="submit"
          disabled={pending}
          className="flex h-12 items-center justify-center rounded-lg bg-[var(--que-brand)] text-base font-semibold text-[var(--que-on-brand)] transition-colors hover:bg-[var(--que-brand-hover)] disabled:opacity-60"
        >
          {pending ? "로그인 중…" : "로그인"}
        </button>
      </form>
    </div>
  );
}
