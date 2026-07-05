import Link from "next/link";
import { format } from "date-fns";
import { ko } from "date-fns/locale";
import { TriangleAlert, Clock } from "lucide-react";
import type { MilestoneRow } from "@/lib/planning-data";
import { Badge } from "@/components/ui/badge";

// 위험 상태 표기: at_risk=주의(amber), late=지연(red). on_track은 애초에 필터로 제외된다.
const RISK = {
  at_risk: {
    label: "주의",
    icon: Clock,
    className:
      "border-[var(--que-warning)] bg-[var(--que-warning-bg)] text-[var(--que-warning)]",
  },
  late: {
    label: "지연",
    icon: TriangleAlert,
    className: "border-[var(--que-error)] bg-[var(--que-error-bg)] text-[var(--que-error)]",
  },
  on_track: {
    label: "정상",
    icon: Clock,
    className: "border-[var(--que-border)] text-[var(--que-text-secondary)]",
  },
} as const;

/** 대표 홈 — 위험/지연 마일스톤. 관리는 /planning에서, 여기선 조망만. */
export function RiskMilestonesCard({ rows }: { rows: MilestoneRow[] }) {
  if (rows.length === 0) {
    return (
      <p className="text-sm text-[var(--que-text-tertiary)]">
        위험하거나 지연된 마일스톤이 없습니다.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {rows.map((m) => {
        const risk = RISK[m.riskStatus] ?? RISK.at_risk;
        const Icon = risk.icon;
        return (
          <Link
            key={m.id}
            href="/planning"
            className="flex min-h-11 flex-wrap items-center gap-2 rounded-lg border border-[var(--que-border)] px-3 py-2 transition-colors hover:bg-[var(--que-bg-muted)]"
          >
            <Badge variant="outline" className={"gap-1 " + risk.className}>
              <Icon className="size-3" aria-hidden />
              {risk.label}
            </Badge>
            <span className="min-w-0 flex-1 truncate text-sm font-medium text-[var(--que-text)]">
              {m.title}
            </span>
            <span className="text-xs text-[var(--que-text-tertiary)]">
              {m.projectName} · 마감 {format(new Date(m.dueAt), "M월 d일", { locale: ko })}
            </span>
          </Link>
        );
      })}
    </div>
  );
}
