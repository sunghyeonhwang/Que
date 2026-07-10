import {
  canEditTask,
  canViewPrivateEventDetail,
  helpUserIdsOf,
  latestStatusLog,
  type CheckIn,
  type Task,
  type User,
} from "@que/core";
import { getDb } from "./db";

// 팀 현황 데이터 조합 (기획서 "팀 현황판").
// 초점은 "누가 일하고 있나"가 아니라 "어디가 막혔나"다.

export interface TeamScheduleItem {
  kind: "task" | "event";
  id: string;
  title: string;
  startAt: string;
  endAt: string;
  taskStatus?: Task["status"];
  readonly?: boolean;
  /** kind가 task일 때 — Sheet 표시용 원본과 뷰어 편집 가능 여부 */
  task?: Task;
  canEdit?: boolean;
}

export interface TeamMemberRow {
  user: User;
  items: TeamScheduleItem[];
  conflictCount: number;
}

export interface AttentionEntry {
  type: "issue" | "on_hold" | "awaiting_response" | "help_request";
  taskId: string;
  title: string;
  assigneeName: string;
  detail?: string;
  /** @deprecated 도움 요청 대상(첫 번째) — 하위호환. 다중은 helpUserNames를 쓴다. */
  helpUserName?: string;
  /** 도움 요청 대상 전체(다중). 비어 있으면 undefined. */
  helpUserNames?: string[];
  nextCheckAt?: string;
}

export interface ConflictEntry {
  userName: string;
  aTitle: string;
  bTitle: string;
  overlapStartAt: string;
}

export interface TeamData {
  summary: {
    inProgress: number;
    issues: number;
    onHold: number;
    dueSoon: number;
    awaiting: number;
  };
  members: TeamMemberRow[];
  attention: AttentionEntry[];
  conflicts: ConflictEntry[];
}

const ACTIVE = new Set(["scheduled", "in_progress", "needs_reschedule", "on_hold", "issue"]);

export async function getTeamData(
  viewer: User,
  now: Date = new Date(),
  clientId?: string,
): Promise<TeamData> {
  const db = await getDb();
  // 표시/집계 소스는 클라이언트 필터를 반영한다. taskById(아래)는 조회용이라 전체를 유지한다.
  const clientTasks = db.tasksForClient(clientId);
  const clientTaskIds = new Set(clientTasks.map((t) => t.id));
  const dayStart = new Date(now);
  dayStart.setHours(0, 0, 0, 0);
  const dayEnd = new Date(now);
  dayEnd.setHours(23, 59, 59, 999);
  const soonLimit = new Date(now.getTime() + 24 * 60 * 60 * 1000);

  const overlapsToday = (startAt?: string, endAt?: string): boolean => {
    if (!startAt) return false;
    const start = new Date(startAt);
    const end = endAt ? new Date(endAt) : start;
    return start <= dayEnd && end >= dayStart;
  };

  const userById = new Map(db.users.map((u) => [u.id, u]));
  // ID→작업 조회 맵: 권한/이름/체크인 참조용. 필터하면 숨은 작업 참조가 깨지므로 전체 유지.
  const taskById = new Map(db.tasks.map((t) => [t.id, t]));

  // ---- 상단 요약 ----
  const activeTasks = clientTasks.filter((t) => ACTIVE.has(t.status));
  const pendingCheckIns = db.checkIns.filter(
    (c) => isAwaiting(c, taskById, now) && clientTaskIds.has(c.taskId),
  );
  const summary = {
    inProgress: activeTasks.filter((t) => t.status === "in_progress").length,
    issues: activeTasks.filter((t) => t.status === "issue").length,
    onHold: activeTasks.filter((t) => t.status === "on_hold").length,
    dueSoon: activeTasks.filter(
      (t) => t.endAt && new Date(t.endAt) >= now && new Date(t.endAt) <= soonLimit,
    ).length,
    awaiting: pendingCheckIns.length,
  };

  // ---- 사람별 오늘 시간표 + 충돌 ----
  const conflicts: ConflictEntry[] = [];
  const members: TeamMemberRow[] = db.users.map((user) => {
    const taskItems: TeamScheduleItem[] = clientTasks
      .filter(
        (t) =>
          t.assigneeId === user.id &&
          overlapsToday(t.startAt, t.endAt) &&
          t.status !== "cancelled" &&
          t.status !== "merged",
      )
      .map((t) => ({
        kind: "task" as const,
        id: t.id,
        title: t.title,
        startAt: t.startAt!,
        endAt: t.endAt ?? t.startAt!,
        taskStatus: t.status,
        task: t,
        canEdit: canEditTask(
          viewer,
          t,
          db.projects.find((p) => p.id === t.projectId),
        ),
      }));

    const eventItems: TeamScheduleItem[] = db.calendarEvents
      .filter(
        (e) =>
          (e.ownerId === user.id || e.attendeeIds.includes(user.id)) &&
          overlapsToday(e.startAt, e.endAt),
      )
      .map((e) => ({
        kind: "event" as const,
        id: e.id,
        title: e.visibility === "private" && !canViewPrivateEventDetail(e, viewer) ? "자리비움" : e.title,
        startAt: e.startAt,
        endAt: e.endAt,
        readonly: true,
      }));

    const items = [...taskItems, ...eventItems].sort((a, b) =>
      a.startAt.localeCompare(b.startAt),
    );

    let conflictCount = 0;
    for (let i = 0; i < items.length; i += 1) {
      for (let j = i + 1; j < items.length; j += 1) {
        const aStart = new Date(items[i].startAt);
        const aEnd = new Date(items[i].endAt);
        const bStart = new Date(items[j].startAt);
        const bEnd = new Date(items[j].endAt);
        if (aStart < bEnd && bStart < aEnd) {
          conflictCount += 1;
          conflicts.push({
            userName: user.name,
            aTitle: items[i].title,
            bTitle: items[j].title,
            overlapStartAt: (aStart > bStart ? aStart : bStart).toISOString(),
          });
        }
      }
    }

    return { user, items, conflictCount };
  });

  // ---- Attention Queue ----
  const attention: AttentionEntry[] = [];
  for (const task of clientTasks.filter((t) => t.status === "issue" || t.status === "on_hold")) {
    const latestLog = latestStatusLog(db.statusLogs, task.id, task.status);
    const helpNames = helpUserIdsOf(latestLog)
      .map((id) => userById.get(id)?.name)
      .filter((n): n is string => Boolean(n));
    attention.push({
      type: task.status === "issue" ? "issue" : "on_hold",
      taskId: task.id,
      title: task.title,
      assigneeName: userById.get(task.assigneeId)?.name ?? task.assigneeId,
      detail: latestLog?.reason,
      helpUserName: helpNames[0],
      helpUserNames: helpNames.length > 0 ? helpNames : undefined,
      nextCheckAt: latestLog?.nextCheckAt,
    });
  }
  for (const checkIn of pendingCheckIns) {
    const task = taskById.get(checkIn.taskId);
    if (!task) continue;
    attention.push({
      type: "awaiting_response",
      taskId: task.id,
      title: task.title,
      assigneeName: userById.get(task.assigneeId)?.name ?? task.assigneeId,
      detail: "자동 체크인 응답 대기",
    });
  }
  // 도움 요청 댓글 — 요청받은 사람이 팀 전체에 보이게 (기획: Attention Queue에 도움 요청 포함)
  for (const comment of db.taskComments) {
    const commentHelpIds = helpUserIdsOf(comment);
    if (commentHelpIds.length === 0) continue;
    const task = taskById.get(comment.taskId);
    if (!task || !clientTaskIds.has(task.id)) continue;
    const commentHelpNames = commentHelpIds
      .map((id) => userById.get(id)?.name)
      .filter((n): n is string => Boolean(n));
    attention.push({
      type: "help_request",
      taskId: `${task.id}-${comment.id}`,
      title: task.title,
      // "담당"은 다른 항목들과 동일하게 작업 담당자 — 작성자는 detail에 표시
      assigneeName: userById.get(task.assigneeId)?.name ?? task.assigneeId,
      detail: `${userById.get(comment.authorId)?.name ?? comment.authorId}: “${comment.body}”`,
      helpUserName: commentHelpNames[0],
      helpUserNames: commentHelpNames.length > 0 ? commentHelpNames : undefined,
    });
  }

  return { summary, members, attention, conflicts };
}

