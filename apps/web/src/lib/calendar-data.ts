import {
  canEditTask,
  canViewPrivateEventDetail,
  type Milestone,
  type Project,
  type Task,
  type User,
} from "@que/core";
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
  // ---- 경량 상세 팝오버용(additive, optional) ----
  // 작업(task)에만 있는 필드. 비공개 마스킹된 이벤트에는 절대 채우지 않는다(마스킹 우회 금지).
  /** 작업 우선순위. 우선순위 서버 필터의 기준값이기도 하다. */
  priority?: Task["priority"];
  /** 작업 설명(이벤트에는 없음). 비공개 마스킹 시 미포함. */
  description?: string;
  /** 이벤트 참석자(이름·색). 비공개 마스킹 시 미포함(참석자 노출로 우회 금지). */
  attendees?: { name: string; color: string }[];
  /** 뷰어가 이 항목을 실제로 수정/이동할 수 있는지(서버 규칙 기준). UI 편집 진입점 판단용. */
  canEdit?: boolean;
}

/** 일정 화면 서버 필터 파라미터. 날짜 From/To는 없다(뷰 기간이 이미 범위를 정함). */
export interface ScheduleFilters {
  /** 작업 우선순위. 지정 시 해당 우선순위 작업만 남고, 우선순위 개념이 없는 이벤트는 제외된다. */
  priority?: Task["priority"];
  /** 제목 부분 일치(대소문자 무시). 마스킹 후 기준이라 비공개 일정은 "자리비움"으로만 검색된다. */
  keyword?: string;
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
        priority: task.priority,
        description: task.description,
        // 편집 권한은 서버 규칙(본인·소유자·프로젝트 담당·관리자)으로 판정한다.
        canEdit: canEditTask(viewer, task, projectById.get(task.projectId ?? "")),
      };
    });

  const eventItems: CalendarViewItem[] = db.calendarEvents
    .filter((e) => overlaps(e.startAt, e.endAt))
    .map((event) => {
      const owner = userById.get(event.ownerId);
      const isPrivate = event.visibility === "private";
      const hideTitle = isPrivate && !canViewPrivateEventDetail(event, viewer);
      // 편집/이동 권한 = 이동 규칙(que·비공개 아님)과 소유권(본인 또는 관리자)의 교집합.
      // 비공개 일정은 소유자·관리자여도 이동 불가(canMoveCalendarEvent와 동일)이므로 항상 false.
      const canEdit =
        event.source === "que" && !isPrivate && (viewer.role === "admin" || event.ownerId === viewer.id);
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
        // 마스킹된 비공개 일정은 참석자를 노출하지 않는다(제목 마스킹 우회 금지 — "자리비움"은 상세도 비어야).
        attendees: hideTitle
          ? undefined
          : event.attendeeIds.map((id) => {
              const u = userById.get(id);
              return { name: u?.name ?? id, color: u?.avatarColor ?? "#666666" };
            }),
        canEdit,
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

/**
 * 일정 화면 서버 필터 — 이미 마스킹까지 끝난 CalendarViewItem 배열에 우선순위·키워드를 적용한다.
 * 반드시 마스킹 이후에 돌린다: 키워드는 화면에 보이는 제목(비공개는 "자리비움") 기준이라
 * 필터로 비공개 일정의 실제 제목을 역추적할 수 없다.
 *
 * 계약(프론트/MCP/CLI 공유):
 * - keyword: 제목 부분 일치(대소문자 무시, trim). 모든 종류(task·event)에 적용.
 * - priority: 작업 우선순위 일치. 우선순위 개념이 없는 이벤트는 필터가 켜지면 제외된다.
 * - 마일스톤은 이 함수의 대상이 아니다(items에 포함되지 않음 — 별도 필드로 전달).
 * - 부제 카운트(마감/미팅)는 필터 전 items 기준으로 계산해야 한다(이 함수 호출 전에 세어둘 것).
 */
export function filterScheduleItems(
  items: CalendarViewItem[],
  filters: ScheduleFilters,
): CalendarViewItem[] {
  const keyword = filters.keyword?.trim().toLowerCase();
  const { priority } = filters;
  if (!keyword && !priority) return items;
  return items.filter((it) => {
    if (keyword && !it.title.toLowerCase().includes(keyword)) return false;
    if (priority && (it.kind !== "task" || it.priority !== priority)) return false;
    return true;
  });
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
