import { format } from "date-fns";
import { ko } from "date-fns/locale";
import { AlertTriangle, Clock, Pause } from "lucide-react";
import { PageHeader } from "@/components/app/page-header";
import { StatusBadge } from "@/components/app/status-badge";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getCurrentUser } from "@/lib/current-user";
import { getRecentChangeLogs } from "@/lib/calendar-data";
import { getTeamData, type AttentionEntry } from "@/lib/team-data";
import { josa } from "@/lib/korean";

export const dynamic = "force-dynamic";

export default async function TeamPage() {
  const user = await getCurrentUser();
  const now = new Date();
  const data = getTeamData(user, now);
  const logs = getRecentChangeLogs(6);

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
                  {items.map((item) => (
                    <span
                      key={`${item.kind}-${item.id}`}
                      className={
                        item.readonly
                          ? "flex items-center gap-1 rounded-md border border-dashed px-2 py-1 text-xs text-muted-foreground"
                          : "flex items-center gap-1 rounded-md border px-2 py-1 text-xs"
                      }
                    >
                      <span className="tabular-nums text-muted-foreground">
                        {format(new Date(item.startAt), "HH:mm")}
                      </span>
                      <span className="max-w-40 truncate">{item.title}</span>
                      {item.taskStatus && <StatusBadge status={item.taskStatus} />}
                    </span>
                  ))}
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
    </div>
  );
}

function AttentionRow({ entry }: { entry: AttentionEntry }) {
  const config = {
    issue: { icon: AlertTriangle, label: "문제발생", variant: "destructive" as const },
    on_hold: { icon: Pause, label: "홀드", variant: "secondary" as const },
    awaiting_response: { icon: Clock, label: "응답대기", variant: "outline" as const },
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
