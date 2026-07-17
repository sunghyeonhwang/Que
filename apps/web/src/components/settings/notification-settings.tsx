"use client";

import { useState } from "react";
import { Bell, Check } from "lucide-react";
import { setMyNotificationPrefs } from "@/app/(app)/settings/notification-actions";
import type { MyNotificationPrefs } from "@/app/(app)/settings/notification-actions";
import { useSafeAction } from "@/components/app/use-safe-action";
import { cn } from "@/lib/utils";

/**
 * 설정 > 알림 — 본인 정기 안내 알림 개인 설정.
 * MUTABLE 4종만 개인이 끌 수 있고, 업무 진행에 필요한 알림(결제·도움 요청·회의록 등)은 끌 수 없다.
 * 토글은 즉시 저장(setMyNotificationPrefs 전체 교체) + 실패 시 이전 상태로 되돌린다(useSafeAction).
 * mock/dev(enabled=false)에서는 저장이 동작하지 않으므로 토글을 비활성화하고 안내한다.
 */
export function NotificationSettings({ prefs }: { prefs: MyNotificationPrefs }) {
  const { run, pending } = useSafeAction();
  const [muted, setMuted] = useState<Set<string>>(() => new Set(prefs.mutedKinds));

  function toggle(kind: string, nextOn: boolean) {
    // nextOn = "받기"(muted에서 제거). off면 muted에 추가. 낙관적 반영 후 전체 목록 저장.
    const before = new Set(muted);
    const next = new Set(muted);
    if (nextOn) next.delete(kind);
    else next.add(kind);
    setMuted(next);
    run(() => setMyNotificationPrefs([...next]), {
      success: "알림 설정을 저장했습니다.",
      refresh: false,
      onError: () => setMuted(before),
    });
  }

  return (
    <section className="flex flex-col gap-6">
      <div className="rounded-xl border border-[var(--que-border)] bg-[var(--que-bg)] p-5 shadow-[var(--que-shadow-sm)]">
        <h2 className="flex items-center gap-2 text-base font-semibold text-[var(--que-text)]">
          <span className="flex size-8 items-center justify-center rounded-lg bg-[var(--que-brand-subtle)] text-[var(--que-brand)]">
            <Bell className="size-[18px]" aria-hidden />
          </span>
          알림
        </h2>
        <p className="mt-1.5 text-sm text-[var(--que-text-secondary)]">
          정기 안내 알림을 개인별로 끌 수 있습니다. 결제·도움 요청·회의록처럼 업무 진행에 필요한
          알림은 끌 수 없습니다.
        </p>

        {!prefs.enabled && (
          <p className="mt-4 rounded-lg bg-[var(--que-bg-muted)] px-3.5 py-2.5 text-sm text-[var(--que-text-tertiary)]">
            이 환경에서는 알림 설정이 동작하지 않습니다. 실제 배포 환경에서만 저장됩니다.
          </p>
        )}

        <ul className="mt-4 flex flex-col gap-2">
          {prefs.options.map((opt) => {
            const on = !muted.has(opt.kind);
            return (
              <li
                key={opt.kind}
                className="flex items-center justify-between gap-3 rounded-lg border border-[var(--que-border)] px-3.5 py-3"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium text-[var(--que-text)]">{opt.label}</p>
                  <p className="mt-0.5 text-sm text-[var(--que-text-tertiary)]">
                    {opt.description}
                  </p>
                </div>
                <Toggle
                  checked={on}
                  label={`${opt.label} 받기`}
                  disabled={!prefs.enabled || pending}
                  onChange={(next) => toggle(opt.kind, next)}
                />
              </li>
            );
          })}
        </ul>

        <details className="mt-4 rounded-lg border border-[var(--que-border)] px-3.5 py-3">
          <summary className="cursor-pointer text-sm font-medium text-[var(--que-text)]">
            항상 받는 알림
          </summary>
          <p className="mt-2 text-sm text-[var(--que-text-secondary)]">
            결제 요청, 새 작업 배정, 도움 요청, 회의록, 긴급 결정처럼 당사자가 응답해야 업무가
            진행되는 알림은 개인이 끌 수 없습니다. 이런 신호를 놓치면 팀의 일이 멈추기 때문입니다.
            팀 채널에 올라가는 스탠드업·주간 안내도 이 화면에서는 끄지 않습니다.
          </p>
        </details>
      </div>
    </section>
  );
}

/** 켜기/끄기 스위치 — role="switch" + 40px 터치 타깃. checked=받는 중, unchecked=끔. */
function Toggle({
  checked,
  label,
  disabled,
  onChange,
}: {
  checked: boolean;
  label: string;
  disabled?: boolean;
  onChange: (next: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        "relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors",
        "after:absolute after:-inset-2.5", // 40px 터치 타깃 확장
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--que-brand)]",
        "disabled:cursor-not-allowed disabled:opacity-50",
        checked ? "bg-[var(--que-brand)]" : "bg-[var(--que-border-strong)]",
      )}
    >
      <span
        className={cn(
          "flex size-5 items-center justify-center rounded-full bg-white shadow-sm transition-transform",
          checked ? "translate-x-[22px]" : "translate-x-0.5",
        )}
      >
        {checked && <Check className="size-3 text-[var(--que-brand)]" aria-hidden />}
      </span>
    </button>
  );
}
