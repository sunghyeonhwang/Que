import { format } from "date-fns";
import { ko } from "date-fns/locale";
import {
  canViewPrivateEventDetail,
  formatProjectLabel,
  TASK_STATUS_LABELS,
  type TaskStatus,
  type User,
} from "@que/core";
import { getDb } from "./db";
import type { ListViewMember } from "./pm-types";

// 홈(개인 대시보드) 전용 조회 계층. 순수 조회 — mutation/도메인 규칙에 손대지 않는다.
// 데이터 출처: core db(tasks/calendarEvents/users/projects). KPI·히트맵·작업성과는
// performance-data(getPerformanceData)를 페이지에서 그대로 재사용한다.

/** 진행 흐름에 남아 있는(취소/병합/완료가 아닌) 작업 상태 */
const ACTIVE = new Set<TaskStatus>([
  "scheduled",
  "in_progress",
  "needs_reschedule",
  "on_hold",
  "issue",
]);

export interface HomeTodoItem {
  id: string;
  title: string;
  status: TaskStatus;
  statusLabel: string;
  /** 소속 프로젝트명(카테고리 칩). 없으면 null. */
  category: string | null;
  /** "9월 8일 금요일" 형태. 없으면 null. */
  dueLabel: string | null;
  assignees: ListViewMember[];
  /** 마감이 지났고 아직 미완료 */
  overdue: boolean;
}

export interface HomeScheduleItem {
  id: string;
  kind: "task" | "event";
  title: string;
  /** "09:30 - 11:00" 또는 "09:30". */
  timeLabel: string;
  /** 좌측 라인/점 색(hex). task=상태색, event=중립. */
  color: string;
}

export interface HomeDistributionRow {
  id: string;
  name: string;
  value: number;
  color: string;
}

export interface HomeData {
  /** 인사말용 이름(성 제외). 예: "황성현" → "성현". */
  givenName: string;
  /** 헤더 아바타 스택(팀원). */
  headerMembers: ListViewMember[];
  memberOverflow: number;
  /** 오늘 할 일: 내 미완료 작업 중 오늘 마감 또는 기한 초과. */
  todos: HomeTodoItem[];
  todoCount: number;
  /** 오늘 내 일정(작업+이벤트) 시간순. */
  schedule: HomeScheduleItem[];
  /** "7월 3일 목요일". */
  scheduleDateLabel: string;
  /** 작업 분포: 멤버별 활성 작업 수. */
  distribution: HomeDistributionRow[];
}

// 상태색(의미 고정): green=진행/완료, blue=예정/정보, amber=주의/대기, red=문제/취소.
// --que-* 토큰이라 다크모드 대응(소비처가 인라인 backgroundColor·SVG Cell fill이라 var() 해석됨).
const STATUS_COLOR: Record<TaskStatus, string> = {
  scheduled: "var(--que-brand)",
  in_progress: "var(--que-success)",
  done: "var(--que-success)",
  needs_reschedule: "var(--que-warning)",
  on_hold: "var(--que-warning)",
  issue: "var(--que-error)",
  cancelled: "var(--que-error)",
  merged: "var(--que-text-tertiary)",
};

export interface HomeOptions {
  /** 작업 분포 창: week=향후 7일, month=향후 30일 내 마감. 기본 "week". */
  dp?: "week" | "month";
  /** 클라이언트 필터. 지정 시 그 클라이언트 소속 프로젝트 작업만(무소속 제외). */
  clientId?: string;
}

