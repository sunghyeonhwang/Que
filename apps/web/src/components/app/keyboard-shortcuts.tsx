"use client";

import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

/** 단축키 한 줄. keys는 각 키 캡을 배열로. */
const SHORTCUTS: { keys: string[]; label: string }[] = [
  { keys: ["⌘", "K"], label: "커맨드 팔레트 열기 (검색·이동·빠른 액션)" },
  { keys: ["/"], label: "상단 검색창으로 이동" },
  { keys: ["?"], label: "이 단축키 도움말 열기" },
  { keys: ["Enter"], label: "검색/자연어 입력에서 첫 결과·해석 실행" },
  { keys: ["⌘", "↵"], label: "작업 확인 카드에서 바로 등록" },
  { keys: ["Esc"], label: "열린 카드·팔레트·검색 닫기" },
  { keys: ["1–7"], label: "체크인 패널에서 숫자키로 빠르게 응답" },
  { keys: ["←", "→"], label: "일정: 이전·다음 기간으로 이동" },
  { keys: ["T"], label: "일정: 오늘로" },
  { keys: ["D", "3", "W", "M"], label: "일정: 일간·3일·주간·월간 뷰 전환" },
];

function isTypingTarget(el: EventTarget | null): boolean {
  const node = el as HTMLElement | null;
  if (!node) return false;
  const tag = node.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || node.isContentEditable;
}

/**
 * 전역 키보드 단축키.
 * - `?` : 단축키 치트시트 다이얼로그 열기
 * - `/` : 상단바 검색 입력으로 포커스 이동
 * 입력 필드에 포커스가 있을 때는 무시(정상 타이핑 보장). ⌘K는 CommandPalette가 소유한다.
 */
export function KeyboardShortcuts() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (isTypingTarget(e.target)) return;

      if (e.key === "?") {
        e.preventDefault();
        setOpen((v) => !v);
      } else if (e.key === "/") {
        const input = document.getElementById("global-search-input") as HTMLInputElement | null;
        if (input && input.offsetParent !== null) {
          e.preventDefault();
          input.focus();
        }
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-md border-[var(--que-border)]">
        <DialogHeader>
          <DialogTitle>키보드 단축키</DialogTitle>
          <DialogDescription>자주 쓰는 동작을 키보드로 더 빠르게.</DialogDescription>
        </DialogHeader>
        <ul className="flex flex-col gap-2">
          {SHORTCUTS.map((s) => (
            <li key={s.label} className="flex items-center gap-3">
              <span className="flex shrink-0 items-center gap-1">
                {s.keys.map((k, i) => (
                  <kbd
                    key={i}
                    className="grid min-w-6 place-items-center rounded-md border border-[var(--que-border-strong)] bg-[var(--que-bg-muted)] px-1.5 py-0.5 text-xs font-semibold text-[var(--que-text-secondary)]"
                  >
                    {k}
                  </kbd>
                ))}
              </span>
              <span className="text-sm text-[var(--que-text-secondary)]">{s.label}</span>
            </li>
          ))}
        </ul>
      </DialogContent>
    </Dialog>
  );
}
