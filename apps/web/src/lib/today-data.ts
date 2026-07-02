import type { CalendarEvent, CheckIn, Task, User } from "@que/core";
import { getDb } from "./db";

// 오늘 화면 데이터 조합. 조회 로직은 화면이 아니라 여기 모아 재사용한다.

export interface TodayTimelineItem {
  kind: "task" | "event";
  id: string;
  title: string;
  startAt?: string;
  endAt?: string;
  task?: Task;
  event?: CalendarEvent;
}

export interface PendingCheckIn {
  checkIn: CheckIn;
  task: Task;
}

export interface AttentionTask {
  task: Task;
  reason?: string;
  helpUserName?: string;
  nextCheckAt?: string;
}

export interface TodayData {
  myTasks: Task[];
  timeline: TodayTimelineItem[];
  pendingCheckIns: PendingCheckIn[];
  dueSoon: Task[];
  attention: AttentionTask[];
  conflictCount: number;
  /** 하루 마감 요약 (기획서 "추가 아이디어 4") */
  wrapUp: { doneToday: Task[]; unfinished: Task[] };
}

const ACTIVE_STATUSES = new Set(["scheduled", "in_progress", "needs_reschedule", "on_hold", "issue"]);

export function getTodayData(user: User, now: Date = new Date()): TodayData {
  const db = getDb();
  const dayStart = new Date(now);
  dayStart.setHours(0, 0, 0, 0);
  const dayEnd = new Date(now);
  dayEnd.setHours(23, 59, 59, 999);

  const overlapsToday = (startAt?: string, endAt?: string): boolean => {
    if (!startAt && !endAt) return false;
    const start = startAt ? new Date(startAt) : new Date(endAt!);
    const end = endAt ? new Date(endAt) : start;
    return start <= dayEnd && end >= dayStart;
  };

  const myTasks = db.tasks
    .filter((t) => t.assigneeId === user.id && overlapsToday(t.startAt, t.endAt))
    .sort(byStart);

  const myEvents = db.calendarEvents
    .filter(
      (e) =>
        (e.ownerId === user.id || e.attendeeIds.includes(user.id)) &&
        overlapsToday(e.startAt, e.endAt),
    )
    .sort((a, b) => a.startAt.localeCompare(b.startAt));

  const timeline: TodayTimelineItem[] = [
    ...myTasks.map((task): TodayTimelineItem => ({
      kind: "task",
      id: task.id,
      title: task.title,
      startAt: task.startAt,
      endAt: task.endAt,
      task,
    })),
    ...myEvents.map((event): TodayTimelineItem => ({
      kind: "event",
      id: event.id,
      title: event.visibility === "private" && event.ownerId !== user.id ? "자리비움" : event.title,
      startAt: event.startAt,
      endAt: event.endAt,
      event,
    })),
  ].sort((a, b) => (a.startAt ?? "").localeCompare(b.startAt ?? ""));

  const taskById = new Map(db.tasks.map((t) => [t.id, t]));
  const pendingCheckIns: PendingCheckIn[] = db.checkIns
    .filter(
      (c) =>
        c.assigneeId === user.id &&
        (!c.answeredAt || (c.response === "later" && c.followUpRequired)),
    )
    .flatMap((checkIn) => {
      const task = taskById.get(checkIn.taskId);
      // 이미 상태가 정리된 작업은 다시 묻지 않는다 (기획서 체크인 정책)
      if (!task || !ACTIVE_STATUSES.has(task.status)) return [];
      return [{ checkIn, task }];
    });

  const soonLimit = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  const dueSoon = db.tasks
    .filter(
      (t) =>
        t.assigneeId === user.id &&
        t.endAt &&
        ACTIVE_STATUSES.has(t.status) &&
        new Date(t.endAt) <= soonLimit &&
        new Date(t.endAt) >= now,
    )
    .sort(byStart);

  const userById = new Map(db.users.map((u) => [u.id, u]));
  const attention: AttentionTask[] = db.tasks
    .filter((t) => t.status === "issue" || t.status === "on_hold")
    .flatMap((task) => {
      const latestLog = [...db.statusLogs]
        .reverse()
        .find((log) => log.taskId === task.id && log.toStatus === task.status);
      // 내가 관련된 문제/홀드: 담당자, 소유자, 도움 요청 대상. 관리자는 전체를 본다.
      const involved =
        task.assigneeId === user.id ||
        task.ownerId === user.id ||
        latestLog?.helpUserId === user.id ||
        user.role === "admin";
      if (!involved) return [];
      return [
        {
          task,
          reason: latestLog?.reason,
          nextCheckAt: latestLog?.nextCheckAt,
          helpUserName: latestLog?.helpUserId
            ? userById.get(latestLog.helpUserId)?.name
            : undefined,
        },
      ];
    });

  const timed = timeline.filter((item) => item.startAt && item.endAt);
  let conflictCount = 0;
  for (let i = 0; i < timed.length; i += 1) {
    for (let j = i + 1; j < timed.length; j += 1) {
      if (
        timed[i].startAt! < timed[j].endAt! &&
        timed[j].startAt! < timed[i].endAt!
      ) {
        conflictCount += 1;
      }
    }
  }

  // 하루 마감: 오늘 완료한 것 / 오늘 시작했지만 끝나지 않은 것 (내일로 넘길 후보)
  const UNFINISHED = new Set(["scheduled", "in_progress", "needs_reschedule"]);
  const wrapUp = {
    doneToday: myTasks.filter((t) => t.status === "done"),
    unfinished: myTasks.filter((t) => UNFINISHED.has(t.status)),
  };

  return { myTasks, timeline, pendingCheckIns, dueSoon, attention, conflictCount, wrapUp };
}

function byStart(a: Task, b: Task): number {
  return (a.startAt ?? a.endAt ?? "").localeCompare(b.startAt ?? b.endAt ?? "");
}
