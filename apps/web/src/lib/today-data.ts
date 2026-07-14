import {
  canViewPrivateEventDetail,
  helpUserIdsOf,
  latestStatusLog,
  type CalendarEvent,
  type CheckIn,
  type Task,
  type TaskComment,
  type User,
} from "@que/core";
import { getDb } from "./db";
import { dateKeyOfIso } from "./daily-data";

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
  /** @deprecated 도움 요청 대상(첫 번째) — 하위호환. 다중은 helpUserNames를 쓴다. */
  helpUserName?: string;
  /** 도움 요청 대상 전체(다중). 비어 있으면 undefined. */
  helpUserNames?: string[];
  nextCheckAt?: string;
}

/** 일정 충돌 + 변경 제안 (기획서 "추가 아이디어 3": 회사 일정과 겹치면 변경을 제안한다) */
export interface ConflictSuggestion {
  task: Task;
  blockerTitle: string;
  blockerStartAt: string;
  blockerEndAt: string;
  /** 제안: 겹치는 일정 종료 직후로 이동 (지속시간 유지) */
  suggestedStartAt: string;
  suggestedEndAt: string;
}

export interface TodayData {
  myTasks: Task[];
  timeline: TodayTimelineItem[];
  pendingCheckIns: PendingCheckIn[];
  dueSoon: Task[];
  attention: AttentionTask[];
  conflictCount: number;
  conflictSuggestions: ConflictSuggestion[];
  /** 하루 마감 요약 (기획서 "추가 아이디어 4") */
  wrapUp: { doneToday: Task[]; unfinished: Task[] };
  /** 나에게 온 도움 요청 댓글 (최근 순) */
  helpRequests: (TaskComment & { taskTitle: string; authorName: string })[];
}

const ACTIVE_STATUSES = new Set(["scheduled", "in_progress", "needs_reschedule", "on_hold", "issue"]);

