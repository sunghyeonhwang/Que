import { canViewPrivateEventDetail, type Milestone, type Project, type Task, type User } from "@que/core";
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
  /** 최근 24시간 내 변경됨 — 캘린더에 "수정됨" 배지 표시 (기획 변경 공유 정책) */
  recentlyChanged?: boolean;
}

export interface CalendarData {
  items: CalendarViewItem[];
  milestones: (Milestone & { projectName: string })[];
  projects: Project[];
  users: User[];
}

export async function getCalendarData(
  viewer: User,
  rangeStart: Date,
  rangeEnd: Date,
  clientId?: string,
): Promise<CalendarData> {
  const db = await getDb();
  const userById = new Map(db.users.map((u) => [u.id, u]));
  // projectById는 ID→프로젝트명/제목 조회용 맵이다. 클라이언트 필터를 적용하지 않는다(전체 유지).
  const projectById = new Map(db.projects.map((p) => [p.id, p]));
  // "수정됨" 배지는 일정 시간(24h) 동안만 표시한다
  const changedSince = Date.now() - 24 * 60 * 60 * 1000;
  const isRecent = (lastChangedAt?: string): boolean =>
    !!lastChangedAt && new Date(lastChangedAt).getTime() >= changedSince;

  const overlaps = (startAt?: string, endAt?: string): boolean => {
    if (!startAt) return false;
    const start = new Date(startAt);
    const end = endAt ? new Date(endAt) : start;
    return start <= rangeEnd && end >= rangeStart;
  };

  // 캘린더에 그려지는 작업 소스만 클라이언트로 필터한다(무소속 작업 제외).
  // clientId 미지정이면 tasksForClient가 전체 작업을 돌려준다.
  const taskItems: CalendarViewItem[] = db
    .tasksForClient(clientId)
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
        recentlyChanged: isRecent(task.lastChangedAt),
      };
    });

  const eventItems: CalendarViewItem[] = db.calendarEvents
    .filter((e) => overlaps(e.startAt, e.endAt))
    .map((event) => {
      const owner = userById.get(event.ownerId);
      const isPrivate = event.visibility === "private";
      const hideTitle = isPrivate && !canViewPrivateEventDetail(event, viewer);
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
        recentlyChanged: isRecent(event.lastChangedAt),
      };
    });

  // 마일스톤도 클라이언트 소속(milestone→projectId→project.clientId). 작업과 일관되게,
  // 필터 활성 시 그 클라이언트 프로젝트의 마일스톤만 표시한다(무소속/타 클라이언트 제외).
  const milestones = db.milestones
    .filter((m) => overlaps(m.dueAt, m.dueAt))
    .filter((m) => !clientId || projectById.get(m.projectId)?.clientId === clientId)
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
export async function getRecentChangeLogs(limit = 8): Promise<ChangeLogEntry[]> {
  const db = await getDb();
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
