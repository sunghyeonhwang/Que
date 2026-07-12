"use client";

import { useActionState, useState, useSyncExternalStore } from "react";
import { Eye, EyeOff } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { loginAction, type LoginState } from "./actions";

const initial: LoginState = {};

/** '아이디 기억하기' 저장 키 — 이메일만 저장한다(비밀번호는 절대 저장 금지). */
const REMEMBER_EMAIL_KEY = "que-remembered-email";

// localStorage를 외부 스토어로 구독(standup-form의 useInputMode 선례) — effect 내 setState 없이
// SSR(서버 스냅샷 "")과 hydration이 안전하다.
function subscribeStorage(onChange: () => void): () => void {
  window.addEventListener("storage", onChange);
  return () => window.removeEventListener("storage", onChange);
}

function useRememberedEmail(): string {
  return useSyncExternalStore(
    subscribeStorage,
    () => window.localStorage.getItem(REMEMBER_EMAIL_KEY) ?? "",
    () => "",
  );
}

// 디자인(Figma QUE_All_Pages / 0 1 0 - Login) 기준 로그인 폼.
// 소셜 로그인·비밀번호 재설정·회원가입은 범위 밖(보류/미도입)이라 뺐다.
export function LoginForm({ notice }: { notice?: string }) {
  const [state, formAction, pending] = useActionState(loginAction, initial);
  const [showPw, setShowPw] = useState(false);
  // 저장값은 초깃값일 뿐 — 체크박스는 사용자가 토글하면(null이 아니면) 그 값이 우선한다.
  const savedEmail = useRememberedEmail();
  const [rememberEdit, setRememberEdit] = useState<boolean | null>(null);
  const remember = rememberEdit ?? savedEmail !== "";

  // 제출 시점에 저장/삭제 — 로그인 성공 시 signIn이 redirect를 던져 이후 훅이 없으므로 여기서 처리.
  // 값은 state가 아니라 폼 DOM에서 읽는다 — 브라우저 자동완성(autofill)은 onChange를 안 태워
  // state에 없을 수 있다(실측 발견). 실제 제출되는 값과 저장 값을 일치시킨다.
  const persistEmail = (e: React.FormEvent<HTMLFormElement>) => {
    const submitted = String(new FormData(e.currentTarget).get("email") ?? "").trim();
    if (remember && submitted) localStorage.setItem(REMEMBER_EMAIL_KEY, submitted);
    else localStorage.removeItem(REMEMBER_EMAIL_KEY);
  };

  return (
    <div className="flex w-full max-w-[385px] flex-col items-center gap-5">
      {/* 로고 + 헤드라인 */}
      <div className="flex flex-col items-center gap-4">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo-mark.svg" alt="Que" className="h-[64px] w-auto dark:invert" />
        <div className="flex flex-col items-center gap-0.5 text-center">
          <h1 className="text-2xl font-medium text-[var(--que-text)]">다시 오셨군요!</h1>
          <p className="text-sm text-[var(--que-text-secondary)]">여기서 프로젝트와 작업을 관리하세요.</p>
        </div>
      </div>

      {notice && (
        <p className="w-full rounded-lg border border-[var(--que-success)]/30 bg-[var(--que-success-bg)] px-3 py-2 text-center text-sm text-[var(--que-success)]">
          {notice}
        </p>
      )}

      <form action={formAction} onSubmit={persistEmail} className="flex w-full flex-col gap-5">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="email" className="text-sm font-medium text-[var(--que-text)]">
            이메일
          </label>
          {/* uncontrolled + key 리마운트: hydration 후 savedEmail이 로드되면 defaultValue가 반영되고,
              브라우저 자동완성 값이 리렌더에 지워지지 않는다(controlled였다면 state로 덮임). */}
          <input
            key={savedEmail}
            id="email"
            name="email"
            type="email"
            autoComplete="username"
            required
            placeholder="이메일 주소 입력"
            defaultValue={savedEmail}
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

        {/* 아이디 기억하기 — 체크하면 다음 접속에도 이메일이 채워진다(localStorage, 이메일만). */}
        <label className="-mt-1 flex w-fit cursor-pointer items-center gap-2 text-sm text-[var(--que-text-secondary)]">
          <Checkbox
            checked={remember}
            onCheckedChange={(v) => setRememberEdit(v === true)}
            aria-label="아이디 기억하기"
          />
          아이디 기억하기
        </label>

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
