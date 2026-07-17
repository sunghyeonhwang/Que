"use client";

import { useRouter } from "next/navigation";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export interface DecisionProjectOption {
  value: string; // "all" | projectId
  label: string;
}

/** 결정 로그 프로젝트 필터 — 선택 변경 = `/meeting-notes?tab=decisions&project=` 딥링크로 내비.
 *  옵션 조립은 서버(page)가 맡고, 여기선 표시·내비만 한다. */
export function DecisionProjectFilter({
  value,
  options,
}: {
  value: string;
  options: DecisionProjectOption[];
}) {
  const router = useRouter();
  const items = Object.fromEntries(options.map((o) => [o.value, o.label]));
  return (
    <Select
      items={items}
      value={value}
      onValueChange={(v) => {
        if (!v) return;
        const base = "/meeting-notes?tab=decisions";
        router.push(v === "all" ? base : `${base}&project=${v}`);
      }}
    >
      <SelectTrigger
        aria-label="프로젝트 필터"
        size="lg"
        className="h-10 w-full max-w-sm rounded-lg text-sm"
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
