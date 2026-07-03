import { AlertTriangle, Pause } from "lucide-react";
import type { AdminReportData } from "@/lib/report-data";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

/** 관리자 리포트 뷰 — 진척(프로젝트별 완료)·병목(현재 막힘)·부하 분포(밸런싱)만 보여준다.
 *  개인 완료 순위/점수는 의도적으로 없다 (기획서 "감시 아님" 원칙). */
export function AdminReport({ data }: { data: AdminReportData }) {
  const periodLabel = data.period === "week" ? "최근 7일" : "최근 4주";
  const maxProject = Math.max(...data.completedByProject.map((p) => p.count), 1);
  const maxTrend = Math.max(...data.weeklyTrend.map((w) => w.completed), 1);
  const maxLoad = Math.max(...data.loadByMember.map((m) => m.loadScore), 1);

  const snapshot = [
    { value: data.overall.activeProjects, label: "진행 프로젝트" },
    { value: data.overall.openTasks, label: "열린 작업" },
    { value: data.overall.blockedNow, label: "현재 막힘", warn: data.overall.blockedNow > 0 },
    { value: data.overall.atRiskMilestones, label: "위험 마일스톤", warn: data.overall.atRiskMilestones > 0 },
    { value: data.overall.pendingPayments, label: "결제 대기" },
    { value: data.overall.overduePayments, label: "결제 연체", warn: data.overall.overduePayments > 0 },
  ];

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-muted-foreground">
        {periodLabel} ({data.rangeStart} ~ {data.rangeEnd}) · 대표/관리자 전용 · 개인 평가가 아니라
        진척과 병목을 보기 위한 요약입니다.
      </p>

      {/* 전체 현황 스냅샷 */}
      <section
        aria-label="전체 현황"
        className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-6"
      >
        {snapshot.map((s) => (
          <Card key={s.label} className="py-3">
            <CardContent className="px-4">
              <p
                className={
                  "text-2xl font-semibold tabular-nums" + (s.warn ? " text-destructive" : "")
                }
              >
                {s.value}
              </p>
              <p className="text-xs text-muted-foreground">{s.label}</p>
            </CardContent>
          </Card>
        ))}
      </section>

      <div className="grid gap-4 xl:grid-cols-2">
        {/* 진척: 기간 완료 + 프로젝트별 */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              진척 — {periodLabel} 완료 {data.completedInPeriod}건
              {data.cancelledInPeriod > 0 && (
                <span className="ml-2 text-sm font-normal text-muted-foreground">
                  · 취소 {data.cancelledInPeriod}건
                </span>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            {data.completedByProject.length === 0 && (
              <p className="text-sm text-muted-foreground">이 기간에 완료된 작업이 없습니다.</p>
            )}
            {data.completedByProject.map((p) => (
              <div key={p.name} className="flex items-center gap-2">
                <span className="w-28 shrink-0 truncate text-sm">{p.name}</span>
                <span
                  className="h-4 rounded-sm bg-foreground/70"
                  style={{ width: `${(p.count / maxProject) * 100}%`, minWidth: "0.5rem" }}
                  aria-hidden
                />
                <span className="text-sm tabular-nums text-muted-foreground">{p.count}</span>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* 병목 유입 + 주별 추세 */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">병목 유입 / 완료 추세</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <div className="flex gap-4 text-sm">
              <span>
                기간 내 문제발생{" "}
                <span className="font-semibold tabular-nums text-destructive">
                  {data.raisedIssues}
                </span>
                건
              </span>
              <span>
                홀드 전환{" "}
                <span className="font-semibold tabular-nums">{data.raisedHolds}</span>건
              </span>
            </div>
            <div className="flex flex-col gap-1">
              {data.weeklyTrend.map((w) => (
                <div key={w.label} className="flex items-center gap-2">
                  <span className="w-16 shrink-0 text-xs text-muted-foreground">{w.label}</span>
                  <span
                    className="h-3 rounded-sm bg-foreground/45"
                    style={{ width: `${(w.completed / maxTrend) * 100}%`, minWidth: "0.25rem" }}
                    aria-hidden
                  />
                  <span className="text-xs tabular-nums text-muted-foreground">
                    {w.completed}건 완료
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 현재 병목 — 도움이 필요한 곳 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            현재 막혀 있는 작업 {data.currentBlockers.length}건 — 도움이 필요한 곳
          </CardTitle>
        </CardHeader>
        <CardContent>
          {data.currentBlockers.length === 0 ? (
            <p className="text-sm text-muted-foreground">현재 막혀 있는 작업이 없습니다.</p>
          ) : (
            <div className="flex flex-col gap-2">
              {data.currentBlockers.map((b) => (
                <div
                  key={b.taskId}
                  className="flex min-h-11 flex-wrap items-center gap-2 rounded-md border px-3 py-2"
                >
                  <Badge
                    variant={b.status === "issue" ? "destructive" : "outline"}
                    className="gap-1"
                  >
                    {b.status === "issue" ? (
                      <AlertTriangle className="size-3" aria-hidden />
                    ) : (
                      <Pause className="size-3" aria-hidden />
                    )}
                    {b.status === "issue" ? "문제발생" : "홀드"}
                  </Badge>
                  <span className="min-w-0 flex-1 truncate text-sm font-medium">{b.taskTitle}</span>
                  <span className="text-xs text-muted-foreground">
                    {b.projectName ?? "프로젝트 미지정"} · 담당 {b.assigneeName} · {b.sinceLabel}
                  </span>
                  {b.reason && (
                    <span className="w-full truncate text-xs text-muted-foreground">
                      사유: {b.reason}
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* 부하 분포 — 밸런싱용 (평가 아님) */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">부하 분포 — 업무 배분 조정용 (평가 아님)</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          <p className="text-xs text-muted-foreground">
            막대 길이 = 예상 소요 시간에 문제발생·홀드·마감 임박 가중을 더한 부하(단순 작업 수 아님).
            줄세우기가 아니라 어디에 일이 몰렸는지 보기 위한 것입니다.
          </p>
          {data.loadByMember.map((m) => (
            <div key={m.name} className="flex items-center gap-2">
              <span className="w-16 shrink-0 text-sm">{m.name}</span>
              <span
                className="h-4 rounded-sm bg-foreground/45"
                style={{
                  width: `${(m.loadScore / maxLoad) * 100}%`,
                  minWidth: m.loadScore ? "0.5rem" : "0",
                }}
                aria-hidden
              />
              <span className="text-sm tabular-nums text-muted-foreground">
                열린 {m.openTasks}건 · 예상 {m.openHours}h
                {m.blocked > 0 && <span className="text-destructive"> · 막힘 {m.blocked}</span>}
              </span>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
