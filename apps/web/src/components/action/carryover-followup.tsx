"use client";

import { useState } from "react";
import { format } from "date-fns";
import { ChevronDown, ChevronRight, History } from "lucide-react";
import { ACTION_ITEM_STATUS_LABELS, type ActionItemStatus } from "@que/core";
import { ToneBadge, type BadgeTone } from "@/components/app/tone-badge";
import type { NoteCarryover } from "@/lib/meeting-carryover";

// 상태 색상 의미 고정: 확인 필요=violet(응답대기) · 후보=blue(정보).
const STATUS_TONE: Partial<Record<ActionItemStatus, BadgeTone>> = {
  needs_review: "violet",
  candidate: "blue",
};

/** 지난 회의 팔로업 블록(명세 B-6) — 직전 동종 회의록에서 넘어온 미처리 Action.
 *  기본 접힘(요약 1줄), 펼치면 항목 리스트(제목·상태 뱃지·N일째). carryover가 null이면 페이지에서 미렌더. */
export function CarryoverFollowup({ carryover }: { carryover: NoteCarryover }) {
  const [open, setOpen] = useState(false);
  const { noteTitle, noteDate, items } = carryover;

  return (
    <section className="rounded-xl border border-[var(--que-warning)]/30 bg-[var(--que-warning-bg)]">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="flex min-h-11 w-full items-center gap-2 rounded-xl px-3.5 py-2.5 text-left"
      >
        <History className="size-4 shrink-0 text-[var(--que-warning)]" aria-hidden />
        <span className="min-w-0 flex-1 text-sm font-medium text-[var(--que-text)]">
          지난 회의에서 넘어온 미처리 {items.length}건
          <span className="ml-1 font-normal text-[var(--que-text-tertiary)]">
            — {noteTitle} ({format(new Date(noteDate), "M/d")})
          </span>
        </span>
        {open ? (
          <ChevronDown className="size-4 shrink-0 text-[var(--que-text-tertiary)]" aria-hidden />
        ) : (
          <ChevronRight className="size-4 shrink-0 text-[var(--que-text-tertiary)]" aria-hidden />
        )}
      </button>
      {open && (
        <ul className="flex flex-col gap-1.5 border-t border-[var(--que-warning)]/20 px-3.5 py-2.5">
          {items.map((it) => (
            <li key={it.id} className="flex items-center gap-2">
              <ToneBadge tone={STATUS_TONE[it.status] ?? "neutral"}>
                {ACTION_ITEM_STATUS_LABELS[it.status]}
              </ToneBadge>
              <span className="min-w-0 flex-1 truncate text-sm text-[var(--que-text)]">
                {it.title}
              </span>
              {it.ageBusinessDays >= 3 ? (
                <ToneBadge tone="amber" ariaLabel={`${it.ageBusinessDays}일째 미처리`}>
                  {it.ageBusinessDays}일째
                </ToneBadge>
              ) : (
                <span className="shrink-0 tabular-nums text-xs text-[var(--que-text-tertiary)]">
                  {it.ageBusinessDays}일째
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
