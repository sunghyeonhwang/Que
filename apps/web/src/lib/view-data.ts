import { formatProjectLabel, type Project, type TaskStatus } from "@que/core";
import { loadReadOnlyDb } from "./db";

// 공개 읽기전용 현황판(view.griff.co.kr) 데이터 조합.
// - 인증 없는 익명 페이지가 소비한다 → loadReadOnlyDb()만 쓴다(스케줄러/persist 미실행).
// - 화이트리스트 필드만 뷰모델에 담는다: 제목·시간·상태·담당자 이름/색·클라이언트 라벨.
//   description·사유·금액·회의록·체크인·PII는 절대 포함하지 않는다.
// - 그날/그주 판정은 today-data / calendar-data 로직을 준거로 한다(assignee별, cancelled/merged 제외,
//   startAt/endAt 겹침). private 작업은 제외, private 이벤트는 "자리비움"으로만 노출한다.
// - 전원(db.users) 순회 — 8명 로스터 한 화면 전제.

const HIDDEN_TASK_STATUSES = new Set<TaskStatus>(["cancelled", "merged"]);

// ---------- Board (하루) ----------

export interface ViewCard {
  id: string;
  title: string;
  clientLabel?: string;
  status: TaskStatus;
  timeLabel?: string;
}

export interface ViewBoardColumn {
  user: { id: string; name: string; avatarColor: string };
  doneCount: number;
  totalCount: number;
  cards: ViewCard[];
}

export interface ViewBoard {
  dateISO: string;
  columns: ViewBoardColumn[];
}

// ---------- Week (월~금) ----------

export interface ViewWeekItem {
  id: string;
  kind: "task" | "event";
  title: string;
  startAt: string;
  endAt: string;
  ownerColor: string;
  ownerName: string;
  clientLabel?: string;
}

export interface ViewWeekDay {
  dateISO: string;
  weekdayLabel: string;
  dayNum: number;
  clientLabels: string[];
  items: ViewWeekItem[];
}

export interface ViewWeekMemberSummary {
  user: { id: string; name: string; avatarColor: string };
  doneCount: number;
  totalCount: number;
}

export type ViewScheduleRange = "week" | "3day";

export interface ViewWeek {
  /** 표시 범위의 시작일(week=해당 주 월요일, 3day=앵커일) ISO(yyyy-MM-dd). */
  weekStartISO: string;
  /** 표시 범위 종류. frontend가 이동 폭(week=7일 / 3day=3일)과 칸수 렌더에 사용. */
  range: ViewScheduleRange;
  /** days 칸수(week=5, 3day=3). days.length와 동일하되 렌더 편의용으로 명시. */
  dayCount: number;
  /** memberSummary는 항상 "표시 범위" 기준으로 done/total 집계. */
  memberSummary: ViewWeekMemberSummary[];
  days: ViewWeekDay[];
}

// ---------- Day (하루·사람 열) ----------

export interface ViewDayColumn {
  user: { id: string; name: string; avatarColor: string };
  /** 이 사람의 그날 timed items(task+event). startAt 오름차순. ViewWeekItem 재사용. */
  items: ViewWeekItem[];
}

export interface ViewDay {
  /** 표시 날짜 ISO(yyyy-MM-dd). */
  dateISO: string;
  /** 열 = 사람. db.users 순서(=로스터 순서) 전원. */
  columns: ViewDayColumn[];
}

const WEEKDAY_KR = ["일", "월", "화", "수", "목", "금", "토"] as const;

function timeLabel(startAt?: string, endAt?: string): string | undefined {
  if (!startAt) return undefined;
  const fmt = (iso: string) =>
    new Date(iso).toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit", hour12: false });
  return endAt ? `${fmt(startAt)}–${fmt(endAt)}` : fmt(startAt);
}

