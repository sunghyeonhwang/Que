import Link from "next/link";
import { format } from "date-fns";
import type { AttentionEntry } from "@/lib/team-data";
import { ATTENTION_CONFIG } from "@/components/app/attention-config";
import { Badge } from "@/components/ui/badge";

/** 주의 필요(병목) — 문제·홀드·응답대기·도움요청 + 사유/다음 액션. 팀 현황 Attention Queue와 같은 소스. */
export function AttentionList({ entries }: { entries: AttentionEntry[] }) {
  if (entries.length === 0) {
    return (
      <p className="text-sm text-[var(--que-text-tertiary)]">
        지금 막혀 있거나 봐야 할 항목이 없습니다.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {entries.map((entry) => {
        const config = ATTENTION_CONFIG[entry.type];
        const Icon = config.icon;
        const helpNames = entry.helpUserNames ?? (entry.helpUserName ? [entry.helpUserName] : []);
        return (
          <Link
            key={`${entry.type}-${entry.taskId}`}
            href={`/now?task=${entry.taskId}`}
            className="block rounded-lg border border-[var(--que-border)] p-3 transition-colors hover:bg-[var(--que-bg-muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <div className="flex items-center gap-2">
              <Badge variant="outline" className={"gap-1 " + config.className}>
                <Icon className="size-3" aria-hidden />
                {config.label}
              </Badge>
              <p className="min-w-0 flex-1 truncate text-sm font-medium text-[var(--que-text)]">
                {entry.title}
              </p>
            </div>
            <p className="mt-1 text-xs text-[var(--que-text-secondary)]">
              담당 {entry.assigneeName}
              {entry.detail ? ` · ${entry.detail}` : ""}
            </p>
            {(helpNames.length > 0 || entry.nextCheckAt) && (
              <p className="mt-0.5 text-xs text-[var(--que-text-tertiary)]">
                {helpNames.length > 0 ? `도움 필요: ${helpNames.join(", ")}` : ""}
                {helpNames.length > 0 && entry.nextCheckAt ? " · " : ""}
                {entry.nextCheckAt
                  ? `다음 확인 ${format(new Date(entry.nextCheckAt), "HH:mm")}`
                  : ""}
              </p>
            )}
          </Link>
        );
      })}
    </div>
  );
}
