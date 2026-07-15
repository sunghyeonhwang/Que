"use client";

import { useMemo, useState } from "react";
import { Download } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

// 세무회계용 결제내역 CSV 다운로드(관리자 전용) — 기간 단위(월/분기/연) + 기간 선택 → GET 라우트로 내려받는다.
// 기간 계산은 KST 달력 기준. from은 기간 시작(포함), to는 다음 기간 시작(배타)으로 라우트에 넘긴다.

type Unit = "month" | "quarter" | "year";
const UNIT_ITEMS: Record<Unit, string> = { month: "월", quarter: "분기", year: "연" };
const pad = (n: number) => String(n).padStart(2, "0");
const ymd = (y: number, m1: number, d: number) => `${y}-${pad(m1)}-${pad(d)}`;

interface Period {
  value: string; // 라벨 겸 키(2026-07 / 2026-Q3 / 2026)
  label: string; // 표시용
  from: string; // YYYY-MM-DD 포함
  to: string; // YYYY-MM-DD 배타(다음 기간 시작)
}

/** 최근 기간 목록(단위별)을 KST 오늘 기준으로 생성. */
function buildPeriods(unit: Unit, today: { y: number; m: number }): Period[] {
  const out: Period[] = [];
  if (unit === "month") {
    let y = today.y;
    let m = today.m; // 1-based
    for (let i = 0; i < 24; i++) {
      const ny = m === 12 ? y + 1 : y;
      const nm = m === 12 ? 1 : m + 1;
      out.push({
        value: `${y}-${pad(m)}`,
        label: `${y}년 ${m}월`,
        from: ymd(y, m, 1),
        to: ymd(ny, nm, 1),
      });
      m -= 1;
      if (m < 1) {
        m = 12;
        y -= 1;
      }
    }
  } else if (unit === "quarter") {
    let y = today.y;
    let q = Math.floor((today.m - 1) / 3) + 1; // 1~4
    for (let i = 0; i < 12; i++) {
      const startM = (q - 1) * 3 + 1;
      const ny = q === 4 ? y + 1 : y;
      const nStartM = q === 4 ? 1 : startM + 3;
      out.push({
        value: `${y}-Q${q}`,
        label: `${y}년 ${q}분기`,
        from: ymd(y, startM, 1),
        to: ymd(ny, nStartM, 1),
      });
      q -= 1;
      if (q < 1) {
        q = 4;
        y -= 1;
      }
    }
  } else {
    for (let i = 0; i < 6; i++) {
      const y = today.y - i;
      out.push({
        value: `${y}`,
        label: `${y}년`,
        from: ymd(y, 1, 1),
        to: ymd(y + 1, 1, 1),
      });
    }
  }
  return out;
}

export function PaymentExportPanel() {
  // KST 오늘(연·월). 서버 TZ=Asia/Seoul이지만 클라이언트라 Intl로 KST 벽시계를 뽑는다.
  const today = useMemo(() => {
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Seoul",
      year: "numeric",
      month: "2-digit",
    }).format(new Date());
    const [y, m] = parts.split("-").map(Number);
    return { y, m };
  }, []);

  const [unit, setUnit] = useState<Unit>("month");
  const periods = useMemo(() => buildPeriods(unit, today), [unit, today]);
  const [periodValue, setPeriodValue] = useState(periods[0]?.value ?? "");

  // 단위를 바꾸면 그 단위의 최신 기간으로 맞춘다(선택값이 목록에 없으면 첫 항목).
  const selected =
    periods.find((p) => p.value === periodValue) ?? periods[0];
  const periodItems = Object.fromEntries(periods.map((p) => [p.value, p.label]));

  const href = selected
    ? `/api/payments/export?from=${selected.from}&to=${selected.to}&label=${encodeURIComponent(selected.value)}`
    : "#";

  return (
    <div className="mb-4 flex flex-wrap items-end gap-2 rounded-xl border border-[var(--que-border)] bg-[var(--que-bg)] p-3">
      <div className="flex flex-col gap-1">
        <span className="text-xs font-medium text-[var(--que-text-tertiary)]">단위</span>
        <Select
          items={UNIT_ITEMS}
          value={unit}
          onValueChange={(v) => {
            const nextUnit = (v as Unit) ?? "month";
            setUnit(nextUnit);
            setPeriodValue(buildPeriods(nextUnit, today)[0]?.value ?? "");
          }}
        >
          <SelectTrigger aria-label="기간 단위" className="!h-10 w-24 rounded-lg text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {(Object.keys(UNIT_ITEMS) as Unit[]).map((u) => (
              <SelectItem key={u} value={u}>
                {UNIT_ITEMS[u]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="flex min-w-40 flex-1 flex-col gap-1">
        <span className="text-xs font-medium text-[var(--que-text-tertiary)]">기간</span>
        <Select
          items={periodItems}
          value={selected?.value ?? ""}
          onValueChange={(v) => v && setPeriodValue(v)}
        >
          <SelectTrigger aria-label="기간 선택" className="!h-10 w-full rounded-lg text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {periods.map((p) => (
              <SelectItem key={p.value} value={p.value}>
                {p.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <a
        href={href}
        download
        aria-label="선택한 기간 결제내역 CSV 다운로드"
        className={cn(buttonVariants({ variant: "default" }), "h-10 gap-1.5 rounded-lg")}
      >
        <Download className="size-4" aria-hidden />
        CSV 다운로드
      </a>
    </div>
  );
}
