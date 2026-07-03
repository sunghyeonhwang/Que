"use client";

import { useState } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

/** 카드별 기간/월 드롭다운 — 표시용(비기능). 로컬 상태만 바꾸고 데이터는 갱신하지 않는다. */
export function PeriodSelect({
  options,
  defaultValue,
  ariaLabel,
}: {
  options: { value: string; label: string }[];
  defaultValue: string;
  ariaLabel: string;
}) {
  const [value, setValue] = useState(defaultValue);
  return (
    <Select value={value} onValueChange={(v) => setValue(v as string)}>
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
