import Link from "next/link";
import {
  AlertTriangle,
  CalendarClock,
  CalendarX,
  CircleCheck,
  FileText,
  Hand,
  MessageCircle,
  Pause,
  TriangleAlert,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import type { AlertTone } from "@/lib/alerts-data";

// Home/Priority — 지금 응답·조정·결정할 항목 행. 사원(AlertItem)·관리자·대표(PriorityItem)가 공유한다.
// 유형 뱃지는 색 단독이 아니라 아이콘+텍스트로 표기(명세 §7 — 색상만으로 구분 금지).

// 상태색 의미 고정: red=문제, amber=주의/대기(기한초과·결제·선행지연·충돌·홀드),
// violet=회의록/응답대기, blue=정보(도움 요청), green=완료(입금).
const TONE: Record<AlertTone, string> = {
  red: "border-[var(--que-error)] bg-[var(--que-error-bg)] text-[var(--que-error)]",
  amber: "border-[var(--que-warning)] bg-[var(--que-warning-bg)] text-[var(--que-warning)]",
  violet: "border-[var(--que-violet)] bg-[var(--que-violet-bg)] text-[var(--que-violet)]",
  blue: "border-[var(--que-brand)] bg-[var(--que-brand-subtle)] text-[var(--que-brand)]",
  green: "border-[var(--que-success)] bg-[var(--que-success-bg)] text-[var(--que-success)]",
};

// AlertKind ∪ PriorityKind 를 모두 덮는 아이콘 맵.
const KIND_ICON: Record<string, LucideIcon> = {
  issue: AlertTriangle,
  on_hold: Pause,
  needs_review: FileText,
  overdue: TriangleAlert,
  payment: Wallet,
  payment_status: CircleCheck,
  help_request: Hand,
  schedule_risk: CalendarClock,
  conflict: CalendarX,
  awaiting_checkin: MessageCircle,
  checkin: MessageCircle,
};

/** 우선 확인 행(사원 AlertItem·관리자/대표 PriorityItem 공통 최소 형태). */
export interface PriorityRow {
  id: string;
  kind: string;
  tone: AlertTone;
  title: string;
  description: string;
  href: string;
}

/** Home/Priority 리스트 — 최대 5건 + 전체 보기. 내부 세로 스크롤. */
export function PriorityList({
  items,
  total,
  viewAllHref,
  emptyText = "지금 확인할 요청이 없습니다.",
}: {
  items: PriorityRow[];
  total: number;
  viewAllHref: string;
  emptyText?: string;
}) {
  if (items.length === 0) {
    return (
      <div className="flex min-h-[96px] items-center justify-center rounded-lg border border-dashed border-[var(--que-border)] text-sm text-[var(--que-text-tertiary)]">
        {emptyText}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <ul className="flex max-h-[380px] flex-col gap-2 overflow-y-auto pr-0.5">
        {items.map((item) => {
          const Icon = KIND_ICON[item.kind] ?? TriangleAlert;
          return (
            <li key={item.id}>
              <Link
                href={item.href}
                className="flex min-h-11 items-center gap-2.5 rounded-lg border border-[var(--que-border)] px-3 py-2 transition-colors hover:bg-[var(--que-bg-muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <span
                  className={
                    "inline-flex shrink-0 items-center gap-1 rounded-md border px-1.5 py-0.5 text-xs font-medium " +
                    TONE[item.tone]
                  }
                >
                  <Icon className="size-3.5" aria-hidden />
                  {item.title}
                </span>
                <span className="min-w-0 flex-1 truncate text-sm text-[var(--que-text-secondary)]">
                  {item.description}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
      {total > items.length && (
        <Link
          href={viewAllHref}
          className="flex min-h-9 items-center justify-center rounded-lg text-sm font-medium text-[var(--que-brand)] hover:underline"
        >
          전체 보기 ({total})
        </Link>
      )}
    </div>
  );
}
