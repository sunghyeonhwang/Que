import type { AdminReportData } from "@/lib/report-data";

/** 팀 부하 분포 막대 — 업무 배분 조정용(평가 아님). 관리자/대표 홈에서 공유한다.
 *  막대 길이 = 예상 소요 시간 + 문제발생·홀드·마감 임박 가중. 정렬은 넘겨받은 순서 그대로(순위표 아님). */
export function LoadBars({ rows }: { rows: AdminReportData["loadByMember"] }) {
  const max = Math.max(...rows.map((m) => m.loadScore), 1);

  if (rows.length === 0) {
    return (
      <p className="text-sm text-[var(--que-text-tertiary)]">표시할 팀 부하가 없습니다.</p>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <p className="text-xs text-[var(--que-text-tertiary)]">
        막대 = 예상 소요 시간에 문제·홀드·마감 임박 가중을 더한 부하. 줄세우기가 아니라 일이 몰린
        곳을 보기 위한 것입니다.
      </p>
      {rows.map((m) => (
        <div key={m.userId} className="flex items-center gap-2">
          <span className="w-16 shrink-0 truncate text-sm text-[var(--que-text)]">{m.name}</span>
          <span
            className="h-4 rounded-sm bg-[var(--que-brand)]/70"
            style={{
              width: `${(m.loadScore / max) * 100}%`,
              minWidth: m.loadScore ? "0.5rem" : "0",
            }}
            aria-hidden
          />
          <span className="text-sm tabular-nums text-[var(--que-text-secondary)]">
            열린 {m.openTasks}건 · 예상 {m.openHours}h
            {m.blocked > 0 && (
              <span className="text-[var(--que-error)]"> · 막힘 {m.blocked}</span>
            )}
          </span>
        </div>
      ))}
    </div>
  );
}
