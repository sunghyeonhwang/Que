import Link from "next/link";
import { format } from "date-fns";
import { FileText, Wallet } from "lucide-react";
import type { ManagerHomeData } from "@/lib/home-grade-data";
import { HomeCard } from "@/components/home/home-card";
import { HomeTodoList } from "@/components/home/home-todo-list";
import { HomeSchedule } from "@/components/home/home-schedule";
import { AttentionList } from "@/components/home/attention-list";
import { LoadBars } from "@/components/home/load-bars";
import { Card, CardContent } from "@/components/ui/card";
import { josa } from "@/lib/korean";

/** 관리자 홈 "어디가 막혔나" — 팀 요약 → 병목 → 충돌 → 부하 → 확인필요·결제 → 본인(축소). */
export function ManagerHome({ data }: { data: ManagerHomeData }) {
  const chips = [
    { value: data.teamSummary.inProgress, label: "진행중" },
    { value: data.teamSummary.issues, label: "문제발생", warn: data.teamSummary.issues > 0 },
    { value: data.teamSummary.onHold, label: "홀드" },
    { value: data.teamSummary.dueSoon, label: "마감 임박" },
    { value: data.teamSummary.awaiting, label: "응답 대기" },
  ];

  return (
    <div className="flex flex-col gap-4">
      {/* 팀 요약칩 */}
      <section
        aria-label="팀 요약"
        className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-5"
      >
        {chips.map((chip) => (
          <Card key={chip.label} className="py-3">
            <CardContent className="px-4">
              <p
                className={
                  "text-2xl font-semibold tabular-nums" +
                  (chip.warn ? " text-[var(--que-error)]" : "")
                }
              >
                {chip.value}
              </p>
              <p className="text-xs text-muted-foreground">{chip.label}</p>
            </CardContent>
          </Card>
        ))}
      </section>

      {/* 주의 필요(병목) | 일정 충돌 */}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <HomeCard title="주의 필요 — 어디가 막혔나" meta={String(data.attention.length)}>
          <AttentionList entries={data.attention} />
        </HomeCard>
        <HomeCard title="일정 충돌" meta={String(data.conflicts.length)}>
          {data.conflicts.length === 0 ? (
            <p className="text-sm text-[var(--que-text-tertiary)]">오늘 일정 충돌이 없습니다.</p>
          ) : (
            <div className="flex flex-col gap-2">
              {data.conflicts.map((conflict, index) => (
                <p key={index} className="text-sm text-[var(--que-text-secondary)]">
                  <span className="font-medium text-[var(--que-text)]">{conflict.userName}</span> ·{" "}
                  {format(new Date(conflict.overlapStartAt), "HH:mm")}부터{" "}
                  <span className="font-medium text-[var(--que-text)]">{conflict.aTitle}</span>
                  {josa(conflict.aTitle, "과", "와")}{" "}
                  <span className="font-medium text-[var(--que-text)]">{conflict.bTitle}</span>
                  {josa(conflict.bTitle, "이", "가")} 겹칩니다
                </p>
              ))}
            </div>
          )}
        </HomeCard>
      </div>

      {/* 팀 부하 */}
      <HomeCard title="팀 부하 — 업무 배분 조정용">
        <LoadBars rows={data.loadByMember} />
      </HomeCard>

      {/* 확인필요 Action | 결제 대기 */}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <Link
          href="/action"
          className="flex min-h-16 items-center gap-3 rounded-xl border border-[var(--que-border)] bg-[var(--que-bg)] p-4 transition-colors hover:bg-[var(--que-bg-muted)]"
        >
          <span className="flex size-10 shrink-0 items-center justify-center rounded-lg border border-[var(--que-violet)] bg-[var(--que-violet-bg)] text-[var(--que-violet)]">
            <FileText className="size-5" aria-hidden />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-sm text-[var(--que-text-secondary)]">확인 필요 Action</span>
            <span className="block text-lg font-semibold tabular-nums text-[var(--que-text)]">
              {data.noteSummary.needsReview}건
            </span>
          </span>
          <span className="text-xs text-[var(--que-text-tertiary)]">
            회의록 {data.noteSummary.notes} · 후보 {data.noteSummary.candidates}
          </span>
        </Link>
        <Link
          href="/payments"
          className="flex min-h-16 items-center gap-3 rounded-xl border border-[var(--que-border)] bg-[var(--que-bg)] p-4 transition-colors hover:bg-[var(--que-bg-muted)]"
        >
          <span
            className={
              "flex size-10 shrink-0 items-center justify-center rounded-lg border " +
              (data.overduePayments > 0
                ? "border-[var(--que-error)] bg-[var(--que-error-bg)] text-[var(--que-error)]"
                : "border-[var(--que-warning)] bg-[var(--que-warning-bg)] text-[var(--que-warning)]")
            }
          >
            <Wallet className="size-5" aria-hidden />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-sm text-[var(--que-text-secondary)]">결제 대기</span>
            <span className="block text-lg font-semibold tabular-nums text-[var(--que-text)]">
              {data.pendingPayments}건
            </span>
          </span>
          {data.overduePayments > 0 && (
            <span className="text-xs font-medium text-[var(--que-error)]">
              마감 초과 {data.overduePayments}
            </span>
          )}
        </Link>
      </div>

      {/* 본인 오늘 할 일 | 개인 일정 (축소) */}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <HomeCard title="내 오늘 할 일" meta={String(data.todoCount)}>
          <HomeTodoList todos={data.todos} />
        </HomeCard>
        <HomeCard title="내 개인 일정">
          <HomeSchedule items={data.schedule} dateLabel={data.scheduleDateLabel} />
        </HomeCard>
      </div>
    </div>
  );
}
