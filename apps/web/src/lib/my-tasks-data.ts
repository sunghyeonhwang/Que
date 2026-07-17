import { type TaskStatus, type User } from "@que/core";
import { getDb } from "./db";
import type { ListViewMember } from "./pm-types";

// "내 작업" 플랫 목록 데이터. 신규 PM 모델이 아니라 **기존 Task 모델**(내게 배정된 작업)을 쓴다.
// 디자인의 태스크 표(이름·설명·마감일·배정·우선순위·진행률)에 맞춰 조합한다.
// - 기존 Task엔 우선순위 필드가 없다 → 우선순위는 화면에서 "—"로 표시한다(범위 밖).
// - 진행률 컬럼은 기존 status 뱃지로 채운다.

export type MyTaskTab = "all" | "today" | "upcoming" | "done";

/** 표시용 정렬 기준. due=마감순(기본·기존), priority=우선순위순(high→normal→low, 동순위는 마감순). */
export type TaskSortKey = "due" | "priority";
/** 표시용 그룹 기준. none=그룹 없음(기본), project=프로젝트별 소제목. */
export type TaskGroupKey = "none" | "project";

export interface MyTaskItem {
  id: string;
  title: string;
  description?: string;
  status: TaskStatus;
  /** 작업 우선순위(core Task.priority). 정렬·표시에 쓴다. */
  priority: "low" | "normal" | "high";
  startAt?: string;
  endAt?: string;
  /** 정렬/표시용: 마감(endAt) 우선, 없으면 시작(startAt) */
  dueAt?: string;
  /** 소속 프로젝트 — 상세 시트 프로젝트 Select 초기값에 필요(TimelineRow와 동일). */
  projectId?: string;
  /** 소속 프로젝트 이름 — 프로젝트별 그룹 소제목에 쓴다. 미지정이면 undefined. */
  projectName?: string;
  /** 담당자(+소유자) 아바타 스택용. 기존 모델은 단일 담당자라 대부분 1~2명. */
  assignees: ListViewMember[];
}

/** 프로젝트 그룹 섹션(그룹 없음이면 label=null인 단일 섹션). */
export interface TaskSection {
  key: string;
  label: string | null;
  items: MyTaskItem[];
}

const PRIORITY_RANK: Record<MyTaskItem["priority"], number> = { high: 0, normal: 1, low: 2 };

function byDue(a: MyTaskItem, b: MyTaskItem): number {
  return (a.dueAt ?? "9999").localeCompare(b.dueAt ?? "9999");
}

/** 표시용 정렬. 데이터는 이미 전부 내려왔으므로 서버 재조회 없이 배열만 재정렬한다. */
export function sortMyTasksForView(items: MyTaskItem[], sort: TaskSortKey): MyTaskItem[] {
  if (sort === "priority") {
    // 우선순위(high→normal→low) 우선, 동순위는 마감순으로.
    return [...items].sort((a, b) => PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority] || byDue(a, b));
  }
  return [...items].sort(byDue);
}

/** 표시용 그룹. none=헤더 없는 단일 섹션. project=프로젝트별(첫 등장 순 유지, "프로젝트 미지정"은 맨 뒤). */
export function groupMyTasksForView(items: MyTaskItem[], group: TaskGroupKey): TaskSection[] {
  if (group !== "project") return [{ key: "all", label: null, items }];
  const NO_PROJECT = "__none__";
  const sections = new Map<string, TaskSection>();
  for (const item of items) {
    const key = item.projectId ?? NO_PROJECT;
    if (!sections.has(key)) {
      sections.set(key, { key, label: item.projectName ?? "프로젝트 미지정", items: [] });
    }
    sections.get(key)!.items.push(item);
  }
  // 첫 등장 순(정렬 결과 반영)을 유지하되 "프로젝트 미지정"만 맨 뒤로 민다(안정 정렬).
  return [...sections.values()].sort(
    (a, b) => (a.key === NO_PROJECT ? 1 : 0) - (b.key === NO_PROJECT ? 1 : 0),
  );
}

