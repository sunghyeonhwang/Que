import Link from "next/link";
import { format } from "date-fns";
import { ko } from "date-fns/locale";
import { TASK_STATUS_LABELS } from "@que/core";
import { PageHeader } from "@/components/app/page-header";
import { LinkTabs } from "@/components/app/link-tabs";
import { MyTaskTabs } from "@/components/app/my-task-tabs";
import { MyTaskTable } from "@/components/app/my-task-table";
import { ConflictSuggestions } from "@/components/app/conflict-suggestions";
import { DayWrap } from "@/components/app/day-wrap";
import { QuickAdd } from "@/components/app/quick-add";
import { StatusBadge } from "@/components/app/status-badge";
import { CheckInPanel } from "@/components/app/checkin-panel";
import { TaskStatusSheet, type TaskRowData } from "@/components/app/task-status-sheet";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { getCommentViewsByTask } from "@/lib/comments";
import { getCurrentUser } from "@/lib/current-user";
import { getTodayData, type TodayTimelineItem } from "@/lib/today-data";
import { filterMyTasks, getMyTaskList, type MyTaskTab } from "@/lib/my-tasks-data";
import { buildTodayHref, parseTodayPanel, type TodayPanel } from "@/lib/today-nav";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

function parseTab(value: string | undefined): MyTaskTab {
  return value === "today" || value === "upcoming" || value === "done" ? value : "all";
}

export default async function TodayPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; panel?: string }>;
}) {
  const { tab: tabParam, panel: panelParam } = await searchParams;
  const tab = parseTab(tabParam);
  const panel = parseTodayPanel(panelParam);
  const user = await getCurrentUser();
  const now = new Date();

  const [taskList, data, commentsByTask] = await Promise.all([
    getMyTaskList(user, now),
    getTodayData(user, now),
    getCommentViewsByTask(),
  ]);

  const visibleTasks = filterMyTasks(taskList.items, tab, now);

  const metrics = [
    { value: data.myTasks.length, label: "오늘 내 작업" },
    { value: data.pendingCheckIns.length, label: "체크인 응답 필요" },
    { value: data.dueSoon.length, label: "마감 임박" },
    { value: data.attention.length, label: "문제/홀드" },
    { value: data.conflictCount, label: "일정 충돌" },
  ];

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="내 작업"
        subtitle={`나에게 배정된 작업을 한곳에서 확인하고 상태를 바꾸세요 · ${format(now, "M월 d일 (EEE)", { locale: ko })}`}
        actions={
          <Link href="/now" className={cn(buttonVariants({ variant: "outline" }), "h-10")}>
            Now 운영표
          </Link>
        }
      />

      {/* 일정 충돌 변경 제안 — actionable alert, 있을 때만 표시 */}
      <ConflictSuggestions
        items={data.conflictSuggestions.map((c) => ({
          taskId: c.task.id,
          taskTitle: c.task.title,
          blockerTitle: c.blockerTitle,
          blockerRangeText: `${format(new Date(c.blockerStartAt), "HH:mm")}–${format(new Date(c.blockerEndAt), "HH:mm")}`,
          suggestedStartAt: c.suggestedStartAt,
          suggestedEndAt: c.suggestedEndAt,
          suggestedTimeText: format(new Date(c.suggestedStartAt), "HH:mm"),
        }))}
      />

      {/* 패널 스위처: 현황+리스트 / 입력+리스트 두 탭으로 분리 */}
      <LinkTabs
        label="작업 목록 보기 전환"
        active={panel}
        tabs={[
          { key: "status", label: "현황", href: buildTodayHref(tab, "status") },
          { key: "input", label: "입력", href: buildTodayHref(tab, "input") },
        ]}
      />

      {panel === "input" ? (
        /* 입력 탭: 자연어 입력 + 작업 리스트 (단순 세로 배치) */
        <section aria-label="작업 입력" className="flex flex-col gap-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">새 작업 등록</CardTitle>
            </CardHeader>
            <CardContent>
              <QuickAdd currentUserId={user.id} />
            </CardContent>
          </Card>

          <TaskListSection
            tab={tab}
            panel={panel}
            counts={taskList.counts}
            items={visibleTasks}
            commentsByTask={commentsByTask}
          />
        </section>
      ) : (
        /* 현황 탭: 작업 리스트(좌) + 현황 레일(우) 2단 */
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
          <TaskListSection
            tab={tab}
            panel={panel}
            counts={taskList.counts}
            items={visibleTasks}
            commentsByTask={commentsByTask}
          />

          {/* 리치 레일: 기존 오늘 화면의 현황 기능을 모두 유지 */}
          <aside aria-label="오늘 현황" className="flex flex-col gap-4">
          <section aria-label="오늘 요약" className="grid grid-cols-2 gap-2">
            {metrics.map((metric) => (
              <Card key={metric.label} className="py-3">
                <CardContent className="px-4">
                  <p className="text-2xl font-semibold tabular-nums">{metric.value}</p>
                  <p className="text-xs text-muted-foreground">{metric.label}</p>
                </CardContent>
              </Card>
            ))}
          </section>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">내 타임라인</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-2">
              {data.timeline.length === 0 && (
                <p className="py-4 text-center text-sm text-muted-foreground">
                  오늘 일정과 작업이 없습니다.
                </p>
              )}
              {data.timeline.map((item) => (
                <TimelineRow
                  key={`${item.kind}-${item.id}`}
                  item={item}
                  comments={item.kind === "task" ? (commentsByTask.get(item.id) ?? []) : []}
                />
              ))}
            </CardContent>
          </Card>

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
              <CardTitle className="text-base">하루 마감</CardTitle>
            </CardHeader>
            <CardContent>
              <DayWrap doneToday={data.wrapUp.doneToday} unfinished={data.wrapUp.unfinished} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">주의 필요</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              {data.attention.length === 0 && data.helpRequests.length === 0 && (
                <p className="text-sm text-muted-foreground">
                  내가 관련된 문제/홀드가 없습니다.
                </p>
              )}
              {data.helpRequests.map((request) => (
                <div key={request.id} className="rounded-md border p-3">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">도움 요청</Badge>
                    <p className="min-w-0 flex-1 truncate text-sm font-medium">
                      {request.taskTitle}
                    </p>
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">“{request.body}”</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {request.authorName} · {format(new Date(request.createdAt), "M/d HH:mm")}
                  </p>
                </div>
              ))}
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
          </aside>
        </div>
      )}
    </div>
  );
}

