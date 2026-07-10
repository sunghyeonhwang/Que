import Link from "next/link";
import type { HomeKpi } from "@/lib/home-grade-data";
import { cn } from "@/lib/utils";

// tone → 수치 강조색. 색 단독이 아니라 라벨 텍스트와 함께 의미를 전달한다(명세 §7).
// 상태색 의미 고정: danger=문제/기한초과(red), warning=주의/대기(amber), success=완료(green),
// info=정보/예정(blue), default=중립.
const TONE_VALUE: Record<NonNullable<HomeKpi["tone"]>, string> = {
  danger: "text-[var(--que-error)]",
  warning: "text-[var(--que-warning)]",
  success: "text-[var(--que-success)]",
  info: "text-[var(--que-brand)]",
  default: "text-[var(--que-text)]",
};

// 열 수(명세 §7): 768(base)=2열, 1024(lg)=3열, xl(1280+)=사원 4·관리자/대표 6열.
const XL_COLS: Record<4 | 6, string> = {
  4: "xl:grid-cols-4",
  6: "xl:grid-cols-6",
};

/** Home/KPIGroup — 핵심 현황 compact 스트립. 숫자만 두지 않고 관련 필터 화면으로 연결(href). */
export function KpiStrip({
  items,
  cols = 6,
  ariaLabel = "핵심 현황",
}: {
  items: HomeKpi[];
  cols?: 4 | 6;
  ariaLabel?: string;
}) {
  return (
    <section
      aria-label={ariaLabel}
      className={cn("grid grid-cols-2 gap-3 lg:grid-cols-3", XL_COLS[cols])}
    >
      {items.map((kpi) => {
        const valueClass = TONE_VALUE[kpi.tone ?? "default"];
        const body = (
          <>
            <p className="truncate text-xs text-[var(--que-text-secondary)]">{kpi.label}</p>
            <p className={cn("mt-1 text-2xl font-semibold tabular-nums", valueClass)}>
              {kpi.value}
            </p>
          </>
        );
        const boxClass =
          "flex min-h-[76px] flex-col justify-center rounded-xl border border-[var(--que-border)] bg-[var(--que-bg)] p-3 shadow-[var(--que-shadow-sm)]";
        return kpi.href ? (
          <Link
            key={kpi.key}
            href={kpi.href}
            className={cn(
              boxClass,
              "transition-colors hover:bg-[var(--que-bg-muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            )}
          >
            {body}
          </Link>
        ) : (
          <div key={kpi.key} className={boxClass}>
            {body}
          </div>
        );
      })}
    </section>
  );
}
