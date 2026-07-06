"use client";

import type { MouseEvent } from "react";
import { cn } from "@/lib/utils";
import { burstConfetti } from "./confetti";

/** 원형 완료 버튼(표현 전용).
 *  작업 완료(TaskDoneCircle)와 결제 입금 완료가 같은 룩앤필·연출을 공유한다.
 *  - 미완료: 빈 원(테두리) / 완료: green 채움 + 체크마크.
 *  - hover(미완료): 완료될 모습을 미리보기.
 *  - 채움·체크마크 그리기 전환은 globals.css의 .que-done-circle CSS로 처리(reduced-motion 존중).
 *  - 완료로 바뀌는 순간에만 폭죽(되돌리기엔 생략). 낙관적 즉시 발사.
 *  - 부모 행 클릭(상세 Sheet)과 겹치지 않도록 z 처리 + stopPropagation은 호출부 배치로 담당. */
export function DoneCircle({
  done,
  pending,
  markLabel,
  unmarkLabel,
  onToggle,
  className,
}: {
  done: boolean;
  pending?: boolean;
  /** 미완료 상태에서의 aria-label (완료로 표시) */
  markLabel: string;
  /** 완료 상태에서의 aria-label (완료 해제) */
  unmarkLabel: string;
  /** 다음 완료 여부를 전달한다. true=완료로, false=완료 해제로. */
  onToggle: (nextDone: boolean) => void;
  className?: string;
}) {
  const toggle = (event: MouseEvent<HTMLButtonElement>) => {
    // 부모 행의 상세 트리거로 이벤트가 전파되지 않게 막는다.
    event.stopPropagation();
    const next = !done;
    if (next) burstConfetti(event.currentTarget);
    onToggle(next);
  };

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={pending}
      aria-pressed={done}
      aria-label={done ? unmarkLabel : markLabel}
      data-done={done ? "" : undefined}
      className={cn(
        "que-done-circle relative flex size-10 shrink-0 items-center justify-center rounded-full outline-none",
        "focus-visible:ring-2 focus-visible:ring-[var(--que-brand)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--que-bg)]",
        "disabled:cursor-not-allowed disabled:opacity-60",
        className,
      )}
    >
      <span className="que-done-circle-ring flex size-6 items-center justify-center rounded-full">
        <svg viewBox="0 0 24 24" className="size-4" aria-hidden focusable="false">
          <path className="que-done-circle-mark" d="M5 12.5 L10 17.5 L19 7.5" />
        </svg>
      </span>
    </button>
  );
}
