"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

/** 카드별 기간/월 드롭다운 — URL 파라미터로 구동. 선택 시 해당 param을 set하고
 * 현재 경로로 push한다. value는 페이지가 URL에서 읽어 controlled로 내려준다. */
export function PeriodSelect({
  param,
  options,
  value,
  ariaLabel,
}: {
  param: string;
  options: { value: string; label: string }[];
  value: string;
  ariaLabel: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const onValueChange = (next: string | null) => {
    if (next == null) return;
    const params = new URLSearchParams(searchParams.toString());
    params.set(param, next);
    router.push(`${pathname}?${params.toString()}`, { scroll: false });
  };

  return (
    <Select value={value} onValueChange={onValueChange}>
      <SelectTrigger
        aria-label={ariaLabel}
        className="h-10 min-h-10 gap-1.5 border-[var(--que-border)] text-[var(--que-text-secondary)]"
      >
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {options.map((o) => (
          <SelectItem key={o.value} value={o.value}>
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
