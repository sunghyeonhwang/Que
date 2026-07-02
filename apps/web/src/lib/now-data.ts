import type { ActionItemStatus, TaskStatus, User } from "@que/core";
import { getDb } from "./db";

// Now 통합표 — 캘린더 일정과 회의록 Action을 한 표로 합친다 (기획서 "Now 통합표").

export type NowFilter = "all" | "mine" | "issue";

export interface NowRow {
  key: string;
  /** 정렬/표시용 시각 (일정은 시작, Action은 마감) */
  at?: string;
  kind: "calendar" | "action";
  title: string;
  assigneeName?: string;
  taskStatus?: TaskStatus;
  actionStatus?: ActionItemStatus;
  eventLabel?: "회사 일정" | "Que 일정";
  source: string;
  mine: boolean;
  attention: boolean;
}

export interface NowData {
  rows: NowRow[];
  summary: {
    calendarCount: number;
    actionCount: number;
    issueHold: number;
    dueToday: number;
    missingAssignee: number;
  };
}

const UNRESOLVED: ActionItemStatus[] = ["needs_review", "candidate", "held"];

export function getNowData(viewer: User, filter: NowFilter, now: Date = new Date()): NowData {
  const db = getDb();
  const dayStart = new Date(now);
  dayStart.setHours(0, 0, 0, 0);
  const dayEnd = new Date(now);
  dayEnd.setHours(23, 59, 59, 999);
  const inToday = (iso?: string): boolean =>
    !!iso && new Date(iso) <= dayEnd && new Date(iso) >= dayStart;

  const userById = new Map(db.users.map((u) => [u.id, u]));
  const noteById = new Map(db.meetingNotes.map((n) => [n.id, n]));

  const taskRows: NowRow[] = db.tasks
    .filter(
      (t) =>
        inToday(t.startAt) && t.status !== "cancelled" && t.status !== "merged",
    )
    .map((task) => ({
      key: `task-${task.id}`,
      at: task.startAt,
      kind: "calendar" as const,
      title: task.title,
      assigneeName: userById.get(task.assigneeId)?.name,
      taskStatus: task.status,
      source: task.source === "action_item" ? "회의록 Action" : "Que 캘린더",
      mine: task.assigneeId === viewer.id || task.ownerId === viewer.id,
      attention: task.status === "issue" || task.status === "on_hold",
    }));

  const eventRows: NowRow[] = db.calendarEvents
    .filter((e) => inToday(e.startAt))
    .map((event) => ({
      key: `event-${event.id}`,
      at: event.startAt,
      kind: "calendar" as const,
      title:
        event.visibility === "private" && event.ownerId !== viewer.id
          ? "자리비움"
          : event.title,
      assigneeName: userById.get(event.ownerId)?.name,
      eventLabel: event.source === "company" ? ("회사 일정" as const) : ("Que 일정" as const),
      source: event.source === "company" ? "회사 캘린더" : "Que 캘린더",
      mine: event.ownerId === viewer.id || event.attendeeIds.includes(viewer.id),
      attention: false,
    }));

  const actionRows: NowRow[] = db.actionItems
    .filter((item) => UNRESOLVED.includes(item.status))
    .map((item) => ({
      key: `action-${item.id}`,
      at: item.dueAt,
      kind: "action" as const,
      title: item.title,
      assigneeName: item.assigneeId ? userById.get(item.assigneeId)?.name : undefined,
      actionStatus: item.status,
      source: noteById.get(item.meetingNoteId)?.fileName ?? item.meetingNoteId,
      mine: item.assigneeId === viewer.id,
      attention: item.status === "needs_review",
    }));

  let rows = [...taskRows, ...eventRows, ...actionRows].sort((a, b) =>
    (a.at ?? "9999").localeCompare(b.at ?? "9999"),
  );
  if (filter === "mine") rows = rows.filter((r) => r.mine);
  if (filter === "issue") rows = rows.filter((r) => r.attention);

  const summary = {
    calendarCount: taskRows.length + eventRows.length,
    actionCount: actionRows.length,
    issueHold: taskRows.filter((r) => r.attention).length,
    dueToday:
      db.tasks.filter(
        (t) =>
          inToday(t.endAt) && t.status !== "done" && t.status !== "cancelled" && t.status !== "merged",
      ).length + actionRows.filter((r) => inToday(r.at)).length,
    missingAssignee: db.actionItems.filter(
      (item) => item.status === "needs_review" && !item.assigneeId,
    ).length,
  };

  return { rows, summary };
}
