"use client";

import { useSyncExternalStore } from "react";
import Link from "next/link";
import { ArrowRight, Check, X } from "lucide-react";
import type { OnboardingData } from "@/lib/onboarding-data";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// 홈 온보딩 카드("이번 주는 이것만") — 노출 기간은 서버(page.tsx)가 판정하고,
// 이 컴포넌트는 [닫기] 영구 숨김(localStorage)만 담당한다(기획 onboarding-plan §4-1).

/** 닫기 상태 기억(localStorage). SSR 안전하게 useSyncExternalStore로 구독.
 *  react-hooks/set-state-in-effect를 피하려고 effect 없이 외부 스토어로 처리한다. */
const DISMISS_KEY = "que-onboarding-dismissed";
const DISMISS_EVENT = "que:onboarding-dismiss-change";

function readDismissed(): boolean {
  if (typeof window === "undefined") return false;
  return window.localStorage.getItem(DISMISS_KEY) === "1";
}

function subscribeDismissed(onChange: () => void): () => void {
  window.addEventListener(DISMISS_EVENT, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(DISMISS_EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}

function useDismissed(): [boolean, () => void] {
  const dismissed = useSyncExternalStore(
    subscribeDismissed,
    readDismissed,
    () => false, // 서버/하이드레이션 스냅샷 — 항상 노출로 시작(닫힘은 클라이언트에서 반영).
  );
  const dismiss = () => {
    window.localStorage.setItem(DISMISS_KEY, "1");
    window.dispatchEvent(new Event(DISMISS_EVENT));
  };
  return [dismissed, dismiss];
}

interface Step {
  n: string;
  title: string;
  href: string;
  /** true면 완료 톤(초록 체크). false면 중립 톤(링크 화살표). */
  done: boolean;
  /** 완료 뱃지 대신 항상 보이는 보조 문구(막힘 항목처럼 강제하지 않는 항목). */
  helper?: string;
}

export function OnboardingCard({ data }: { data: OnboardingData }) {
  const [dismissed, dismiss] = useDismissed();
  if (dismissed) return null;

  const steps: Step[] = [
    {
      n: "1",
      title: "매일 10시, 체크인 30초",
      href: "/daily",
      done: data.checkedIn,
    },
    {
      n: "2",
      title: "작업이 끝나면 완료 체크",
      href: "/today",
      done: data.markedDone,
    },
    {
      n: "3",
      title: "막히면 막힘 칸에 쓰기",
      href: "/daily",
      // 막힘은 없을 수도 있어 완료를 강제하지 않는다 — 쓴 적 있으면 긍정 표시만.
      done: data.sharedBlocker,
      helper: "막힌 게 없으면 비워두면 됩니다.",
    },
  ];

  return (
    <section className="rounded-xl border border-[var(--que-border)] bg-[var(--que-bg)] shadow-[var(--que-shadow-sm)]">
      <header className="flex items-start justify-between gap-3 px-4 pt-4">
        <div>
          <h2 className="text-base font-semibold text-[var(--que-text)]">
            이번 주는 이것만 — 3가지면 충분합니다
          </h2>
          <p className="mt-1 text-sm text-[var(--que-text-secondary)]">
            베타 기간 동안 이 세 가지 습관만 익히면 됩니다.
          </p>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label="온보딩 카드 닫기"
          onClick={dismiss}
          className="size-10 shrink-0 text-[var(--que-text-tertiary)]"
        >
          <X className="size-4" />
        </Button>
      </header>

      <ol className="grid grid-cols-1 gap-2 p-4 md:grid-cols-3">
        {steps.map((s) => (
          <li key={s.n}>
            <Link
              href={s.href}
              className={cn(
                "group flex min-h-[40px] items-center gap-3 rounded-lg border px-3 py-2.5 transition-colors",
                s.done
                  ? "border-[var(--que-success)]/30 bg-[var(--que-success)]/5"
                  : "border-[var(--que-border)] bg-[var(--que-bg-muted)] hover:border-[var(--que-text-tertiary)]",
              )}
            >
              <span
                aria-hidden
                className={cn(
                  "flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold",
                  s.done
                    ? "bg-[var(--que-success)] text-white"
                    : "bg-[var(--que-bg)] text-[var(--que-text-secondary)] ring-1 ring-[var(--que-border)]",
                )}
              >
                {s.done ? <Check className="size-4" /> : s.n}
              </span>

              <span className="min-w-0 flex-1">
                <span className="block text-sm font-medium text-[var(--que-text)]">
                  {s.title}
                </span>
                {s.helper && (
                  <span className="mt-0.5 block text-xs text-[var(--que-text-tertiary)]">
                    {s.done ? "막힘을 공유했습니다." : s.helper}
                  </span>
                )}
              </span>

              <ArrowRight
                className={cn(
                  "size-4 shrink-0 transition-transform group-hover:translate-x-0.5",
                  s.done
                    ? "text-[var(--que-success)]"
                    : "text-[var(--que-text-tertiary)]",
                )}
              />
              {s.done && <span className="sr-only">완료됨</span>}
            </Link>
          </li>
        ))}
      </ol>
    </section>
  );
}
