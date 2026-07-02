import { format } from "date-fns";
import { ko } from "date-fns/locale";
import { TASK_STATUS_LABELS } from "@que/core";
import { PageHeader } from "@/components/app/page-header";
import { QuickAdd } from "@/components/app/quick-add";
import { StatusBadge } from "@/components/app/status-badge";
import { CheckInPanel } from "@/components/app/checkin-panel";
import { TaskStatusSheet, type TaskRowData } from "@/components/app/task-status-sheet";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getCurrentUser } from "@/lib/current-user";
import { getTodayData, type TodayTimelineItem } from "@/lib/today-data";

export const dynamic = "force-dynamic";

export default async function TodayPage() {
  const user = await getCurrentUser();
  const now = new Date();
  const data = getTodayData(user, now);

  const metrics = [
    { value: data.myTasks.length, label: "오늘 내 작업" },
    { value: data.pendingCheckIns.length, label: "체크인 응답 필요" },
    { value: data.dueSoon.length, label: "마감 임박" },
    { value: data.attention.length, label: "문제/홀드 관련" },
    { value: data.conflictCount, label: "일정 충돌" },
  ];

  return (
    <div>
      <PageHeader
        title={`오늘의 Que — ${user.name}`}
        subtitle={`내 하루를 시작하는 개인 화면 · ${format(now, "M월 d일 (EEE)", { locale: ko })}`}
      />

      <QuickAdd currentUserId={user.id} />

      <section
        aria-label="오늘 요약"
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
            <CardTitle className="text-base">내 타임라인</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            {data.timeline.length === 0 && (
              <p className="py-6 text-center text-sm text-muted-foreground">
                오늘 일정과 작업이 없습니다.
              </p>
            )}
            {data.timeline.map((item) => (
              <TimelineRow key={`${item.kind}-${item.id}`} item={item} />
            ))}
          </CardContent>
        </Card>

        <div className="flex flex-col gap-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">자동 체크인</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              {data.pendingCheckIns.length === 0 && (
                <p className="text-sm text-muted-foreground">응답할 체크인이 없습니다.</p>
              )}
              {data.pendingCheckIns.map(({ checkIn, task }) => (
                <CheckInPanel
                  key={checkIn.id}
                  checkInId={checkIn.id}
                  question={`${user.name}님, ${format(new Date(checkIn.scheduledAt), "HH:mm")} 예정된 "${task.title}" 상태를 알려주세요.`}
                />
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">주의 필요</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              {data.attention.length === 0 && (
                <p className="text-sm text-muted-foreground">
                  내가 관련된 문제/홀드가 없습니다.
                </p>
              )}
              {data.attention.map(({ task, reason, helpUserName, nextCheckAt }) => (
                <div key={task.id} className="rounded-md border p-3">
                  <div className="flex items-center gap-2">
                    <StatusBadge status={task.status} />
                    <p className="min-w-0 flex-1 truncate text-sm font-medium">{task.title}</p>
                  </div>
                  {reason && <p className="mt-1 text-sm text-muted-foreground">{reason}</p>}
                  <p className="mt-1 text-xs text-muted-foreground">
                    {helpUserName ? `도움 필요: ${helpUserName}` : null}
                    {helpUserName && nextCheckAt ? " · " : null}
                    {nextCheckAt
                      ? `다음 확인 ${format(new Date(nextCheckAt), "HH:mm")}`
                      : null}
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

function TimelineRow({ item }: { item: TodayTimelineItem }) {
  const timeText = item.startAt
    ? `${format(new Date(item.startAt), "HH:mm")}${item.endAt ? `–${format(new Date(item.endAt), "HH:mm")}` : ""}`
    : "시간 미정";

  if (item.kind === "event") {
    return (
      <div className="flex min-h-10 items-center gap-3 rounded-md border border-dashed px-3 py-2">
        <span className="w-24 shrink-0 text-sm tabular-nums text-muted-foreground">
          {timeText}
        </span>
        <span className="min-w-0 flex-1 truncate text-sm">{item.title}</span>
        <Badge variant="outline">회사 일정</Badge>
      </div>
    );
  }

  const task = item.task!;
  const row: TaskRowData = {
    id: task.id,
    title: task.title,
    status: task.status,
    timeText,
    metaText: task.description,
    startAt: task.startAt,
  };

  return (
    <TaskStatusSheet task={row}>
      <div className="flex min-h-12 items-center gap-3 rounded-md border px-3 py-2 transition-colors hover:bg-accent/50">
        <span className="w-24 shrink-0 text-sm tabular-nums text-muted-foreground">
          {timeText}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium">{task.title}</span>
          {task.description && (
            <span className="block truncate text-xs text-muted-foreground">
              {task.description}
            </span>
          )}
        </span>
        <StatusBadge status={task.status} />
        <span className="sr-only">{`현재 상태 ${TASK_STATUS_LABELS[task.status]}, 클릭하면 상태를 변경할 수 있습니다`}</span>
      </div>
    </TaskStatusSheet>
  );
}
