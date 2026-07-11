import Link from "next/link";
import { redirect } from "next/navigation";
import { format } from "date-fns";
import { ko } from "date-fns/locale";
import { PageHeader } from "@/components/app/page-header";
import { StatusBadge } from "@/components/app/status-badge";
import { ATTENTION_CONFIG } from "@/components/app/attention-config";
import { TaskStatusSheet, type TaskRowData } from "@/components/app/task-status-sheet";
import { AdminReport } from "@/components/team/admin-report";

// AI 분석(report-actions)은 Gemini 응답까지 수십 초 걸릴 수 있다 — 함수 시간 명시(기본값 의존 금지).
export const maxDuration = 60;
import { HomeCard } from "@/components/home/home-card";
import { Badge } from "@/components/ui/badge";
import { getClientFilter } from "@/lib/client-filter";
import { getCurrentUser } from "@/lib/current-user";
import { getCommentViewsByTask } from "@/lib/comments";
import { getRecentChangeLogs } from "@/lib/calendar-data";
import { getAdminReportData, type ReportPeriod } from "@/lib/report-data";
import { getTeamData, type AttentionEntry } from "@/lib/team-data";
import { josa } from "@/lib/korean";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function TeamPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string; period?: string }>;
}) {
  const params = await searchParams;
  // 스탠드업 뷰는 /daily로 완전 대체(기획 §8-4) — 동일 데이터 이중 화면 방지. getStandupData는 /daily 공급자로 존속.
  if (params.view === "standup") redirect("/daily");
  const user = await getCurrentUser();
  const clientId = await getClientFilter();
  const now = new Date();

  // 리포트 뷰는 관리자 전용 — 비관리자가 URL로 접근하면 운영 보드로 되돌린다.
  const requestedReport = params.view === "report" && user.role === "admin";
  const view = requestedReport ? "report" : "board";

  const VIEWS = [
    { key: "board", label: "운영 보드" },
    ...(user.role === "admin" ? [{ key: "report", label: "리포트" }] : []),
  ] as const;

  const reportPeriod: ReportPeriod = params.period === "month" ? "month" : "week";
  const reportData =
    view === "report" ? await getAdminReportData(user, reportPeriod, now, clientId) : null;

  const data = await getTeamData(user, now, clientId);
  const logs = await getRecentChangeLogs(6);
  const commentsByTask = await getCommentViewsByTask();

  // 요약칩 — 상태색 의미 고정(green=진행, red=문제, amber=주의/대기, violet=응답대기).
  // 0이면 중립으로 강등해 과한 색 노출을 막는다.
  const metrics: { value: number; label: string; tone: string }[] = [
    {
      value: data.summary.inProgress,
      label: "진행중",
      tone: data.summary.inProgress > 0 ? "text-[var(--que-success)]" : "text-[var(--que-text)]",
    },
    {
      value: data.summary.issues,
      label: "문제발생",
      tone: data.summary.issues > 0 ? "text-[var(--que-error)]" : "text-[var(--que-text)]",
    },
    {
      value: data.summary.onHold,
      label: "홀드",
      tone: data.summary.onHold > 0 ? "text-[var(--que-warning)]" : "text-[var(--que-text)]",
    },
    {
      value: data.summary.dueSoon,
      label: "마감 임박",
      tone: data.summary.dueSoon > 0 ? "text-[var(--que-warning)]" : "text-[var(--que-text)]",
    },
    {
      value: data.summary.awaiting,
      label: "상태 응답 대기",
      tone: data.summary.awaiting > 0 ? "text-[var(--que-violet)]" : "text-[var(--que-text)]",
    },
  ];

  return (
    <div>
      <PageHeader
        title="팀 현황"
        subtitle={`오늘 팀의 업무 흐름과 병목 · ${format(now, "M월 d일 (EEE)", { locale: ko })}`}
      />

      <section
        aria-label="팀 요약"
        className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5"
      >
        {metrics.map((metric) => (
          <div
            key={metric.label}
            className="flex min-h-[76px] flex-col justify-center rounded-xl border border-[var(--que-border)] bg-[var(--que-bg)] p-3 shadow-[var(--que-shadow-sm)]"
          >
            <p className={cn("text-2xl font-semibold tabular-nums", metric.tone)}>
              {metric.value}
            </p>
            <p className="mt-1 text-xs text-[var(--que-text-secondary)]">{metric.label}</p>
          </div>
        ))}
      </section>

      <nav
        aria-label="일정 뷰 전환"
        className="mb-4 inline-flex w-fit items-center gap-0.5 rounded-lg border bg-muted/60 p-1"
      >
        {VIEWS.map((v) => (
          <Link
            key={v.key}
            href={v.key === "board" ? "/team" : `/team?view=${v.key}`}
            aria-current={view === v.key ? "page" : undefined}
            className={cn(
              "flex h-10 items-center rounded-md px-3 text-sm font-medium transition-all",
              view === v.key
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:bg-background hover:text-foreground",
            )}
          >
            {v.label}
          </Link>
        ))}
      </nav>

      {view === "report" && reportData && (
        <>
          <nav
            aria-label="리포트 기간 전환"
            className="mb-4 inline-flex w-fit items-center gap-0.5 rounded-lg border bg-muted/60 p-1"
          >
            {(["week", "month"] as const).map((p) => (
              <Link
                key={p}
                href={`/team?view=report&period=${p}`}
                aria-current={reportPeriod === p ? "page" : undefined}
                className={cn(
                  "flex h-10 items-center rounded-md px-3 text-sm font-medium transition-all",
                  reportPeriod === p
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-muted-foreground hover:bg-background hover:text-foreground",
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
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,24rem)]">
        <HomeCard title="사람별 오늘 시간표" bodyClassName="p-0">
          <div className="flex max-h-[62vh] flex-col overflow-y-auto px-4 py-2">
            {data.members.map(({ user: member, items, conflictCount }) => (
              <div
                key={member.id}
                className="flex min-h-12 flex-wrap items-center gap-2 border-b border-[var(--que-border)] py-2 last:border-b-0"
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
                    <span className="text-xs text-[var(--que-text-tertiary)]">오늘 일정 없음</span>
                  )}
                  {items.map((item) => {
                    const chip = (
                      <span
                        className={
                          // 미팅(읽기전용)·작업 칩의 크기를 통일(min-h-10) — 점선·회색은 수정 불가 의미로 유지.
                          item.readonly
                            ? "flex min-h-10 items-center gap-1 rounded-md border border-dashed border-[var(--que-border)] px-2 py-1 text-xs text-[var(--que-text-tertiary)]"
                            : "flex min-h-10 items-center gap-1 rounded-md border border-[var(--que-border)] px-2 py-1 text-xs transition-colors hover:bg-[var(--que-bg-muted)]"
                        }
                      >
                        <span className="tabular-nums text-[var(--que-text-tertiary)]">
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
                      endAt: item.task.endAt,
                      projectId: item.task.projectId,
                      assigneeId: item.task.assigneeId,
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
          </div>
        </HomeCard>

        <div className="flex flex-col gap-4">
          <HomeCard title="지금 봐야 할 일" meta={`${data.attention.length}건`}>
            {data.attention.length === 0 ? (
              <p className="text-sm text-[var(--que-text-tertiary)]">
                지금 봐야 할 항목이 없습니다.
              </p>
            ) : (
              <ul className="flex max-h-[380px] flex-col gap-2 overflow-y-auto pr-0.5">
                {data.attention.map((entry) => (
                  <AttentionRow key={`${entry.type}-${entry.taskId}`} entry={entry} />
                ))}
              </ul>
            )}
          </HomeCard>

          <HomeCard title="일정 충돌" meta={`${data.conflicts.length}건`}>
            <div className="flex flex-col gap-2">
              {data.conflicts.length === 0 && (
                <p className="text-sm text-[var(--que-text-tertiary)]">
                  오늘 일정 충돌이 없습니다.
                </p>
              )}
              {data.conflicts.map((conflict, index) => (
                <p key={index} className="text-sm text-[var(--que-text-secondary)]">
                  <span className="font-medium text-[var(--que-text)]">{conflict.userName}</span> ·{" "}
                  {format(new Date(conflict.overlapStartAt), "HH:mm")}부터{" "}
                  <span className="font-medium text-[var(--que-warning)]">{conflict.aTitle}</span>
                  {josa(conflict.aTitle, "과", "와")}{" "}
                  <span className="font-medium text-[var(--que-warning)]">{conflict.bTitle}</span>
                  {josa(conflict.bTitle, "이", "가")} 겹칩니다
                </p>
              ))}
            </div>
          </HomeCard>

          <HomeCard title="최근 변경 내역">
            <div className="flex max-h-[320px] flex-col gap-3 overflow-y-auto pr-0.5">
              {logs.map((log) => (
                <div key={log.id} className="text-sm">
                  <p className="font-medium text-[var(--que-text)]">{log.text}</p>
                  <p className="text-xs text-[var(--que-text-tertiary)]">
                    {log.actorName} · {format(new Date(log.createdAt), "M/d HH:mm")}
                  </p>
                </div>
              ))}
            </div>
          </HomeCard>
        </div>
      </div>
      )}
    </div>
  );
}

function AttentionRow({ entry }: { entry: AttentionEntry }) {
  // 색·아이콘·라벨은 단일 소스(attention-config)에서 가져온다(DASH-2 — 구 홈 AttentionList는 C-3b에서 은퇴).
  // 홈 PriorityList 룩(색 뱃지 칩 + 제목 + 메타) — 유형은 아이콘+텍스트로 표기(색 단독 금지).
  const config = ATTENTION_CONFIG[entry.type];
  const Icon = config.icon;

  return (
    <li className="rounded-lg border border-[var(--que-border)] p-3">
      <div className="flex items-center gap-2">
        <span
          className={cn(
            "inline-flex shrink-0 items-center gap-1 rounded-md border px-1.5 py-0.5 text-xs font-medium",
            config.className,
          )}
        >
          <Icon className="size-3.5" aria-hidden />
          {config.label}
        </span>
        <p className="min-w-0 flex-1 truncate text-sm font-medium text-[var(--que-text)]">
          {entry.title}
        </p>
      </div>
      <p className="mt-1 text-xs text-[var(--que-text-secondary)]">
        담당 {entry.assigneeName}
        {entry.detail ? ` · ${entry.detail}` : ""}
      </p>
      {((entry.helpUserNames?.length ?? 0) > 0 || entry.nextCheckAt) && (
        <p className="mt-0.5 text-xs text-[var(--que-text-tertiary)]">
          {entry.helpUserNames?.length ? `도움 필요: ${entry.helpUserNames.join(", ")}` : ""}
          {entry.helpUserNames?.length && entry.nextCheckAt ? " · " : ""}
          {entry.nextCheckAt ? `다음 확인 ${format(new Date(entry.nextCheckAt), "HH:mm")}` : ""}
        </p>
      )}
    </li>
  );
}
