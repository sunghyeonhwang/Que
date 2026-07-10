"use client";

import Link from "next/link";
import { useTransition } from "react";
import { CheckCheck } from "lucide-react";
import type { AlertItem, AlertTone } from "@/lib/alerts-data";
import { markAlertsReadAction, markAllAlertsReadAction } from "@/app/(app)/notifications/actions";
import { Button } from "@/components/ui/button";

// 알림 센터 목록 — C-3a. 안읽음은 점·배경으로 강조(색상 단독 아님 — '새 알림' 라벨 병행).
// 항목 클릭 = 읽음 처리 + 해당 화면 이동. '모두 읽음'은 현재 목록 전체를 읽음으로.

const TONE_DOT: Record<AlertTone, string> = {
  red: "bg-[var(--que-error)]",
  amber: "bg-[var(--que-warning)]",
  violet: "bg-[var(--que-violet)]",
};

export function NotificationList({
  items,
  unreadCount,
}: {
  items: AlertItem[];
  unreadCount: number;
}) {
  const [pending, startTransition] = useTransition();

  const readOne = (id: string) => {
    // 이동을 막지 않는다 — 읽음 마크는 백그라운드로(Link 내비게이션과 병행).
    startTransition(async () => {
      await markAlertsReadAction([id]);
    });
  };
  const readAll = () => {
    startTransition(async () => {
      await markAllAlertsReadAction();
    });
  };

  if (items.length === 0) {
    return (
      <div className="rounded-xl border border-[var(--que-border)] bg-[var(--que-bg)] px-6 py-12 text-center">
        <p className="text-sm font-medium text-[var(--que-text)]">지금 주의할 알림이 없습니다.</p>
        <p className="mt-1.5 text-sm text-[var(--que-text-secondary)]">
          문제 발생·기한 초과·확인 필요·결제 마감이 생기면 여기에 표시됩니다.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between px-1">
        <span className="text-sm text-[var(--que-text-secondary)] tabular-nums">
          전체 {items.length}건
          {unreadCount > 0 && (
            <b className="font-medium text-[var(--que-text)]"> · 새 알림 {unreadCount}건</b>
          )}
        </span>
        {unreadCount > 0 && (
          <Button variant="outline" className="h-10" onClick={readAll} disabled={pending}>
            <CheckCheck className="size-4" aria-hidden />
            모두 읽음
          </Button>
        )}
      </div>

      <ul className="overflow-hidden rounded-xl border border-[var(--que-border)] bg-[var(--que-bg)]">
        {items.map((alert) => (
          <li key={alert.id} className="border-b border-[var(--que-border)] last:border-b-0">
            <Link
              href={alert.href}
              onClick={() => {
                if (!alert.read) readOne(alert.id);
              }}
              className={`flex min-h-[52px] items-center gap-3 px-4 py-3 hover:bg-[var(--que-bg-muted)] focus-visible:bg-[var(--que-bg-muted)] focus-visible:outline-none ${
                alert.read ? "" : "bg-[var(--que-brand-subtle)]/40"
              }`}
            >
              <span
                className={`size-2 shrink-0 rounded-full ${TONE_DOT[alert.tone]}`}
                aria-hidden
              />
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-2">
                  <span
                    className={`text-sm text-[var(--que-text)] ${alert.read ? "font-normal" : "font-semibold"}`}
                  >
                    {alert.title}
                  </span>
                  {!alert.read && (
                    <span className="rounded-full bg-[var(--que-brand)] px-1.5 py-px text-[10px] font-semibold text-white">
                      새 알림
                    </span>
                  )}
                </span>
                <span className="block truncate text-sm text-[var(--que-text-secondary)]">
                  {alert.description}
                </span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