export async function getTodayData(
  user: User,
  now: Date = new Date(),
  clientId?: string,
): Promise<TodayData> {
  const db = await getDb();
  // 화면에 나열/집계되는 작업 소스만 클라이언트 필터를 건다. ID→작업 조회 맵(taskById)은
  // 숨은 작업의 제목까지 참조하므로 전체(db.tasks) 유지한다.
  const clientTasks = db.tasksForClient(clientId);
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

  const myTasks = clientTasks
    .filter(
      (t) =>
        t.assigneeId === user.id &&
        // 취소(soft delete)·병합된 작업은 능동 화면(타임라인 포함)에서 숨긴다. 이력엔 남아 있다.
        t.status !== "cancelled" &&
        t.status !== "merged" &&
        overlapsToday(t.startAt, t.endAt),
    )
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
      title:
        event.visibility === "private" && !canViewPrivateEventDetail(event, user)
          ? "자리비움"
          : event.title,
      startAt: event.startAt,
      endAt: event.endAt,
      event,
    })),
  ].sort((a, b) => (a.startAt ?? "").localeCompare(b.startAt ?? ""));

  // 조회 맵은 전체 유지: pendingCheckIn·helpRequests가 필터로 숨은 작업의 제목도 찾아야 한다.
  const taskById = new Map(db.tasks.map((t) => [t.id, t]));
  const pendingCheckIns: PendingCheckIn[] = db.checkIns
    .filter(
      (c) =>
        c.assigneeId === user.id &&
        (!c.answeredAt || (c.response === "later" && c.followUpRequired)) &&
        // 스누즈 중(재확인 시각이 아직 미래)이면 제외한다 — 시각이 지나면 자동 재노출.
        !(c.snoozeUntil && new Date(c.snoozeUntil) > now),
    )
    .flatMap((checkIn) => {
      const task = taskById.get(checkIn.taskId);
      // 이미 상태가 정리된 작업은 다시 묻지 않는다 (기획서 체크인 정책)
      if (!task || !ACTIVE_STATUSES.has(task.status)) return [];
      return [{ checkIn, task }];
    });

  const soonLimit = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  const dueSoon = clientTasks
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
  const attention: AttentionTask[] = clientTasks
    .filter((t) => t.status === "issue" || t.status === "on_hold")
    .flatMap((task) => {
      const latestLog = latestStatusLog(db.statusLogs, task.id, task.status);
      const helpIds = helpUserIdsOf(latestLog);
      // 내가 관련된 문제/홀드: 담당자, 소유자, 도움 요청 대상(다중 중 하나라도). 관리자는 전체를 본다.
      const involved =
        task.assigneeId === user.id ||
        task.ownerId === user.id ||
        helpIds.includes(user.id) ||
        user.role === "admin";
      if (!involved) return [];
      const helpNames = helpIds
        .map((id) => userById.get(id)?.name)
        .filter((n): n is string => Boolean(n));
      return [
        {
          task,
          reason: latestLog?.reason,
          nextCheckAt: latestLog?.nextCheckAt,
          helpUserName: helpNames[0],
          helpUserNames: helpNames.length > 0 ? helpNames : undefined,
        },
      ];
    });

  // 분 단위 충돌 검사 대상 = 하루짜리 시간 블록만.
  // 기간 작업(KST 시작 날짜 ≠ 마감 날짜)은 여러 날에 걸쳐 종일 겹침으로 잡혀 충돌 스팸을 내므로 제외한다.
  // (하루 시간 블록끼리 · 시간 블록 vs 회사 일정 충돌·재배치 제안은 그대로.)
  const timed = timeline.filter(
    (item) =>
      item.startAt &&
      item.endAt &&
      dateKeyOfIso(item.startAt) === dateKeyOfIso(item.endAt),
  );
  let conflictCount = 0;
  const conflictSuggestions: ConflictSuggestion[] = [];
  for (let i = 0; i < timed.length; i += 1) {
    for (let j = i + 1; j < timed.length; j += 1) {
      const a = timed[i];
      const b = timed[j];
      if (!(a.startAt! < b.endAt! && b.startAt! < a.endAt!)) continue;
      conflictCount += 1;

      // 변경 제안: "움직일 수 있는 내 작업"이 "고정된 일정(회사 일정 등)"과 겹칠 때,
      // 아직 시작 전(scheduled)인 작업을 겹치는 일정 종료 직후로 옮기자고 제안한다.
      const [taskItem, blocker] =
        a.kind === "task" && b.kind === "event"
          ? [a, b]
          : b.kind === "task" && a.kind === "event"
            ? [b, a]
            : [undefined, undefined];
      if (!taskItem?.task || taskItem.task.status !== "scheduled" || !blocker) continue;

      const durationMs =
        new Date(taskItem.endAt!).getTime() - new Date(taskItem.startAt!).getTime();
      const suggestedStart = new Date(blocker.endAt!);
      conflictSuggestions.push({
        task: taskItem.task,
        blockerTitle: blocker.title,
        blockerStartAt: blocker.startAt!,
        blockerEndAt: blocker.endAt!,
        suggestedStartAt: suggestedStart.toISOString(),
        suggestedEndAt: new Date(suggestedStart.getTime() + durationMs).toISOString(),
      });
    }
  }

  // 하루 마감: 오늘 완료한 것 / 오늘 시작했지만 끝나지 않은 것 (내일로 넘길 후보)
  const UNFINISHED = new Set(["scheduled", "in_progress", "needs_reschedule"]);
  const wrapUp = {
    doneToday: myTasks.filter((t) => t.status === "done"),
    unfinished: myTasks.filter((t) => UNFINISHED.has(t.status)),
  };

  // 나에게 온 도움 요청 + 작업별 댓글 뷰
  const helpRequests = db.taskComments
    .filter((c) => helpUserIdsOf(c).includes(user.id))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .map((c) => ({
      ...c,
      taskTitle: taskById.get(c.taskId)?.title ?? c.taskId,
      authorName: userById.get(c.authorId)?.name ?? c.authorId,
    }));

  return {
    myTasks,
    timeline,
    pendingCheckIns,
    dueSoon,
    attention,
    conflictCount,
    conflictSuggestions,
    wrapUp,
    helpRequests,
  };
}

function byStart(a: Task, b: Task): number {
  return (a.startAt ?? a.endAt ?? "").localeCompare(b.startAt ?? b.endAt ?? "");
}
