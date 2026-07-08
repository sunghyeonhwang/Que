"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { cn } from "@/lib/utils";

export interface CommandItem {
  /** 실제 복사·실행되는 명령(한 줄). */
  cmd: string;
  /** 명령 옆 설명(복사에 포함되지 않는 캡션). */
  note?: string;
}

/** 명령어 목록 — 행마다 명령(font-mono) + 개별 복사 버튼(40px) + 설명 캡션.
 *  주석/설명이 섞인 블록을 통째로 복사하던 CopyBlock과 달리, 명령 단위로만 복사한다.
 *  헤더의 '전체 복사'는 명령만 개행으로 이어 붙인다(note 제외). */
export function CommandList({
  items,
  label,
  copyAll = false,
}: {
  items: CommandItem[];
  label?: string;
  copyAll?: boolean;
}) {
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);
  const [copiedAll, setCopiedAll] = useState(false);

  async function copyText(text: string, onDone: () => void) {
    try {
      await navigator.clipboard.writeText(text);
      onDone();
    } catch {
      // 클립보드 권한 없으면 조용히 무시(사용자가 직접 선택 복사)
    }
  }

  const copyOne = (idx: number) =>
    copyText(items[idx].cmd, () => {
      setCopiedIdx(idx);
      setTimeout(() => setCopiedIdx((v) => (v === idx ? null : v)), 1500);
    });

  const copyEverything = () =>
    copyText(items.map((it) => it.cmd).join("\n"), () => {
      setCopiedAll(true);
      setTimeout(() => setCopiedAll(false), 1500);
    });

  return (
    <div className="overflow-hidden rounded-lg border border-[var(--que-border)] bg-[var(--que-bg-muted)]">
      {(label || copyAll) && (
        <div className="flex items-center justify-between gap-2 border-b border-[var(--que-border)] px-3 py-1.5">
          {label ? (
            <span className="text-xs font-medium text-[var(--que-text-tertiary)]">{label}</span>
          ) : (
            <span />
          )}
          {copyAll && (
            <button
              type="button"
              onClick={copyEverything}
              aria-label="명령 전체 복사"
              className="flex h-10 items-center gap-1 rounded-md border border-[var(--que-border)] bg-[var(--que-bg)] px-3 text-xs font-medium text-[var(--que-text-secondary)] transition-colors hover:bg-[var(--que-bg-muted)]"
            >
              {copiedAll ? (
                <>
                  <Check className="size-3.5 text-[var(--que-success)]" aria-hidden /> 복사됨
                </>
              ) : (
                <>
                  <Copy className="size-3.5" aria-hidden /> 전체 복사
                </>
              )}
            </button>
          )}
        </div>
      )}
      <ul className="divide-y divide-[var(--que-border)]">
        {items.map((item, idx) => {
          const copied = copiedIdx === idx;
          return (
            <li key={item.cmd} className="flex items-start gap-2 px-3 py-2">
              <div className="min-w-0 flex-1 py-1.5">
                <code className="block overflow-x-auto font-mono text-xs leading-relaxed whitespace-pre text-[var(--que-text)]">
                  {item.cmd}
                </code>
                {item.note && (
                  <p className="mt-0.5 text-xs text-[var(--que-text-tertiary)]">{item.note}</p>
                )}
              </div>
              <button
                type="button"
                onClick={() => copyOne(idx)}
                aria-label={`${item.cmd} 복사`}
                className={cn(
                  "flex size-10 shrink-0 items-center justify-center rounded-md border border-[var(--que-border)] bg-[var(--que-bg)] text-[var(--que-text-secondary)] transition-colors hover:bg-[var(--que-bg-muted)]",
                )}
              >
                {copied ? (
                  <Check className="size-4 text-[var(--que-success)]" aria-hidden />
                ) : (
                  <Copy className="size-4" aria-hidden />
                )}
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