export interface MyTaskListData {
  /** 필터 전 전체 — 내게 배정된 작업(병합 제외) */
  items: MyTaskItem[];
  counts: Record<MyTaskTab, number>;
}

// 병합된 작업은 다른 작업으로 흡수됐으므로 개인 목록에서 숨긴다.
const HIDDEN = new Set<TaskStatus>(["merged"]);
const UNFINISHED = new Set<TaskStatus>([
  "scheduled",
  "in_progress",
  "needs_reschedule",
  "on_hold",
  "issue",
]);

function dayBounds(now: Date): { start: Date; end: Date } {
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  const end = new Date(now);
  end.setHours(23, 59, 59, 999);
  return { start, end };
}

function overlapsToday(item: MyTaskItem, now: Date): boolean {
  if (!item.startAt && !item.endAt) return false;
  const { start: dayStart, end: dayEnd } = dayBounds(now);
  const start = item.startAt ? new Date(item.startAt) : new Date(item.endAt!);
  const end = item.endAt ? new Date(item.endAt) : start;
  return start <= dayEnd && end >= dayStart;
}

function isUpcoming(item: MyTaskItem, now: Date): boolean {
  if (!UNFINISHED.has(item.status)) return false;
  const { end: dayEnd } = dayBounds(now);
  const ref = item.startAt ?? item.endAt;
  return !!ref && new Date(ref) > dayEnd;
}

/** 탭별 필터. 서버에서 적용하고, 카운트도 같은 규칙으로 계산한다. */
export function filterMyTasks(
  items: MyTaskItem[],
  tab: MyTaskTab,
  now: Date = new Date(),
): MyTaskItem[] {
  switch (tab) {
    case "today":
      return items.filter((it) => overlapsToday(it, now));
    case "upcoming":
      return items.filter((it) => isUpcoming(it, now));
    case "done":
      return items.filter((it) => it.status === "done");
    case "all":
    default:
      return items;
  }
}

export async function getMyTaskList(
  user: User,
  now: Date = new Date(),
  clientId?: string,
): Promise<MyTaskListData> {
  const db = await getDb();
  // 목록/카운트 소스만 클라이언트 필터. userById·projectById는 이름 조회라 전체 유지.
  const clientTasks = db.tasksForClient(clientId);
  const userById = new Map(db.users.map((u) => [u.id, u]));
  const projectById = new Map(db.projects.map((p) => [p.id, p]));

  const toMember = (id: string): ListViewMember | null => {
    const u = userById.get(id);
    return u ? { id: u.id, name: u.name, avatarColor: u.avatarColor } : null;
  };

  const items: MyTaskItem[] = clientTasks
    .filter((t) => t.assigneeId === user.id && !HIDDEN.has(t.status))
    .map((t) => {
      const ids = t.ownerId !== t.assigneeId ? [t.assigneeId, t.ownerId] : [t.assigneeId];
      const assignees = ids
        .map(toMember)
        .filter((m): m is ListViewMember => m !== null);
      return {
        id: t.id,
        title: t.title,
        description: t.description,
        status: t.status,
        priority: t.priority,
        startAt: t.startAt,
        endAt: t.endAt,
        dueAt: t.endAt ?? t.startAt,
        projectId: t.projectId,
        projectName: t.projectId ? projectById.get(t.projectId)?.name : undefined,
        assignees,
      };
    })
    .sort((a, b) => (a.dueAt ?? "9999").localeCompare(b.dueAt ?? "9999"));

  const counts: Record<MyTaskTab, number> = {
    all: items.length,
    today: filterMyTasks(items, "today", now).length,
    upcoming: filterMyTasks(items, "upcoming", now).length,
    done: filterMyTasks(items, "done", now).length,
  };

  return { items, counts };
}
