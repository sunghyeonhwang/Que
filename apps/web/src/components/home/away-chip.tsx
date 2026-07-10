import { PlaneTakeoff } from "lucide-react";
import type { HomeAwayChip } from "@/lib/home-grade-data";

/** 오늘 일정 카드 하단 부재 칩(전 역할 공통, 명세 §2). 자리비움·외부 일정을 한 줄로.
 *  비공개 자리비움은 사유 없이 이름·시간대만(데이터 계층에서 이미 마스킹). 없으면 렌더하지 않는다. */
export function AwayChip({ chip }: { chip: HomeAwayChip }) {
  if (chip.away.length === 0 && chip.external.length === 0) return null;

  const parts: string[] = [];
  if (chip.away.length > 0) {
    parts.push(`자리비움: ${chip.away.map((a) => `${a.name}(${a.when})`).join(" · ")}`);
  }
  if (chip.external.length > 0) {
    parts.push(`외부: ${chip.external.map((e) => `${e.name} ${e.when}`).join(" · ")}`);
  }

  return (
    <p className="mt-3 flex items-start gap-1.5 border-t border-[var(--que-border)] pt-3 text-xs text-[var(--que-text-tertiary)]">
      <PlaneTakeoff className="mt-0.5 size-3.5 shrink-0" aria-hidden />
      <span>
        <span className="font-medium text-[var(--que-text-secondary)]">오늘 부재</span> —{" "}
        {parts.join(" · ")}
      </span>
    </p>
  );
}
