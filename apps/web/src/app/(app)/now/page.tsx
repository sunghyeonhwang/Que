import Link from "next/link";
import { format } from "date-fns";
import { ko } from "date-fns/locale";
import { PageHeader } from "@/components/app/page-header";
import { TaskTabs } from "@/components/app/task-tabs";
import { ActionStatusBadge, StatusBadge } from "@/components/app/status-badge";
import { TaskStatusSheet, type TaskRowData } from "@/components/app/task-status-sheet";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { buttonVariants } from "@/components/ui/button";
import { getClientFilter } from "@/lib/client-filter";
import { getCommentViewsByTask } from "@/lib/comments";
import { getCurrentUser } from "@/lib/current-user";
import { getNowData, type NowFilter } from "@/lib/now-data";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

function parseFilter(value: string | undefined): NowFilter {
  return value === "mine" || value === "issue" ? value : "all";
}

const FILTERS: { key: NowFilter; label: string }[] = [
  { key: "all", label: "전체" },
  { key: "mine", label: "내 항목" },
  { key: "issue", label: "문제" },
];

export default async function NowPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string; task?: string }>;
}) {
  const params = await searchParams;
  const filter = parseFilter(params.filter);
  const user = await getCurrentUser();
  const clientId = await getClientFilter();
  const now = new Date();
  const data = await getNowData(user, filter, now, clientId);
  const commentsByTask = await getCommentViewsByTask();

  // 딥링크(/now?task=<id>) — 홈 병목·전역 검색·활동 피드에서 넘어온 작업을 자동으로 연다.
  // 해당 taskId 행이 실제로 있을 때만 하이라이트+시트 자동 오픈 대상으로 삼는다.
  const activeTaskId =
    params.task && data.rows.some((row) => row.taskId === params.task)
      ? params.task
      : undefined;

  const metrics = [
    { value: data.summary.calendarCount, label: "오늘 캘린더 항목" },
    { value: data.summary.actionCount, label: "Action 후보" },
    { value: data.summary.issueHold, label: "문제/홀드", href: "/now?filter=issue" },
    { value: data.summary.dueToday, label: "오늘 마감" },
    { value: data.summary.missingAssignee, label: "담당자 확인 필요", href: "/action" },
    {
      value: data.summary.scheduleConflicts,
      label: "일정 충돌",
      href: "/team",
      warning: true as const,
    },
  ];

  return (
    <div>
      <PageHeader
        title="Now 운영표"
        subtitle={`회의 Action과 캘린더 일정이 연결됐는지 확인하는 팀 운영표 · ${format(now, "M월 d일 (EEE)", { locale: ko })}`}
        actions={
          <Link href="/action" className={cn(buttonVariants(), "h-10")}>
            Action 확정하러 가기
          </Link>
        }
      />

      <TaskTabs active="now" />

      <section
        aria-label="Now 요약"
        className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-6"
      >
        {metrics.map((metric) => {
          const conflictActive = metric.warning && metric.value > 0;
          const card = (
            <Card
              className={cn(
                "py-3",
                conflictActive && "border-[var(--que-warning)] bg-[var(--que-warning-bg)]",
              )}
            >
              <CardContent className="px-4">
                <p
                  className={cn(
                    "text-2xl font-semibold tabular-nums",
                    conflictActive && "text-[var(--que-warning)]",
                  )}
                >
                  {metric.value}
                </p>
                <p
                  className={cn(
                    "text-xs text-muted-foreground",
                    conflictActive && "text-[var(--que-warning)]",
                  )}
                >
                  {metric.label}
                  {metric.href && <span className="ml-1">→</span>}
                </p>
              </CardContent>
            </Card>
          );
          return metric.href ? (
            <Link
              key={metric.label}
              href={metric.href}
              aria-label={`${metric.label} ${metric.value}건 · 목록 보기`}
              className="block rounded-xl transition-colors hover:bg-[var(--que-bg-muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {card}
            </Link>
          ) : (
            <div key={metric.label}>{card}</div>
          );
        })}
      </section>

      <div className="mb-3 flex gap-2" aria-label="Now 필터">
        {FILTERS.map((f) => (
          <Link
            key={f.key}
            href={f.key === "all" ? "/now" : `/now?filter=${f.key}`}
            aria-current={filter === f.key ? "page" : undefined}
            className={cn(
              "flex h-10 items-center rounded-md border px-3 text-sm transition-colors",
              filter === f.key ? "bg-primary text-primary-foreground" : "hover:bg-accent",
            )}
          >
            {f.label}
          </Link>
        ))}
      </div>

      <div className="max-h-[calc(100dvh-22rem)] overflow-auto rounded-xl border border-[var(--que-border)] bg-[var(--que-bg)]">
        <Table className="min-w-[720px]">
          <TableHeader className="sticky top-0 z-10 bg-[var(--que-bg)] [&_tr]:border-b [&_tr]:border-[var(--que-border)]">
            <TableRow className="hover:bg-transparent">
              <TableHead className="w-28 text-xs font-medium text-[var(--que-text-tertiary)]">시간/마감</TableHead>
              <TableHead className="w-24 text-xs font-medium text-[var(--que-text-tertiary)]">구분</TableHead>
              <TableHead className="text-xs font-medium text-[var(--que-text-tertiary)]">항목</TableHead>
              <TableHead className="w-24 text-xs font-medium text-[var(--que-text-tertiary)]">담당자</TableHead>
              <TableHead className="w-32 text-xs font-medium text-[var(--que-text-tertiary)]">상태</TableHead>
              <TableHead className="w-40 text-xs font-medium text-[var(--que-text-tertiary)]">출처</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.rows.length === 0 && (
              <TableRow className="hover:bg-transparent">
                <TableCell colSpan={6} className="py-8 text-center text-[var(--que-text-tertiary)]">
                  표시할 항목이 없습니다.
                </TableCell>
              </TableRow>
            )}
            {data.rows.map((row) => {
              // 항목 셀은 행 유형에 따라 클릭 어포던스를 다르게 준다:
              // - Que 작업(taskStatus 보유) → TaskStatusSheet로 상세·상태변경·댓글
              // - 회의록 Action → 해당 회의록 필터(/action?note=...)로 이동
              // - 회사/개인 일정(event) → 클릭 대상 아님(읽기 전용 텍스트)
              // 트리거는 /today 정본 패턴(my-task-table.tsx)과 동일하게 행 전체(absolute inset-0)를
              // 덮어 터치 대상 40px+를 확보한다. 보이는 제목은 별도 span, 트리거는 sr-only 라벨.
              const titleCell = row.taskId ? (
                <>
                  <span className="block truncate font-medium">{row.title}</span>
                  <TaskStatusSheet
                    task={
                      {
                        id: row.taskId,
                        title: row.title,
                        status: row.taskStatus!,
                        timeText: row.at
                          ? `${format(new Date(row.at), "HH:mm")}${
                              row.endAt ? `–${format(new Date(row.endAt), "HH:mm")}` : ""
                            }`
                          : "",
                        metaText: row.description,
                        startAt: row.at,
                        endAt: row.endAt,
                        projectId: row.projectId,
                        assigneeId: row.assigneeId,
                        assigneeName: row.assigneeName,
                        comments: commentsByTask.get(row.taskId) ?? [],
                        canEdit: row.canEdit,
                      } satisfies TaskRowData
                    }
                    triggerClassName="absolute inset-0 z-0 rounded-md focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring"
                    defaultOpen={activeTaskId !== undefined && row.taskId === activeTaskId}
                  >
                    <span className="sr-only">{row.title} 상세 열기</span>
                  </TaskStatusSheet>
                </>
              ) : row.kind === "action" && row.noteId ? (
                <>
                  <span className="block truncate font-medium">{row.title}</span>
                  <Link
                    href={`/action?note=${row.noteId}`}
                    className="absolute inset-0 z-0 rounded-md focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring"
                  >
                    <span className="sr-only">{row.title} 회의록 열기</span>
                  </Link>
                </>
              ) : (
                <span className="block truncate font-medium">{row.title}</span>
              );
              return (
                <TableRow
                  key={row.key}
                  className={cn(
                    "relative border-[var(--que-border)] transition-colors hover:bg-[var(--que-bg-muted)]",
                    activeTaskId !== undefined &&
                      row.taskId === activeTaskId &&
                      "bg-[var(--que-brand-subtle)] ring-2 ring-inset ring-[var(--que-brand)]",
                  )}
                >
                  <TableCell className="h-12 tabular-nums">
                    {row.at ? format(new Date(row.at), "HH:mm") : "—"}
                    {row.at && (
                      <span className="block text-xs text-[var(--que-text-tertiary)]">
                        {format(new Date(row.at), "M/d")}
                      </span>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant={row.kind === "action" ? "outline" : "secondary"}>
                      {row.kind === "action" ? "Action" : "Calendar"}
                    </Badge>
                  </TableCell>
                  <TableCell className="max-w-64">{titleCell}</TableCell>
                  <TableCell>
                    {row.assigneeName ?? (
                      <span className="text-[var(--que-error)]">미지정</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {row.taskStatus && <StatusBadge status={row.taskStatus} />}
                    {row.actionStatus && <ActionStatusBadge status={row.actionStatus} />}
                    {row.eventLabel && <Badge variant="outline">{row.eventLabel}</Badge>}
                  </TableCell>
                  <TableCell className="text-xs text-[var(--que-text-tertiary)]">{row.source}</TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