export interface StandupRow {
  user: User;
  /** 어제 시작했고 완료된 작업 */
  yesterdayDone: Task[];
  /** 어제 시작했지만 완료되지 않은 작업 (이월 후보) */
  yesterdayUnfinished: Task[];
  /** 오늘 예정/진행 작업 */
  todayPlanned: Task[];
  /** 막힘 — 문제발생/홀드 (날짜 무관) */
  blocked: Task[];
}

/** 데일리 스탠드업 뷰 — 아침 회의에서 이 화면 하나로 "어제/오늘/막힘"을 돈다. */
export async function getStandupData(
  now: Date = new Date(),
  clientId?: string,
): Promise<StandupRow[]> {
  const db = await getDb();
  const clientTasks = db.tasksForClient(clientId);
  const dayStart = new Date(now);
  dayStart.setHours(0, 0, 0, 0);
  const yesterdayStart = new Date(dayStart);
  yesterdayStart.setDate(yesterdayStart.getDate() - 1);

  const startedIn = (task: Task, from: Date, to: Date): boolean => {
    if (!task.startAt) return false;
    const start = new Date(task.startAt);
    return start >= from && start < to;
  };

  return db.users.map((user) => {
    const mine = clientTasks.filter(
      (t) => t.assigneeId === user.id && t.status !== "cancelled" && t.status !== "merged",
    );
    const yesterday = mine.filter((t) => startedIn(t, yesterdayStart, dayStart));
    const tomorrow = new Date(dayStart);
    tomorrow.setDate(tomorrow.getDate() + 1);
    return {
      user,
      yesterdayDone: yesterday.filter((t) => t.status === "done"),
      yesterdayUnfinished: yesterday.filter((t) => t.status !== "done"),
      todayPlanned: mine.filter(
        (t) => startedIn(t, dayStart, tomorrow) && t.status !== "done",
      ),
      blocked: mine.filter((t) => t.status === "issue" || t.status === "on_hold"),
    };
  });
}

function isAwaiting(checkIn: CheckIn, taskById: Map<string, Task>, now: Date): boolean {
  const task = taskById.get(checkIn.taskId);
  if (!task || !ACTIVE.has(task.status)) return false;
  // 스누즈 중(재확인 시각이 아직 미래)이면 '응답대기'에서 제외한다.
  if (checkIn.snoozeUntil && new Date(checkIn.snoozeUntil) > now) return false;
  return !checkIn.answeredAt || (checkIn.response === "later" && checkIn.followUpRequired);
}
