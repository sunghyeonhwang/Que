import {
  canEditTask,
  canViewMeetingNote,
  canViewPrivateEventDetail,
  type ActionItemStatus,
  type TaskStatus,
  type User,
} from "@que/core";
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
  // --- 행 클릭 상세 Sheet(TaskStatusSheet)용 — Que 작업 행에만 채워진다 ---
  taskId?: string;
  assigneeId?: string;
  projectId?: string;
  endAt?: string;
  description?: string;
  /** 뷰어가 이 작업을 수정할 수 있는지(core canEditTask). Sheet가 편집 UI 노출을 결정. */
  canEdit?: boolean;
  // --- Action 행 상세 이동용 — 해당 회의록 필터로 링크 ---
  noteId?: string;
}

export interface NowData {
  rows: NowRow[];
  summary: {
    calendarCount: number;
    actionCount: number;
    issueHold: number;
    dueToday: number;
    missingAssignee: number;
    /** 오늘 팀 전체 일정 충돌 쌍 수 (팀 현황 충돌 목록과 동일 기준) */
    scheduleConflicts: number;
  };
}

const UNRESOLVED: ActionItemStatus[] = ["needs_review", "candidate", "held"];

export async function getNowData(
  viewer: User,
  filter: NowFilter,
  now: Date = new Date(),
  clientId?: string,
): Promise<NowData> {
  const db = await getDb();
  // 운영표 행/집계에 쓰는 작업 소스만 클라이언트 필터. 회사 일정·Action은 필터 대상 아님.
  const clientTasks = db.tasksForClient(clientId);
  const dayStart = new Date(now);
  dayStart.setHours(0, 0, 0, 0);
  const dayEnd = new Date(now);
  dayEnd.setHours(23, 59, 59, 999);
  const inToday = (iso?: string): boolean =>
    !!iso && new Date(iso) <= dayEnd && new Date(iso) >= dayStart;

  const userById = new Map(db.users.map((u) => [u.id, u]));
  const noteById = new Map(db.meetingNotes.map((n) => [n.id, n]));
  const projectById = new Map(db.projects.map((p) => [p.id, p]));

  const taskRows: NowRow[] = clientTasks
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
      taskId: task.id,
      assigneeId: task.assigneeId,
      projectId: task.projectId,
      endAt: task.endAt,
      description: task.description,
      canEdit: canEditTask(
        viewer,
        task,
        task.projectId ? projectById.get(task.projectId) : undefined,
      ),
    }));

  const eventRows: NowRow[] = db.calendarEvents
    .filter((e) => inToday(e.startAt))
    .map((event) => ({
      key: `event-${event.id}`,
      at: event.startAt,
      kind: "calendar" as const,
      title:
        event.visibility === "private" && !canViewPrivateEventDetail(event, viewer)
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
    .filter((item) => {
      const note = noteById.get(item.meetingNoteId);
      return !note || canViewMeetingNote(viewer, note);
    })
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
      noteId: item.meetingNoteId,
    }));

  let rows = [...taskRows, ...eventRows, ...actionRows].sort((a, b) =>
    (a.at ?? "9999").localeCompare(b.at ?? "9999"),
  );
  if (filter === "mine") rows = rows.filter((r) => r.mine);
  if (filter === "issue") rows = rows.filter((r) => r.attention);

  // 오늘 팀 전체 일정 충돌 — 사람별 오늘 시간표(작업+일정)에서 겹치는 쌍을 센다.
  // team-data.ts의 팀 충돌 감지와 동일 기준(start < other.end && other.start < end).
  const overlapsTodayRange = (startAt?: string, endAt?: string): boolean => {
    if (!startAt) return false;
    const start = new Date(startAt);
    const end = endAt ? new Date(endAt) : start;
    return start <= dayEnd && end >= dayStart;
  };
  let scheduleConflicts = 0;
  for (const member of db.users) {
    const items: { startAt: string; endAt: string }[] = [
      ...clientTasks
        .filter(
          (t) =>
            t.assigneeId === member.id &&
            overlapsTodayRange(t.startAt, t.endAt) &&
            t.status !== "cancelled" &&
            t.status !== "merged",
        )
        .map((t) => ({ startAt: t.startAt!, endAt: t.endAt ?? t.startAt! })),
      ...db.calendarEvents
        .filter(
          (e) =>
            (e.ownerId === member.id || e.attendeeIds.includes(member.id)) &&
            overlapsTodayRange(e.startAt, e.endAt),
        )
        .map((e) => ({ startAt: e.startAt, endAt: e.endAt })),
    ].sort((a, b) => a.startAt.localeCompare(b.startAt));
    for (let i = 0; i < items.length; i += 1) {
      for (let j = i + 1; j < items.length; j += 1) {
        if (
          new Date(items[i].startAt) < new Date(items[j].endAt) &&
          new Date(items[j].startAt) < new Date(items[i].endAt)
        ) {
          scheduleConflicts += 1;
        }
      }
    }
  }

  const summary = {
    calendarCount: taskRows.length + eventRows.length,
    actionCount: actionRows.length,
    issueHold: taskRows.filter((r) => r.attention).length,
    dueToday:
      clientTasks.filter(
        (t) =>
          inToday(t.endAt) && t.status !== "done" && t.status !== "cancelled" && t.status !== "merged",
      ).length + actionRows.filter((r) => inToday(r.at)).length,
    missingAssignee: db.actionItems.filter(
      (item) => item.status === "needs_review" && !item.assigneeId,
    ).length,
    scheduleConflicts,
  };

  return { rows, summary };
}