function localDateISO(d: Date): string {
  // KST(Asia/Seoul, instrumentation.ts에서 TZ 고정)의 로컬 날짜. UTC 변환 금지.
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** 하루(board) 현황: today-data 준거 — assignee별, cancelled/merged 제외, 그날 겹침, private 작업 제외. */
export async function getViewBoard(date: Date): Promise<ViewBoard> {
  const db = await loadReadOnlyDb();

  const dayStart = new Date(date);
  dayStart.setHours(0, 0, 0, 0);
  const dayEnd = new Date(date);
  dayEnd.setHours(23, 59, 59, 999);

  const overlapsDay = (startAt?: string, endAt?: string): boolean => {
    if (!startAt && !endAt) return false;
    const start = startAt ? new Date(startAt) : new Date(endAt!);
    const end = endAt ? new Date(endAt) : start;
    return start <= dayEnd && end >= dayStart;
  };

  const clientLabelFor = (projectId?: string): string | undefined => {
    if (!projectId) return undefined;
    const project = db.projects.find((p) => p.id === projectId);
    if (!project) return undefined;
    return formatProjectLabel(project, db.clientOf(project));
  };

  const columns: ViewBoardColumn[] = db.users.map((user) => {
    const dayTasks = db.tasks
      .filter(
        (t) =>
          t.assigneeId === user.id &&
          t.visibility !== "private" && // private 작업 제외
          !HIDDEN_TASK_STATUSES.has(t.status) &&
          overlapsDay(t.startAt, t.endAt),
      )
      .sort((a, b) => (a.startAt ?? a.endAt ?? "").localeCompare(b.startAt ?? b.endAt ?? ""));

    const cards: ViewCard[] = dayTasks.map((t) => ({
      id: t.id,
      title: t.title,
      clientLabel: clientLabelFor(t.projectId),
      status: t.status,
      timeLabel: timeLabel(t.startAt, t.endAt),
    }));

    return {
      user: { id: user.id, name: user.name, avatarColor: user.avatarColor },
      doneCount: dayTasks.filter((t) => t.status === "done").length,
      totalCount: dayTasks.length,
      cards,
    };
  });

  return { dateISO: localDateISO(date), columns };
}

/**
 * 1Day 현황: 하루를 팀원(전원)을 열로 놓고 각 사람의 그날 timed items(task+event)를 반환한다.
 * - getViewSchedule/getViewBoard와 동일 규칙: cancelled/merged 제외, private 작업 제외,
 *   private 이벤트는 "자리비움"으로만 노출, 화이트리스트 필드만.
 * - 그날 겹침 판정은 getViewSchedule의 날짜별 배분 로직과 동일(startAt<=de && endAt>=ds).
 * - task는 assigneeId, event는 ownerId로 사람 열에 배정한다.
 * - 시간 필터(10~19시 클리핑)는 하지 않는다 — frontend가 클리핑한다.
 */
export async function getViewDay(date: Date): Promise<ViewDay> {
  const db = await loadReadOnlyDb();

  const dayStart = new Date(date);
  dayStart.setHours(0, 0, 0, 0);
  const dayEnd = new Date(date);
  dayEnd.setHours(23, 59, 59, 999);

  const projectById = new Map(db.projects.map((p) => [p.id, p]));
  const clientLabelOf = (project?: Project): string | undefined =>
    project ? formatProjectLabel(project, db.clientOf(project)) : undefined;

  const overlapsDay = (startAt?: string, endAt?: string): boolean => {
    if (!startAt) return false;
    const start = new Date(startAt);
    const end = endAt ? new Date(endAt) : start;
    return start <= dayEnd && end >= dayStart;
  };

  const columns: ViewDayColumn[] = db.users.map((user) => {
    const taskItems: ViewWeekItem[] = db.tasks
      .filter(
        (t) =>
          t.assigneeId === user.id &&
          t.visibility !== "private" && // private 작업 제외
          !HIDDEN_TASK_STATUSES.has(t.status) &&
          t.startAt &&
          overlapsDay(t.startAt, t.endAt),
      )
      .map((t) => {
        const project = t.projectId ? projectById.get(t.projectId) : undefined;
        return {
          id: t.id,
          kind: "task" as const,
          title: t.title,
          startAt: t.startAt!,
          endAt: t.endAt ?? t.startAt!,
          ownerColor: user.avatarColor,
          ownerName: user.name,
          clientLabel: clientLabelOf(project),
        };
      });

    const eventItems: ViewWeekItem[] = db.calendarEvents
      .filter((e) => e.ownerId === user.id && overlapsDay(e.startAt, e.endAt))
      .map((e) => {
        // 익명 뷰어 — private 이벤트는 항상 "자리비움"으로만 노출.
        const isPrivate = e.visibility === "private";
        return {
          id: e.id,
          kind: "event" as const,
          title: isPrivate ? "자리비움" : e.title,
          startAt: e.startAt,
          endAt: e.endAt,
          ownerColor: user.avatarColor,
          ownerName: user.name,
        };
      });

    const items = [...taskItems, ...eventItems].sort((a, b) =>
      a.startAt.localeCompare(b.startAt),
    );

    return {
      user: { id: user.id, name: user.name, avatarColor: user.avatarColor },
      items,
    };
  });

  return { dateISO: localDateISO(date), columns };
}

/**
 * 스케줄(week/3day) 현황: calendar-data 준거 — 범위 겹침, private 작업 제외, private 이벤트는 "자리비움".
 * - range="week": 앵커일이 속한 주의 월~금 5칸(앵커 요일 무관, 월요일로 정규화).
 * - range="3day": 앵커일 포함 연속 3칸(anchor, anchor+1, anchor+2). 정규화 없음.
 * 시간 필터(10~19시 클리핑)는 하지 않는다 — 모든 이벤트를 반환하고 frontend가 클리핑한다.
 */
export async function getViewSchedule(
  anchor: Date,
  range: ViewScheduleRange,
): Promise<ViewWeek> {
  const db = await loadReadOnlyDb();

  // 표시할 날짜(자정 기준)들을 만든다. week는 월요일로 정규화, 3day는 앵커일부터.
  const rangeStart = new Date(anchor);
  rangeStart.setHours(0, 0, 0, 0);
  if (range === "week") {
    const dow = rangeStart.getDay(); // 0=일
    const diffToMonday = dow === 0 ? -6 : 1 - dow;
    rangeStart.setDate(rangeStart.getDate() + diffToMonday);
  }

  const dayCount = range === "week" ? 5 : 3;

  const rangeEnd = new Date(rangeStart);
  rangeEnd.setDate(rangeEnd.getDate() + (dayCount - 1));
  rangeEnd.setHours(23, 59, 59, 999);

  const userById = new Map(db.users.map((u) => [u.id, u]));
  const projectById = new Map(db.projects.map((p) => [p.id, p]));

  const clientLabelOf = (project?: Project): string | undefined =>
    project ? formatProjectLabel(project, db.clientOf(project)) : undefined;

  const overlaps = (startAt?: string, endAt?: string, from?: Date, to?: Date): boolean => {
    if (!startAt) return false;
    const start = new Date(startAt);
    const end = endAt ? new Date(endAt) : start;
    return start <= (to ?? rangeEnd) && end >= (from ?? rangeStart);
  };

  // 범위 전체에 걸치는 작업/이벤트 뷰아이템을 만든 뒤 날짜별로 배분한다.
  const weekTaskItems: ViewWeekItem[] = db.tasks
    .filter(
      (t) =>
        t.visibility !== "private" && // private 작업 제외
        !HIDDEN_TASK_STATUSES.has(t.status) &&
        t.startAt &&
        overlaps(t.startAt, t.endAt),
    )
    .map((t) => {
      const owner = userById.get(t.assigneeId);
      const project = t.projectId ? projectById.get(t.projectId) : undefined;
      return {
        id: t.id,
        kind: "task" as const,
        title: t.title,
        startAt: t.startAt!,
        endAt: t.endAt ?? t.startAt!,
        ownerColor: owner?.avatarColor ?? "#666666",
        ownerName: owner?.name ?? t.assigneeId,
        clientLabel: clientLabelOf(project),
      };
    });

  const weekEventItems: ViewWeekItem[] = db.calendarEvents
    .filter((e) => overlaps(e.startAt, e.endAt))
    .map((e) => {
      const owner = userById.get(e.ownerId);
      // 익명 뷰어 — private 이벤트는 항상 "자리비움"으로만 노출(canViewPrivateEventDetail 불가).
      const isPrivate = e.visibility === "private";
      return {
        id: e.id,
        kind: "event" as const,
        title: isPrivate ? "자리비움" : e.title,
        startAt: e.startAt,
        endAt: e.endAt,
        ownerColor: owner?.avatarColor ?? "#666666",
        ownerName: owner?.name ?? e.ownerId,
      };
    });

  const allItems = [...weekTaskItems, ...weekEventItems];

  const days: ViewWeekDay[] = [];
  for (let i = 0; i < dayCount; i += 1) {
    const dayDate = new Date(rangeStart);
    dayDate.setDate(rangeStart.getDate() + i);
    const ds = new Date(dayDate);
    ds.setHours(0, 0, 0, 0);
    const de = new Date(dayDate);
    de.setHours(23, 59, 59, 999);

    const items = allItems
      .filter((it) => {
        const start = new Date(it.startAt);
        const end = new Date(it.endAt);
        return start <= de && end >= ds;
      })
      .sort((a, b) => a.startAt.localeCompare(b.startAt));

    const clientLabels = [
      ...new Set(items.map((it) => it.clientLabel).filter((l): l is string => !!l)),
    ];

    days.push({
      dateISO: localDateISO(dayDate),
      weekdayLabel: WEEKDAY_KR[dayDate.getDay()],
      dayNum: dayDate.getDate(),
      clientLabels,
      items,
    });
  }

  // 멤버별 표시범위 완료/총 작업 수(전원). private 제외·cancelled/merged 제외한 범위 겹침 작업 기준.
  const memberSummary: ViewWeekMemberSummary[] = db.users.map((user) => {
    const mine = db.tasks.filter(
      (t) =>
        t.assigneeId === user.id &&
        t.visibility !== "private" &&
        !HIDDEN_TASK_STATUSES.has(t.status) &&
        t.startAt &&
        overlaps(t.startAt, t.endAt),
    );
    return {
      user: { id: user.id, name: user.name, avatarColor: user.avatarColor },
      doneCount: mine.filter((t) => t.status === "done").length,
      totalCount: mine.length,
    };
  });

  return {
    weekStartISO: localDateISO(rangeStart),
    range,
    dayCount,
    memberSummary,
    days,
  };
}
