"use client";

import { useState } from "react";
import Link from "next/link";
import { Bell } from "lucide-react";
import type { AlertsData, AlertItem, AlertTone } from "@/lib/alerts-data";
import { markAlertsReadAction } from "@/app/(app)/notifications/actions";
import { useOptimisticAction } from "@/components/app/use-optimistic-action";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

const TONE_DOT: Record<AlertTone, string> = {
  red: "bg-[var(--que-error)]",
  amber: "bg-[var(--que-warning)]",
  violet: "bg-[var(--que-violet)]",
  blue: "bg-[var(--que-brand)]",
  green: "bg-[var(--que-success)]",
};

/** 상단바 알림 — 운영 신호(문제/기한초과/확인필요/결제)를 목록으로 보여주고 각 화면으로 이동.
 *  뱃지 = 안읽음 수(C-3a). 전체·읽음 처리는 알림 센터(/notifications)에서. */
export function NotificationsBell({ alerts }: { alerts: AlertsData }) {
  const [open, setOpen] = useState(false);
  const { items, count, unreadCount } = alerts;
  const { run } = useOptimisticAction();
  // 항목 클릭 즉시 강조 제거·뱃지 감소(로컬). 서버 읽음 커밋은 백그라운드, 실패 시 롤백.
  const [readIds, setReadIds] = useState<Set<string>>(new Set());
  const [localUnread, setLocalUnread] = useState(unreadCount);

  const isRead = (alert: AlertItem) => alert.read || readIds.has(alert.id);

  const openAndRead = (alert: AlertItem) => {
    setOpen(false);
    if (isRead(alert)) return;
    run(() => markAlertsReadAction([alert.id]), {
      apply: () => {
        setReadIds((prev) => new Set(prev).add(alert.id));
        setLocalUnread((n) => Math.max(0, n - 1));
      },
      rollback: () => {
        setReadIds((prev) => {
          const next = new Set(prev);
          next.delete(alert.id);
          return next;
        });
        setLocalUnread((n) => n + 1);
      },
      source: "alert-bell-read",
    });
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <Button
            variant="ghost"
            aria-label={localUnread > 0 ? `알림 — 새 알림 ${localUnread}건` : "알림"}
            className="relative size-11 rounded-full text-[var(--que-text-secondary)] hover:bg-[var(--que-bg-muted)]"
          />
        }
      >
        <Bell className="size-5" aria-hidden />
        {localUnread > 0 && (
          <span className="absolute top-1.5 right-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-[var(--que-error)] px-1 text-[10px] font-semibold text-white tabular-nums">
            {localUnread > 9 ? "9+" : localUnread}
          </span>
        )}
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 gap-0 p-0">
        <div className="flex items-center justify-between border-b border-[var(--que-border)] px-3.5 py-2.5">
          <span className="text-sm font-semibold text-[var(--que-text)]">알림</span>
          <span className="text-xs text-[var(--que-text-tertiary)] tabular-nums">{count}건</span>
        </div>

        {items.length === 0 ? (
          <p className="px-3.5 py-8 text-center text-sm text-[var(--que-text-tertiary)]">
            새 알림이 없습니다.
          </p>
        ) : (
          <ul className="max-h-[60vh] overflow-y-auto py-1">
            {items.map((alert) => {
              const read = isRead(alert);
              return (
                <li key={alert.id}>
                  <Link
                    href={alert.href}
                    onClick={() => openAndRead(alert)}
                    className={`flex gap-2.5 px-3.5 py-2.5 hover:bg-[var(--que-bg-muted)] focus-visible:bg-[var(--que-bg-muted)] focus-visible:outline-none ${
                      read ? "" : "bg-[var(--que-brand-subtle)]/40"
                    }`}
                  >
                    <span
                      className={`mt-1.5 size-2 shrink-0 rounded-full ${TONE_DOT[alert.tone]}`}
                      aria-hidden
                    />
                    <span className="min-w-0 flex-1">
                      <span
                        className={`block text-sm text-[var(--que-text)] ${read ? "font-normal" : "font-semibold"}`}
                      >
                        {alert.title}
                      </span>
                      <span className="block truncate text-xs text-[var(--que-text-secondary)]">
                        {alert.description}
                      </span>
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}

        <Link
          href="/notifications"
          onClick={() => setOpen(false)}
          className="block border-t border-[var(--que-border)] px-3.5 py-2.5 text-center text-sm font-medium text-[var(--que-brand)] hover:bg-[var(--que-bg-muted)] focus-visible:bg-[var(--que-bg-muted)] focus-visible:outline-none"
        >
          {count > items.length ? `모두 보기 (${count}건) →` : "모두 보기 →"}
        </Link>
      </PopoverContent>
    </Popover>
  );
}
