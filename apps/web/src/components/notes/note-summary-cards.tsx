import type { NoteSummary } from "@/lib/notes-summary";
import { cn } from "@/lib/utils";

// 확인필요 상단 요약 카드 — 결제요청 요약 카드와 같은 룩앤필(테두리 카드 + 큰 수 + 라벨).
// 강조색 의미 고정(CLAUDE.md): amber=대기, blue=정보, violet=회의록/응답대기, 회의록 총계는 중립.
const TONE: Record<string, string> = {
  neutral: "text-[var(--que-text)]",
  amber: "text-[var(--que-warning)]",
  blue: "text-[var(--que-brand)]",
  violet: "text-violet-700",
};

export function NoteSummaryCards({ summary }: { summary: NoteSummary }) {
  const metrics = [
    { value: summary.notes, label: "회의록", tone: "neutral" },
    { value: summary.pendingExtraction, label: "추출 대기", tone: "amber" },
    { value: summary.candidates, label: "Action 후보", tone: "blue" },
    { value: summary.needsReview, label: "확인 필요", tone: "violet" },
  ];

  return (
    <section aria-label="확인필요 요약" className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
      {metrics.map((metric) => (
        <div
          key={metric.label}
          className="rounded-xl border border-[var(--que-border)] bg-white px-4 py-3"
        >
          <p
            className={cn(
              "text-2xl font-semibold tabular-nums",
              metric.value === 0 ? "text-[var(--que-text-tertiary)]" : TONE[metric.tone],
            )}
          >
            {metric.value}
          </p>
          <p className="text-xs text-[var(--que-text-secondary)]">{metric.label}</p>
        </div>
      ))}
    </section>
  );
}
