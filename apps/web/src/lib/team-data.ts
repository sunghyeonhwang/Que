import type { CheckIn, Task, User } from "@que/core";
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
}

export interface TeamMemberRow {
  user: User;
  items: TeamScheduleItem[];
  conflictCount: number;
}

export interface AttentionEntry {
  type: "issue" | "on_hold" | "awaiting_response";
  taskId: string;
  title: string;
  assigneeName: string;
  detail?: string;
  helpUserName?: string;
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

export function getTeamData(viewer: User, now: Date = new Date()): TeamData {
  const db = getDb();
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
  const taskById = new Map(db.tasks.map((t) => [t.id, t]));

  // ---- 상단 요약 ----
  const activeTasks = db.tasks.filter((t) => ACTIVE.has(t.status));
  const pendingCheckIns = db.checkIns.filter((c) => isAwaiting(c, taskById));
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
    const taskItems: TeamScheduleItem[] = db.tasks
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
        title: e.visibility === "private" && e.ownerId !== viewer.id ? "자리비움" : e.title,
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
  for (const task of db.tasks.filter((t) => t.status === "issue" || t.status === "on_hold")) {
    const latestLog = [...db.statusLogs]
      .reverse()
      .find((log) => log.taskId === task.id && log.toStatus === task.status);
    attention.push({
      type: task.status === "issue" ? "issue" : "on_hold",
      taskId: task.id,
      title: task.title,
      assigneeName: userById.get(task.assigneeId)?.name ?? task.assigneeId,
      detail: latestLog?.reason,
      helpUserName: latestLog?.helpUserId
        ? userById.get(latestLog.helpUserId)?.name
        : undefined,
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

  return { summary, members, attention, conflicts };
}

function isAwaiting(checkIn: CheckIn, taskById: Map<string, Task>): boolean {
  const task = taskById.get(checkIn.taskId);
  if (!task || !ACTIVE.has(task.status)) return false;
  return !checkIn.answeredAt || (checkIn.response === "later" && checkIn.followUpRequired);
}