/** 작업 리스트(필터 탭 + 테이블). 현황/입력 두 패널에서 공유한다. */
function TaskListSection({
  tab,
  panel,
  counts,
  items,
  commentsByTask,
}: {
  tab: MyTaskTab;
  panel: TodayPanel;
  counts: Record<MyTaskTab, number>;
  items: Parameters<typeof MyTaskTable>[0]["items"];
  commentsByTask: Parameters<typeof MyTaskTable>[0]["commentsByTask"];
}) {
  return (
    <section aria-label="내 작업 리스트" className="flex min-w-0 flex-col gap-3">
      <MyTaskTabs active={tab} counts={counts} panel={panel} />
      <MyTaskTable items={items} commentsByTask={commentsByTask} />
    </section>
  );
}

function TimelineRow({
  item,
  comments = [],
}: {
  item: TodayTimelineItem;
  comments?: TaskRowData["comments"];
}) {
  const timeText = item.startAt
    ? `${format(new Date(item.startAt), "HH:mm")}${item.endAt ? `–${format(new Date(item.endAt), "HH:mm")}` : ""}`
    : "시간 미정";

  if (item.kind === "event") {
    return (
      <div className="flex min-h-10 items-center gap-3 rounded-md border border-dashed px-3 py-2">
        <span className="w-20 shrink-0 text-sm tabular-nums text-muted-foreground">
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
    comments,
  };

  return (
    <TaskStatusSheet task={row}>
      <div className="flex min-h-12 items-center gap-3 rounded-md border px-3 py-2 transition-colors hover:bg-accent/50">
        <span className="w-20 shrink-0 text-sm tabular-nums text-muted-foreground">
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
