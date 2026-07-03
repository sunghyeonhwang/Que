import Link from "next/link";
import { format } from "date-fns";
import { ko } from "date-fns/locale";
import { AlertTriangle, Clock, HandHelping, Pause } from "lucide-react";
import { PageHeader } from "@/components/app/page-header";
import { StatusBadge } from "@/components/app/status-badge";
import { TaskStatusSheet, type TaskRowData } from "@/components/app/task-status-sheet";
import { AdminReport } from "@/components/team/admin-report";
import { StandupGrid } from "@/components/team/standup-grid";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getCurrentUser } from "@/lib/current-user";
import { getCommentViewsByTask } from "@/lib/comments";
import { getRecentChangeLogs } from "@/lib/calendar-data";
import { getAdminReportData, type ReportPeriod } from "@/lib/report-data";
import { getStandupData, getTeamData, type AttentionEntry } from "@/lib/team-data";
import { josa } from "@/lib/korean";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function TeamPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string; period?: string }>;
}) {
  const params = await searchParams;
  const user = await getCurrentUser();
  const now = new Date();

  // 리포트 뷰는 관리자 전용 — 비관리자가 URL로 접근하면 운영 보드로 되돌린다.
  const requestedReport = params.view === "report" && user.role === "admin";
  const view = requestedReport ? "report" : params.view === "standup" ? "standup" : "board";

  const VIEWS = [
    { key: "board", label: "운영 보드" },
    { key: "standup", label: "스탠드업" },
    ...(user.role === "admin" ? [{ key: "report", label: "리포트" }] : []),
  ] as const;

  const reportPeriod: ReportPeriod = params.period === "month" ? "month" : "week";
  const reportData =
    view === "report" ? await getAdminReportData(user, reportPeriod, now) : null;

  const data = await getTeamData(user, now);
  const logs = await getRecentChangeLogs(6);
  const commentsByTask = await getCommentViewsByTask();
  const standupRows = view === "standup" ? await getStandupData(now) : [];

  const metrics = [
    { value: data.summary.inProgress, label: "진행중" },
    { value: data.summary.issues, label: "문제발생" },
    { value: data.summary.onHold, label: "홀드" },
    { value: data.summary.dueSoon, label: "마감 임박" },
    { value: data.summary.awaiting, label: "응답 대기" },
  ];

  return (
    <div>
      <PageHeader
        title="팀 현황"
        subtitle={`오늘 팀의 업무 흐름과 병목 · ${format(now, "M월 d일 (EEE)", { locale: ko })}`}
      />

      <section
        aria-label="팀 요약"
        className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-5"
      >
        {metrics.map((metric) => (
          <Card key={metric.label} className="py-3">
            <CardContent className="px-4">
              <p className="text-2xl font-semibold tabular-nums">{metric.value}</p>
              <p className="text-xs text-muted-foreground">{metric.label}</p>
            </CardContent>
          </Card>
        ))}
      </section>

      <nav aria-label="팀 현황 뷰 전환" className="mb-4 flex w-fit rounded-lg border p-0.5">
        {VIEWS.map((v) => (
          <Link
            key={v.key}
            href={v.key === "board" ? "/team" : `/team?view=${v.key}`}
            aria-current={view === v.key ? "page" : undefined}
            className={cn(
              "flex h-10 items-center rounded-md px-3 text-sm font-medium transition-colors",
              view === v.key ? "bg-primary text-primary-foreground" : "hover:bg-accent",
            )}
          >
            {v.label}
          </Link>
        ))}
      </nav>

      {view === "standup" && (
        <>
          <p className="mb-3 text-sm text-muted-foreground">
            아침 회의용 — 멤버별 어제/오늘/막힘을 한 화면에서 돕니다. 상태 변경은 시간표나 오늘
            화면에서.
          </p>
          <StandupGrid rows={standupRows} />
        </>
      )}

      {view === "report" && reportData && (
        <>
          <nav aria-label="리포트 기간 전환" className="mb-4 flex w-fit rounded-lg border p-0.5">
            {(["week", "month"] as const).map((p) => (
              <Link
                key={p}
                href={`/team?view=report&period=${p}`}
                aria-current={reportPeriod === p ? "page" : undefined}
                className={cn(
                  "flex h-10 items-center rounded-md px-3 text-sm font-medium transition-colors",
                  reportPeriod === p ? "bg-primary text-primary-foreground" : "hover:bg-accent",
                )}
              >
                {p === "week" ? "주간" : "월간"}
              </Link>
            ))}
          </nav>
          <AdminReport data={reportData} />
        </>
      )}

      {view === "board" && (
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,26rem)]">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">사람별 오늘 시간표</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col">
            {data.members.map(({ user: member, items, conflictCount }) => (
              <div
                key={member.id}
                className="flex min-h-12 flex-wrap items-center gap-2 border-b py-2 last:border-b-0"
              >
                <span className="flex w-24 shrink-0 items-center gap-2 text-sm font-medium">
                  <span
                    className="size-2.5 shrink-0 rounded-full"
                    style={{ backgroundColor: member.avatarColor }}
                    aria-hidden
                  />
                  {member.name}
                  {conflictCount > 0 && (
                    <Badge variant="secondary" className="text-[10px]">
                      충돌 {conflictCount}
                    </Badge>
                  )}
                </span>
                <span className="flex min-w-0 flex-1 flex-wrap gap-1.5">
                  {items.length === 0 && (
                    <span className="text-xs text-muted-foreground">오늘 일정 없음</span>
                  )}
                  {items.map((item) => {
                    const chip = (
                      <span
                        className={
                          item.readonly
                            ? "flex items-center gap-1 rounded-md border border-dashed px-2 py-1 text-xs text-muted-foreground"
                            : "flex min-h-10 items-center gap-1 rounded-md border px-2 py-1 text-xs transition-colors hover:bg-accent/50"
                        }
                      >
                        <span className="tabular-nums text-muted-foreground">
                          {format(new Date(item.startAt), "HH:mm")}
                        </span>
                        <span className="max-w-40 truncate">{item.title}</span>
                        {item.taskStatus && <StatusBadge status={item.taskStatus} />}
                      </span>
                    );
                    if (item.kind !== "task" || !item.task) {
                      return <span key={`${item.kind}-${item.id}`}>{chip}</span>;
                    }
                    // 타인 작업도 열람·댓글이 가능하다 — 수정 UI는 canEdit에 따라 Sheet가 숨긴다
                    const row: TaskRowData = {
                      id: item.task.id,
                      title: item.task.title,
                      status: item.task.status,
                      timeText: `${format(new Date(item.startAt), "HH:mm")}–${format(new Date(item.endAt), "HH:mm")}`,
                      metaText: item.task.description,
                      startAt: item.task.startAt,
                      comments: commentsByTask.get(item.task.id) ?? [],
                      canEdit: item.canEdit,
                    };
                    return (
                      <TaskStatusSheet
                        key={`${item.kind}-${item.id}`}
                        task={row}
                        triggerClassName="rounded-md text-left focus-visible:outline-2 focus-visible:outline-ring"
                      >
                        {chip}
                      </TaskStatusSheet>
                    );
                  })}
                </span>
              </div>
            ))}
          </CardContent>
        </Card>

        <div className="flex flex-col gap-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Attention Queue</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              {data.attention.length === 0 && (
                <p className="text-sm text-muted-foreground">지금 봐야 할 항목이 없습니다.</p>
              )}
              {data.attention.map((entry) => (
                <AttentionRow key={`${entry.type}-${entry.taskId}`} entry={entry} />
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">일정 충돌</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-2">
              {data.conflicts.length === 0 && (
                <p className="text-sm text-muted-foreground">오늘 일정 충돌이 없습니다.</p>
              )}
              {data.conflicts.map((conflict, index) => (
                <p key={index} className="text-sm">
                  <span className="font-medium">{conflict.userName}</span> ·{" "}
                  {format(new Date(conflict.overlapStartAt), "HH:mm")}부터{" "}
                  <span className="font-medium">{conflict.aTitle}</span>
                  {josa(conflict.aTitle, "과", "와")}{" "}
                  <span className="font-medium">{conflict.bTitle}</span>
                  {josa(conflict.bTitle, "이", "가")} 겹칩니다
                </p>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">최근 변경 내역</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              {logs.map((log) => (
                <div key={log.id} className="text-sm">
                  <p className="font-medium">{log.text}</p>
                  <p className="text-xs text-muted-foreground">
                    {log.actorName} · {format(new Date(log.createdAt), "M/d HH:mm")}
                  </p>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
      )}
    </div>
  );
}

function AttentionRow({ entry }: { entry: AttentionEntry }) {
  const config = {
    issue: { icon: AlertTriangle, label: "문제발생", variant: "destructive" as const },
    on_hold: { icon: Pause, label: "홀드", variant: "secondary" as const },
    awaiting_response: { icon: Clock, label: "응답대기", variant: "outline" as const },
    help_request: { icon: HandHelping, label: "도움 요청", variant: "outline" as const },
  }[entry.type];
  const Icon = config.icon;

  return (
    <div className="rounded-md border p-3">
      <div className="flex items-center gap-2">
        <Badge variant={config.variant}>
          <Icon className="size-3" aria-hidden />
          {config.label}
        </Badge>
        <p className="min-w-0 flex-1 truncate text-sm font-medium">{entry.title}</p>
      </div>
      <p className="mt-1 text-xs text-muted-foreground">
        담당 {entry.assigneeName}
        {entry.detail ? ` · ${entry.detail}` : ""}
      </p>
      {(entry.helpUserName || entry.nextCheckAt) && (
        <p className="mt-0.5 text-xs text-muted-foreground">
          {entry.helpUserName ? `도움 필요: ${entry.helpUserName}` : ""}
          {entry.helpUserName && entry.nextCheckAt ? " · " : ""}
          {entry.nextCheckAt ? `다음 확인 ${format(new Date(entry.nextCheckAt), "HH:mm")}` : ""}
        </p>
      )}
    </div>
  );
}
