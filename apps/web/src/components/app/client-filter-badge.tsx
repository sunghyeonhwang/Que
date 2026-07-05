import { Building2 } from "lucide-react";

/**
 * 현재 클라이언트 필터 기준 표시 배지. 성과·홈 상단에 두어 "지금 보는 집계가 어느 범위인지"를
 * 드러낸다(작업목록 5건인데 KPI 40건 같은 오독 방지). clientName이 null이면 "전체 기준".
 * 상태색이 아닌 중립 토큰만 사용한다.
 */
export function ClientFilterBadge({ clientName }: { clientName: string | null }) {
  const active = clientName !== null;
  return (
    <span
      className={
        "inline-flex h-7 items-center gap-1.5 rounded-full border px-3 text-xs font-medium " +
        (active
          ? "border-[var(--que-brand)]/30 bg-[var(--que-brand-subtle)] text-[var(--que-brand)]"
          : "border-[var(--que-border)] bg-[var(--que-bg-muted)] text-[var(--que-text-secondary)]")
      }
    >
      <Building2 className="size-3.5" aria-hidden />
      <span>{active ? `${clientName} 기준` : "전체 기준"}</span>
    </span>
  );
}
