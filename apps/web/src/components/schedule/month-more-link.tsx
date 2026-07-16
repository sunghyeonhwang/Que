"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";

/** 월간 셀의 "+N개 더" — 클릭 시 해당 날짜 일간 보기로 이동한다(다른 파라미터 보존, range·date만 교체).
 * 텍스트 링크라 터치 타깃이 작아도 허용(월간 목록 밀도 유지). */
export function MonthMoreLink({
  dateKey,
  count,
}: {
  /** 대상 날짜 YYYY-MM-DD */
  dateKey: string;
  /** 잘려서 안 보이는 이벤트 수 */
  count: number;
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const params = new URLSearchParams(searchParams.toString());
  params.set("range", "day");
  params.set("date", dateKey);

  const [, m, d] = dateKey.split("-").map(Number);

  return (
    <Link
      href={`${pathname}?${params.toString()}`}
      aria-label={`${m}월 ${d}일 일간 보기로 이동`}
      className="px-1 text-left text-[10px] text-[var(--que-text-tertiary)] hover:text-[var(--que-text-secondary)] hover:underline"
    >
      +{count}개 더
    </Link>
  );
}
