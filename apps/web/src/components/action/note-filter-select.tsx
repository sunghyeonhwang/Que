"use client";

import { useRouter } from "next/navigation";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export interface NoteFilterOption {
  value: string; // "all" | meetingNoteId
  label: string;
}

/** /action 회의록 필터 — 미처리가 남은 회의록만(+전체) 드롭다운. 선택 변경 = ?note= 딥링크로 내비.
 *  옵션 조립·미처리 카운트는 서버가 계산(페이지)하고, 여기선 표시·내비만 한다. */
export function NoteFilterSelect({
  value,
  options,
}: {
  value: string;
  options: NoteFilterOption[];
}) {
  const router = useRouter();
  const items = Object.fromEntries(options.map((o) => [o.value, o.label]));
  return (
    <div className="mb-4">
      <Select
        items={items}
        value={value}
        onValueChange={(v) => {
          if (v) router.push(`/action?note=${v}`);
        }}
      >
        <SelectTrigger
          aria-label="회의록 필터"
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
    </div>
  );
}
