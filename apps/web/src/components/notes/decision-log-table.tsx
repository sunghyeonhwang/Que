import Link from "next/link";
import { format } from "date-fns";
import { Sparkles } from "lucide-react";
import type { DecisionLogEntry } from "@/lib/meeting-decisions";

/** 결정 로그 테이블(명세 B-4) — AI가 회의록에서 추출한 "명시된 결정"을 조회 전용으로 보여준다.
 *  회의록 제목은 `/meeting-notes?note=<id>` 딥링크(해당 회의록 강조). 내부 스크롤 + sticky header. */
export function DecisionLogTable({ entries }: { entries: DecisionLogEntry[] }) {
  return (
    <div className="flex flex-col gap-3">
      {/* AI 파생물 안내 — 원문 대조 필요(요약과 동급). */}
      <p className="flex items-center gap-1.5 rounded-lg border border-[var(--que-border)] bg-[var(--que-bg-muted)] px-3 py-2 text-xs text-[var(--que-text-secondary)]">
        <Sparkles className="size-3.5 shrink-0 text-[var(--que-brand)]" aria-hidden />
        AI가 회의록에서 추출한 결정입니다 — 원문과 대조하세요.
      </p>

      {entries.length === 0 ? (
        <p className="rounded-xl border border-dashed border-[var(--que-border)] bg-[var(--que-bg-muted)] py-10 text-center text-sm text-[var(--que-text-tertiary)]">
          추출된 결정이 없습니다. 회의록을 업로드하면 결정이 자동으로 정리됩니다.
        </p>
      ) : (
        <div className="max-h-[calc(100dvh-20rem)] overflow-auto rounded-xl border border-[var(--que-border)]">
          <table className="w-full border-collapse text-sm">
            <thead className="sticky top-0 z-10 bg-[var(--que-bg-muted)]">
              <tr className="text-left text-xs text-[var(--que-text-tertiary)]">
                <th className="px-3.5 py-2.5 font-medium">결정 내용</th>
                <th className="px-3.5 py-2.5 font-medium">회의록</th>
                <th className="hidden px-3.5 py-2.5 font-medium sm:table-cell">회의 일시</th>
                <th className="hidden px-3.5 py-2.5 font-medium md:table-cell">프로젝트</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((e) => (
                <tr
                  key={e.id}
                  className="border-t border-[var(--que-border)] align-top hover:bg-[var(--que-bg-muted)]"
                >
                  <td className="px-3.5 py-3 text-[var(--que-text)]">{e.content}</td>
                  <td className="px-3.5 py-3">
                    <Link
                      href={`/meeting-notes?note=${e.noteId}`}
                      className="text-[var(--que-brand)] underline-offset-2 hover:underline"
                    >
                      {e.noteTitle}
                    </Link>
                    {/* 좁은 폭: 일시·프로젝트를 제목 아래로 접어 보여준다. */}
                    <span className="mt-0.5 block text-xs text-[var(--que-text-tertiary)] sm:hidden">
                      {format(new Date(e.noteDate), "yyyy.M.d HH:mm")}
                      {e.projectName ? ` · ${e.projectName}` : ""}
                    </span>
                  </td>
                  <td className="hidden whitespace-nowrap px-3.5 py-3 tabular-nums text-[var(--que-text-secondary)] sm:table-cell">
                    {format(new Date(e.noteDate), "yyyy.M.d HH:mm")}
                  </td>
                  <td className="hidden px-3.5 py-3 text-[var(--que-text-secondary)] md:table-cell">
                    {e.projectName ?? "미지정"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
