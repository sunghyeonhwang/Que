import { type TaskStatus, type User } from "@que/core";
import { getDb } from "./db";
import type { ListViewMember } from "./pm-data";

// "내 작업" 플랫 목록 데이터. 신규 PM 모델이 아니라 **기존 Task 모델**(내게 배정된 작업)을 쓴다.
// 디자인의 태스크 표(이름·설명·마감일·배정·우선순위·진행률)에 맞춰 조합한다.
// - 기존 Task엔 우선순위 필드가 없다 → 우선순위는 화면에서 "—"로 표시한다(범위 밖).
// - 진행률 컬럼은 기존 status 뱃지로 채운다.

export type MyTaskTab = "all" | "today" | "upcoming" | "done";

export interface MyTaskItem {
  id: string;
  title: string;
  description?: string;
  status: TaskStatus;
  startAt?: string;
  endAt?: string;
  /** 정렬/표시용: 마감(endAt) 우선, 없으면 시작(startAt) */
  dueAt?: string;
  /** 담당자(+소유자) 아바타 스택용. 기존 모델은 단일 담당자라 대부분 1~2명. */
  assignees: ListViewMember[];
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
  // 목록/카운트 소스만 클라이언트 필터. userById는 이름 조회라 전체 유지.
  const clientTasks = db.tasksForClient(clientId);
  const userById = new Map(db.users.map((u) => [u.id, u]));

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
        startAt: t.startAt,
        endAt: t.endAt,
        dueAt: t.endAt ?? t.startAt,
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