export async function getHomeData(
  user: User,
  now: Date = new Date(),
  opts: HomeOptions = {},
): Promise<HomeData> {
  const db = await getDb();
  // 오늘 할 일·개인 일정(task)·작업 분포의 task 소스만 클라이언트로 좁힌다(미지정 시 전체).
  // 개인 일정의 calendar_event는 사람 단위 일정이라 필터하지 않는다(constraint).
  const clientTasks = db.tasksForClient(opts.clientId);
  const userById = new Map(db.users.map((u) => [u.id, u]));
  const projectById = new Map(db.projects.map((p) => [p.id, p]));
  const clientById = new Map(db.clients.map((c) => [c.id, c]));
  const projectLabel = (projectId?: string): string | null => {
    if (!projectId) return null;
    const project = projectById.get(projectId);
    if (!project) return null;
    return formatProjectLabel(project, project.clientId ? clientById.get(project.clientId) : undefined);
  };

  const toMember = (id: string): ListViewMember | null => {
    const u = userById.get(id);
    return u ? { id: u.id, name: u.name, avatarColor: u.avatarColor } : null;
  };

  const dayEnd = new Date(now);
  dayEnd.setHours(23, 59, 59, 999);
  const nowMs = now.getTime();

  // ── 헤더 아바타 스택(팀원 최대 4 + overflow) ──
  const allMembers = db.users
    .map((u) => toMember(u.id))
    .filter((m): m is ListViewMember => m !== null);
  const headerMembers = allMembers.slice(0, 4);
  const memberOverflow = Math.max(0, allMembers.length - 4);

  // ── 오늘 할 일: 내 미완료 작업 중 마감이 오늘 이내(오늘/기한초과) ──
  const todosRaw = clientTasks.filter(
    (t) =>
      t.assigneeId === user.id &&
      ACTIVE.has(t.status) &&
      t.endAt !== undefined &&
      new Date(t.endAt).getTime() <= dayEnd.getTime(),
  );

  const todos: HomeTodoItem[] = todosRaw
    .map((t) => {
      const endMs = t.endAt ? new Date(t.endAt).getTime() : undefined;
      const assignees = [t.assigneeId, ...(t.ownerId !== t.assigneeId ? [t.ownerId] : [])]
        .map(toMember)
        .filter((m): m is ListViewMember => m !== null);
      return {
        id: t.id,
        title: t.title,
        status: t.status,
        statusLabel: TASK_STATUS_LABELS[t.status] ?? t.status,
        category: projectLabel(t.projectId),
        dueLabel: t.endAt
          ? format(new Date(t.endAt), "M월 d일 EEEE", { locale: ko })
          : null,
        assignees,
        overdue: endMs !== undefined && endMs < nowMs,
      };
    })
    .sort((a, b) => Number(b.overdue) - Number(a.overdue));

  // ── 오늘 내 일정(작업+이벤트) ──
  const dayStart = new Date(now);
  dayStart.setHours(0, 0, 0, 0);
  const overlapsToday = (startAt?: string, endAt?: string): boolean => {
    if (!startAt && !endAt) return false;
    const start = startAt ? new Date(startAt) : new Date(endAt!);
    const end = endAt ? new Date(endAt) : start;
    return start <= dayEnd && end >= dayStart;
  };
  const fmtTime = (iso: string) => format(new Date(iso), "HH:mm");

  const scheduleTasks: HomeScheduleItem[] = clientTasks
    .filter(
      (t) =>
        t.assigneeId === user.id &&
        t.status !== "cancelled" &&
        t.status !== "merged" &&
        overlapsToday(t.startAt, t.endAt),
    )
    .map((t) => ({
      id: t.id,
      kind: "task" as const,
      title: t.title,
      timeLabel: t.startAt
        ? `${fmtTime(t.startAt)}${t.endAt ? ` - ${fmtTime(t.endAt)}` : ""}`
        : "시간 미정",
      color: STATUS_COLOR[t.status] ?? "var(--que-text-tertiary)",
    }));

  const scheduleEvents: HomeScheduleItem[] = db.calendarEvents
    .filter(
      (e) =>
        (e.ownerId === user.id || e.attendeeIds.includes(user.id)) &&
        overlapsToday(e.startAt, e.endAt),
    )
    .map((e) => ({
      id: e.id,
      kind: "event" as const,
      title:
        e.visibility === "private" && !canViewPrivateEventDetail(e, user)
          ? "자리비움"
          : e.title,
      timeLabel: `${fmtTime(e.startAt)} - ${fmtTime(e.endAt)}`,
      color: "var(--que-text-tertiary)",
    }));

  const schedule = [...scheduleTasks, ...scheduleEvents].sort((a, b) =>
    a.timeLabel.localeCompare(b.timeLabel),
  );

  // ── 작업 분포: 멤버별 향후 기간 내 마감 활성작업 수(멤버 색). ──
  // week=now~+7일, month=now~+30일 사이 endAt인 활성 작업.
  const windowDays = opts.dp === "month" ? 30 : 7;
  const windowEnd = new Date(now);
  windowEnd.setDate(windowEnd.getDate() + windowDays);
  const windowEndMs = windowEnd.getTime();
  const distribution: HomeDistributionRow[] = db.users
    .map((u) => ({
      id: u.id,
      name: u.name,
      value: clientTasks.filter((t) => {
        if (t.assigneeId !== u.id || !ACTIVE.has(t.status) || !t.endAt) return false;
        const e = new Date(t.endAt).getTime();
        return e >= nowMs && e <= windowEndMs;
      }).length,
      color: u.avatarColor,
    }))
    .sort((a, b) => b.value - a.value);

  return {
    givenName: user.name.slice(1) || user.name,
    headerMembers,
    memberOverflow,
    todos,
    todoCount: todos.length,
    schedule,
    scheduleDateLabel: format(now, "M월 d일 EEEE", { locale: ko }),
    distribution,
  };
}
