"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";

/** 복사 가능한 코드 블록 — 우상단 복사 버튼. 터미널 명령·설정 JSON 안내에 사용. */
export function CopyBlock({ code, label }: { code: string; label?: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // 클립보드 권한 없으면 조용히 무시(사용자가 직접 선택 복사)
    }
  }

  return (
    <div className="relative overflow-hidden rounded-lg border border-[var(--que-border)] bg-[var(--que-bg-muted)]">
      {label && (
        <div className="border-b border-[var(--que-border)] px-3 py-1.5 text-xs font-medium text-[var(--que-text-tertiary)]">
          {label}
        </div>
      )}
      <button
        type="button"
        onClick={copy}
        aria-label="복사"
        className="absolute right-2 top-2 flex h-8 items-center gap-1 rounded-md border border-[var(--que-border)] bg-[var(--que-bg)] px-2 text-xs font-medium text-[var(--que-text-secondary)] transition-colors hover:bg-[var(--que-bg-muted)]"
        style={label ? { top: "2.6rem" } : undefined}
      >
        {copied ? (
          <>
            <Check className="size-3.5 text-[var(--que-success)]" aria-hidden /> 복사됨
          </>
        ) : (
          <>
            <Copy className="size-3.5" aria-hidden /> 복사
          </>
        )}
      </button>
      <pre className="overflow-x-auto px-3 py-3 pr-20 text-xs leading-relaxed text-[var(--que-text)]">
        <code className="font-mono">{code}</code>
      </pre>
    </div>
  );
}
