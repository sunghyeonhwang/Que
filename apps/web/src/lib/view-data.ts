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

export interface ViewWeek {
  weekStartISO: string;
  memberSummary: ViewWeekMemberSummary[];
  days: ViewWeekDay[];
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

/** 주간(week) 현황: calendar-data 준거 — 주 겹침, private 작업 제외, private 이벤트는 "자리비움". 월~금 5칸. */
export async function getViewWeek(weekStart: Date): Promise<ViewWeek> {
  const db = await loadReadOnlyDb();

  // weekStart를 월요일 자정으로 정규화한 뒤 월~금 5일을 만든다.
  const monday = new Date(weekStart);
  monday.setHours(0, 0, 0, 0);
  const dow = monday.getDay(); // 0=일
  const diffToMonday = dow === 0 ? -6 : 1 - dow;
  monday.setDate(monday.getDate() + diffToMonday);

  const friday = new Date(monday);
  friday.setDate(friday.getDate() + 4);
  friday.setHours(23, 59, 59, 999);

  const userById = new Map(db.users.map((u) => [u.id, u]));
  const projectById = new Map(db.projects.map((p) => [p.id, p]));

  const clientLabelOf = (project?: Project): string | undefined =>
    project ? formatProjectLabel(project, db.clientOf(project)) : undefined;

  const overlaps = (startAt?: string, endAt?: string, from?: Date, to?: Date): boolean => {
    if (!startAt) return false;
    const start = new Date(startAt);
    const end = endAt ? new Date(endAt) : start;
    return start <= (to ?? friday) && end >= (from ?? monday);
  };

  // 주 전체(월~금)에 걸치는 작업/이벤트 뷰아이템을 만든 뒤 날짜별로 배분한다.
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
  for (let i = 0; i < 5; i += 1) {
    const dayDate = new Date(monday);
    dayDate.setDate(monday.getDate() + i);
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

  // 멤버별 주간 완료/총 작업 수(전원). private 제외·cancelled/merged 제외한 주 겹침 작업 기준.
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

  return { weekStartISO: localDateISO(monday), memberSummary, days };
}
