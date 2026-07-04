"use client";

import { useActionState, useState } from "react";
import { format } from "date-fns";
import { ko } from "date-fns/locale";
import { Check, Copy, KeyRound, Trash2 } from "lucide-react";
import {
  issueTokenAction,
  revokeTokenAction,
  type IssueTokenState,
} from "@/app/(app)/settings/token-actions";
import type { PatRow } from "@/lib/auth/tokens";

const issueInitial: IssueTokenState = {};

/**
 * 설정 > 액세스 토큰(PAT) — MCP·CLI 연결용.
 * 발급 시 평문을 1회 표시(복사+경고), DB엔 해시만. 본인 활성 토큰만 목록/폐기.
 */
export function TokenSettings({ tokens }: { tokens: PatRow[] }) {
  const [state, formAction, pending] = useActionState(issueTokenAction, issueInitial);
  const [copied, setCopied] = useState(false);

  async function copy() {
    if (!state.token) return;
    try {
      await navigator.clipboard.writeText(state.token);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* 권한 없으면 직접 복사 */
    }
  }

  return (
    <section className="rounded-xl border border-[var(--que-border)] bg-[var(--que-bg)] p-5 shadow-[var(--que-shadow-sm)]">
      <h2 className="flex items-center gap-2 text-base font-semibold text-[var(--que-text)]">
        <span className="flex size-8 items-center justify-center rounded-lg bg-[var(--que-brand-subtle)] text-[var(--que-brand)]">
          <KeyRound className="size-[18px]" aria-hidden />
        </span>
        액세스 토큰 (MCP · CLI)
      </h2>
      <p className="mt-1.5 text-sm text-[var(--que-text-secondary)]">
        터미널(CLI)이나 AI(MCP)로 Que를 쓰려면 개인 토큰이 필요해요. 여기서 직접 발급하고, 안 쓰면 폐기하세요.
        발급한 토큰은 <b className="font-semibold text-[var(--que-text)]">그 순간 한 번만</b> 보여요.
      </p>

      {/* 발급 폼 */}
      <form action={formAction} className="mt-4 flex flex-wrap items-end gap-2">
        <label className="flex min-w-[200px] flex-1 flex-col gap-1.5 text-sm font-medium text-[var(--que-text)]">
          라벨 (어디에 쓸 토큰인지)
          <input
            name="label"
            required
            maxLength={60}
            placeholder="예: 노트북 CLI"
            className="h-11 rounded-lg border border-[var(--que-border-strong)] bg-[var(--que-bg)] px-3 text-sm text-[var(--que-text)] outline-none placeholder:text-[var(--que-placeholder)] focus:border-[var(--que-brand)] focus:ring-2 focus:ring-[var(--que-brand)]/20"
          />
        </label>
        <button
          type="submit"
          disabled={pending}
          className="h-11 rounded-lg bg-[var(--que-brand)] px-5 text-sm font-semibold text-[var(--que-on-brand)] transition-colors hover:bg-[var(--que-brand-hover)] disabled:opacity-60"
        >
          {pending ? "발급 중…" : "토큰 발급"}
        </button>
      </form>

      {state.error && (
        <p role="alert" className="mt-2 text-sm text-[var(--que-error)]">
          {state.error}
        </p>
      )}

      {/* 발급된 평문 — 1회 표시 */}
      {state.token && (
        <div className="mt-3 rounded-lg border border-[var(--que-warning)]/30 bg-[var(--que-warning-bg)] p-3">
          <p className="text-sm text-[var(--que-text-secondary)]">
            토큰이 발급됐어요. <b className="font-semibold text-[var(--que-text)]">이 화면을 벗어나면
            다시 볼 수 없어요.</b> 지금 복사해서 안전한 곳(비밀번호 관리자 등)에 보관하세요.
          </p>
          <div className="mt-2 flex items-center gap-2">
            <code className="flex-1 overflow-x-auto rounded-md border border-[var(--que-border)] bg-[var(--que-bg)] px-3 py-2 font-mono text-sm text-[var(--que-text)]">
              {state.token}
            </code>
            <button
              type="button"
              onClick={copy}
              className="flex h-10 shrink-0 items-center gap-1.5 rounded-lg border border-[var(--que-border-strong)] bg-[var(--que-bg)] px-3 text-sm font-medium text-[var(--que-text-secondary)] hover:bg-[var(--que-bg-muted)]"
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
          <p className="mt-2 text-xs text-[var(--que-text-tertiary)]">
            연결 방법은 <b className="font-medium">기타 › MCP · CLI</b> 화면을 참고하세요.
          </p>
        </div>
      )}

      {/* 활성 토큰 목록 */}
      <div className="mt-4">
        <p className="mb-2 text-sm font-medium text-[var(--que-text)]">발급된 토큰</p>
        {tokens.length === 0 ? (
          <p className="text-sm text-[var(--que-text-tertiary)]">아직 발급한 토큰이 없어요.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {tokens.map((t) => (
              <TokenRow key={t.tokenHash} token={t} />
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

function TokenRow({ token }: { token: PatRow }) {
  const [state, formAction, pending] = useActionState(revokeTokenAction, {});
  return (
    <li className="flex flex-wrap items-center gap-2 rounded-lg border border-[var(--que-border)] px-3 py-2.5">
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-[var(--que-text)]">{token.label}</p>
        <p className="truncate text-xs text-[var(--que-text-tertiary)]">
          {format(new Date(token.createdAt), "yyyy년 M월 d일", { locale: ko })} 발급 · ID{" "}
          <span className="font-mono">{token.tokenHash.slice(0, 8)}</span>
        </p>
      </div>
      {state.error && <span className="text-xs text-[var(--que-error)]">{state.error}</span>}
      <form action={formAction}>
        <input type="hidden" name="tokenHash" value={token.tokenHash} />
        <button
          type="submit"
          disabled={pending}
          className="flex h-10 items-center gap-1.5 rounded-lg border border-[var(--que-border-strong)] px-3 text-sm font-medium text-[var(--que-text-secondary)] hover:bg-[var(--que-bg-muted)] disabled:opacity-60"
        >
          <Trash2 className="size-4" aria-hidden />
          {pending ? "폐기 중…" : "폐기"}
        </button>
      </form>
    </li>
  );
}
