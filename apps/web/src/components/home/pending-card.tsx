import Link from "next/link";
import { AlertTriangle, Clock, Timer } from "lucide-react";
import type { HomePending } from "@/lib/home-grade-data";
import { cn } from "@/lib/utils";

// Home/Pending — 처리 대기(§C). 카드 3장(결제 대기·확인 필요 Action·장기 상태 응답 대기).
// '확인 필요'는 회의록 Action 고유 용어라 항상 풀네임 '확인 필요 Action'으로 쓴다(명세 §1).
// 색 의미 고정: amber=대기, red=장기 응답 대기(위험). 0건이면 큰 숫자는 중립으로 강등.

/** 처리 대기 3카드 + 하단 캡션·전체 보기 링크. */
export function PendingCard({ pending }: { pending: HomePending }) {
  const paymentSub =
    pending.overduePayments > 0 || pending.paymentOldestWaitDays > 0
      ? `마감 초과 ${pending.overduePayments}건 · 최장 대기 ${pending.paymentOldestWaitDays}일`
      : "대기 중인 결제가 없습니다";
  const actionSub =
    pending.needsReviewActions > 0
      ? `회의록 ${pending.actionSourceNoteCount}건에서 추출 · 담당/마감 미정`
      : "확인할 Action이 없습니다";
  const checkinSub =
    pending.longAwaitingCheckins > 0
      ? `최장 대기 ${pending.checkinOldestWaitDays}일`
      : "장기 응답 대기가 없습니다";

  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <PendingTile
          icon={<Clock className="size-4" aria-hidden />}
          title="결제 대기"
          value={pending.pendingPayments}
          valueTone={pending.pendingPayments > 0 ? "amber" : "neutral"}
          sub={paymentSub}
          subTone="muted"
          link={{ href: "/payments", label: "결제 요청 보기 →" }}
        />
        <PendingTile
          icon={<Timer className="size-4" aria-hidden />}
          title="확인 필요 Action"
          value={pending.needsReviewActions}
          valueTone="neutral"
          sub={actionSub}
          subTone={pending.needsReviewActions > 0 ? "amber" : "muted"}
          // 링크 없이 카드 전체가 /action 으로(명세 §C).
          cardHref="/action"
        />
        <PendingTile
          icon={<AlertTriangle className="size-4" aria-hidden />}
          title="장기 상태 응답 대기 (7일+)"
          value={pending.longAwaitingCheckins}
          valueTone={pending.longAwaitingCheckins > 0 ? "red" : "neutral"}
          sub={checkinSub}
          subTone="muted"
          danger={pending.longAwaitingCheckins > 0}
          link={{ href: "/team", label: "즉시 처리 필요 →" }}
        />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-xs text-[var(--que-text-tertiary)]">
          처리 대기 항목은 중요도 순으로 「우선 확인」에 반영됩니다
        </span>
        <Link
          href="/payments"
          className="text-xs font-medium text-[var(--que-brand)] hover:underline"
        >
          결제 현황 전체 보기 →
        </Link>
      </div>
    </div>
  );
}

function PendingTile({
  icon,
  title,
  value,
  valueTone,
  sub,
  subTone,
  link,
  cardHref,
  danger = false,
}: {
  icon: React.ReactNode;
  title: string;
  value: number;
  valueTone: "amber" | "red" | "neutral";
  sub: string;
  subTone: "amber" | "muted";
  link?: { href: string; label: string };
  cardHref?: string;
  danger?: boolean;
}) {
  const valueCls =
    valueTone === "red"
      ? "text-[var(--que-error)]"
      : valueTone === "amber"
        ? "text-[var(--que-warning)]"
        : "text-[var(--que-text)]";
  const subCls =
    subTone === "amber" ? "text-[var(--que-warning)]" : "text-[var(--que-text-tertiary)]";
  const iconCls = danger ? "text-[var(--que-error)]" : "text-[var(--que-text-tertiary)]";

  const body = (
    <>
      <span className={cn("flex items-center gap-1.5 text-sm font-medium", danger ? "text-[var(--que-error)]" : "text-[var(--que-text-secondary)]")}>
        <span className={iconCls}>{icon}</span>
        {title}
      </span>
      <span className={cn("mt-2 block text-3xl font-semibold tabular-nums", valueCls)}>
        {value}건
      </span>
      <span className={cn("mt-2 block text-xs", subCls)}>{sub}</span>
      {link && (
        <Link
          href={link.href}
          className={cn(
            "mt-3 inline-flex min-h-9 items-center text-xs font-medium hover:underline",
            danger ? "text-[var(--que-error)]" : "text-[var(--que-brand)]",
          )}
        >
          {link.label}
        </Link>
      )}
    </>
  );

  const boxCls = cn(
    "flex min-h-[9rem] flex-col rounded-xl border p-4",
    danger
      ? "border-[var(--que-error)] bg-[var(--que-error-bg)]"
      : "border-[var(--que-border)] bg-[var(--que-bg)]",
  );

  // 링크 없이 카드 전체가 이동인 경우(확인 필요 Action) — 카드를 Link로 감싼다.
  if (cardHref) {
    return (
      <Link
        href={cardHref}
        className={cn(
          boxCls,
          "transition-colors hover:bg-[var(--que-bg-muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        )}
      >
        {body}
      </Link>
    );
  }
  return <div className={boxCls}>{body}</div>;
}
