import type { Milestone, Project, Task, User } from "@que/core";
import { getDb } from "./db";

// 캘린더 3뷰(기본형/전체 멤버/타임라인)가 공유하는 데이터 조합.
// 표시 규칙 (기획서 "캘린더 화면"):
// - 회사 일정: 읽기 전용(이동 불가), 비공개 일정은 제목 대신 "자리비움"
// - Que 작업/마일스톤: 드래그 이동 가능 (서버 규칙이 최종 강제)

export interface CalendarViewItem {
  kind: "task" | "event" | "milestone";
  id: string;
  title: string;
  startAt: string;
  endAt: string;
  ownerId: string;
  ownerName: string;
  ownerColor: string;
  movable: boolean;
  taskStatus?: Task["status"];
  projectName?: string;
  isPrivate?: boolean;
}

export interface CalendarData {
  items: CalendarViewItem[];
  milestones: (Milestone & { projectName: string })[];
  projects: Project[];
  users: User[];
}

export function getCalendarData(
  viewer: User,
  rangeStart: Date,
  rangeEnd: Date,
): CalendarData {
  const db = getDb();
  const userById = new Map(db.users.map((u) => [u.id, u]));
  const projectById = new Map(db.projects.map((p) => [p.id, p]));

  const overlaps = (startAt?: string, endAt?: string): boolean => {
    if (!startAt) return false;
    const start = new Date(startAt);
    const end = endAt ? new Date(endAt) : start;
    return start <= rangeEnd && end >= rangeStart;
  };

  const taskItems: CalendarViewItem[] = db.tasks
    .filter((t) => t.startAt && overlaps(t.startAt, t.endAt) && t.status !== "cancelled" && t.status !== "merged")
    .map((task) => {
      const owner = userById.get(task.assigneeId);
      return {
        kind: "task" as const,
        id: task.id,
        title: task.title,
        startAt: task.startAt!,
        endAt: task.endAt ?? task.startAt!,
        ownerId: task.assigneeId,
        ownerName: owner?.name ?? task.assigneeId,
        ownerColor: owner?.avatarColor ?? "#666666",
        movable: true,
        taskStatus: task.status,
        projectName: task.projectId ? projectById.get(task.projectId)?.name : undefined,
      };
    });

  const eventItems: CalendarViewItem[] = db.calendarEvents
    .filter((e) => overlaps(e.startAt, e.endAt))
    .map((event) => {
      const owner = userById.get(event.ownerId);
      const isPrivate = event.visibility === "private";
      const hideTitle = isPrivate && event.ownerId !== viewer.id;
      return {
        kind: "event" as const,
        id: event.id,
        title: hideTitle ? "자리비움" : event.title,
        startAt: event.startAt,
        endAt: event.endAt,
        ownerId: event.ownerId,
        ownerName: owner?.name ?? event.ownerId,
        ownerColor: owner?.avatarColor ?? "#666666",
        movable: event.source === "que" && !isPrivate,
        isPrivate,
      };
    });

  const milestones = db.milestones
    .filter((m) => overlaps(m.dueAt, m.dueAt))
    .map((m) => ({
      ...m,
      projectName: projectById.get(m.projectId)?.name ?? m.projectId,
    }));

  return {
    items: [...taskItems, ...eventItems].sort((a, b) => a.startAt.localeCompare(b.startAt)),
    milestones,
    projects: db.projects,
    users: db.users,
  };
}

export interface ChangeLogEntry {
  id: string;
  actorName: string;
  text: string;
  createdAt: string;
}

/** 최근 변경 내역 (캘린더 변경 로그 패널용) */
export function getRecentChangeLogs(limit = 8): ChangeLogEntry[] {
  const db = getDb();
  const userById = new Map(db.users.map((u) => [u.id, u]));
  const titleOf = (entityType: string, entityId: string): string => {
    switch (entityType) {
      case "task":
        return db.tasks.find((t) => t.id === entityId)?.title ?? entityId;
      case "calendar_event":
        return db.calendarEvents.find((e) => e.id === entityId)?.title ?? entityId;
      case "milestone":
        return db.milestones.find((m) => m.id === entityId)?.title ?? entityId;
      case "action_item":
        return db.actionItems.find((a) => a.id === entityId)?.title ?? entityId;
      case "payment_request":
        return db.paymentRequests.find((p) => p.id === entityId)?.title ?? entityId;
      default:
        return entityId;
    }
  };
  const verbOf: Record<string, string> = {
    create: "생성",
    update: "변경",
    move: "이동",
    status_change: "상태 변경",
    delete: "삭제",
  };

  return [...db.changeLogs]
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, limit)
    .map((log) => ({
      id: log.id,
      actorName: userById.get(log.actorId)?.name ?? log.actorId,
      text: `${titleOf(log.entityType, log.entityId)} ${verbOf[log.changeType] ?? log.changeType}${
        log.changeType === "status_change" && log.afterValue ? ` → ${log.afterValue}` : ""
      }`,
      createdAt: log.createdAt,
    }));
}
