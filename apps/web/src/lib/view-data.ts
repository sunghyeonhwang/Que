import {
  formatProjectLabel,
  type Project,
  type TaskStatus,
  type Milestone,
} from "@que/core";
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
  /** 표시 범위 시작일(3day=앵커일) ISO(yyyy-MM-dd). */
  weekStartISO: string;
  /** days 칸수(3day=3). days.length와 동일하되 렌더 편의용으로 명시. */
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
 * 스케줄(3day) 현황: calendar-data 준거 — 범위 겹침, private 작업 제외, private 이벤트는 "자리비움".
 * - 앵커일 포함 연속 3칸(anchor, anchor+1, anchor+2). 정규화 없음.
 * 시간 필터(10~19시 클리핑)는 하지 않는다 — 모든 이벤트를 반환하고 frontend가 클리핑한다.
 */
export async function getViewSchedule(anchor: Date): Promise<ViewWeek> {
  const db = await loadReadOnlyDb();

  // 표시할 날짜(자정 기준)들을 만든다. 앵커일부터 3칸.
  const rangeStart = new Date(anchor);
  rangeStart.setHours(0, 0, 0, 0);

  const dayCount = 3;

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
    dayCount,
    memberSummary,
    days,
  };
}

// ---------- 공용 시간/집계 헬퍼 (KST — 서버 TZ가 Asia/Seoul로 고정) ----------

/** 주말(토/일) 여부. 서버 TZ가 KST라 getDay()가 KST 요일이다. */
function isWeekendKST(d: Date): boolean {
  const day = d.getDay();
  return day === 0 || day === 6;
}

/** d 다음 영업일(월~금) 자정. 토→월, 금→월, 그 외 +1일. */
function nextBusinessDay(d: Date): Date {
  const next = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  do {
    next.setDate(next.getDate() + 1);
  } while (isWeekendKST(next));
  return next;
}

/** 오늘(자정) 기준 due 날짜까지 남은 달력 일수. 음수면 지남. */
function ddayFrom(now: Date, dueISO: string): number {
  const due = new Date(dueISO);
  const dueMid = new Date(due.getFullYear(), due.getMonth(), due.getDate()).getTime();
  const nowMid = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  return Math.round((dueMid - nowMid) / 86_400_000);
}

/** 특정 날짜(자정~자정)와 겹치는지. startAt 없으면 endAt만으로도 판정. */
function onDate(dayStart: Date, dayEnd: Date, startAt?: string, endAt?: string): boolean {
  if (!startAt && !endAt) return false;
  const start = startAt ? new Date(startAt) : new Date(endAt!);
  const end = endAt ? new Date(endAt) : start;
  return start <= dayEnd && end >= dayStart;
}

/** endAt이 특정 날짜(로컬)에 속하는지 — "그날 마감" 판정. */
function dueOnDate(dateISO: string, endAt?: string): boolean {
  if (!endAt) return false;
  return localDateISO(new Date(endAt)) === dateISO;
}

// ---------- 1. 헤더 신호 티커 ----------
// 전부 집계 숫자 + 마일스톤 제목 1개(프로젝트 공개 정보). 취소·병합·private 제외.

export interface ViewSignalMilestone {
  title: string;
  dday: number;
  riskStatus: Milestone["riskStatus"];
}

export interface ViewSignals {
  /** 현재 문제(issue) 상태 작업 수. */
  issues: number;
  /** 현재 홀드(on_hold) 상태 작업 수. */
  holds: number;
  /** 오늘 마감(endAt=오늘)인데 아직 미완료인 작업 수. */
  dueToday: number;
  /** 다가오는 가장 가까운 마일스톤(D-7 이내만). 없으면 undefined. */
  nextMilestone?: ViewSignalMilestone;
}

/** 헤더 티커용 집계 신호. 숫자만(+마일스톤 제목 1개). */
export async function getViewSignals(now: Date): Promise<ViewSignals> {
  const db = await loadReadOnlyDb();
  const todayISO = localDateISO(now);

  const visible = db.tasks.filter(
    (t) => t.visibility !== "private" && !HIDDEN_TASK_STATUSES.has(t.status),
  );

  const issues = visible.filter((t) => t.status === "issue").length;
  const holds = visible.filter((t) => t.status === "on_hold").length;
  const dueToday = visible.filter(
    (t) => t.status !== "done" && dueOnDate(todayISO, t.endAt),
  ).length;

  // 다가오는(오늘 포함) 가장 가까운 마일스톤. D-7 이내만 노출.
  const upcoming = db.milestones
    .map((m) => ({ m, dday: ddayFrom(now, m.dueAt) }))
    .filter(({ dday }) => dday >= 0)
    .sort((a, b) => a.dday - b.dday);

  const nearest = upcoming[0];
  const nextMilestone =
    nearest && nearest.dday <= 7
      ? {
          title: nearest.m.title,
          dday: nearest.dday,
          riskStatus: nearest.m.riskStatus,
        }
      : undefined;

  return { issues, holds, dueToday, nextMilestone };
}

// ---------- 2a. 스탠드업 스트립(오전 시간대) ----------
// 공개 화면 요약 수준 — 제출 여부·인원수·제출자 아바타 + (11시 이후) AI 팀 요약 첫 문장 1줄.
// focus 개인별 나열은 하지 않는다.

export interface ViewStandupStrip {
  submittedCount: number;
  totalCount: number;
  submitters: { id: string; name: string; avatarColor: string }[];
  /** AI 팀 요약 첫 문장 1줄(11시 이후·요약 존재 시만). 개행 제거·절단. */
  summaryLine?: string;
}

/** 오전 09:30~11:30(영업일)만 스트립을 반환. 그 외엔 null. */
export async function getViewStandupStrip(now: Date): Promise<ViewStandupStrip | null> {
  if (isWeekendKST(now)) return null;
  const minutes = now.getHours() * 60 + now.getMinutes();
  if (minutes < 9 * 60 + 30 || minutes > 11 * 60 + 30) return null;

  const db = await loadReadOnlyDb();
  const todayISO = localDateISO(now);
  const userById = new Map(db.users.map((u) => [u.id, u]));

  const entries = db.standupEntriesByDate(todayISO);
  const submitters = entries
    .map((e) => userById.get(e.userId))
    .filter((u): u is (typeof db.users)[number] => !!u)
    .map((u) => ({ id: u.id, name: u.name, avatarColor: u.avatarColor }));

  // AI 팀 요약: 11시 이후에만, 존재하면 1줄. ⚠️ 공개 무인증 화면 — 요약의 첫 섹션은
  // [막힘 클러스터](개인 이름+막힘 사유 서술)라 절대 노출 금지(글래도스 게이트 조건).
  // 대신 [어제→오늘 흐름] 섹션(팀 단위 모멘텀 서술)의 첫 문장만 추출한다.
  // 섹션 머리글은 standup-summary 프롬프트가 대괄호 형식으로 고정해 파싱이 결정적이며,
  // 해당 섹션이 없으면(형식 변주) 노출하지 않는 것이 안전 기본값이다.
  let summaryLine: string | undefined;
  if (now.getHours() >= 11) {
    const summary = db.standupTeamSummaryByDate(todayISO);
    if (summary?.content) {
      const flowMatch = summary.content.match(/\[어제→오늘 흐름\]\s*([\s\S]*?)(?=\n\s*\[|$)/);
      const flowBody = flowMatch?.[1]?.replace(/\s+/g, " ").trim();
      if (flowBody) {
        const firstSentence = flowBody.split(/(?<=[.。!?])\s/)[0] ?? flowBody;
        summaryLine =
          firstSentence.length > 90 ? `${firstSentence.slice(0, 90)}…` : firstSentence;
      }
    }
  }

  return {
    submittedCount: submitters.length,
    totalCount: db.users.length,
    submitters,
    summaryLine,
  };
}

// ---------- 2b. 다음 영업일 미리보기 ----------
// 주말/야간/빈 보드일 때 중앙 패널. 마감 건수·첫 회의(private→"일정")·다가오는 마일스톤 3.

export interface ViewPreviewMilestone {
  title: string;
  dday: number;
  riskStatus: Milestone["riskStatus"];
}

export interface ViewNextDayPreview {
  dateISO: string;
  /** "7/21(화)" 형태 라벨. */
  dateLabel: string;
  /** 다음 영업일 마감 예정(미완료) 작업 수. */
  dueCount: number;
  /** 첫 회의 — 시각·제목(private면 "일정"). 없으면 undefined. */
  firstMeeting?: { timeLabel: string; title: string };
  /** 다가오는 마일스톤 최대 3(오늘 이후·가까운 순). */
  milestones: ViewPreviewMilestone[];
}

/** 다음 영업일 미리보기 데이터. 표시 조건 판정은 호출부(page.tsx)가 한다. */
export async function getViewNextDayPreview(now: Date): Promise<ViewNextDayPreview> {
  const db = await loadReadOnlyDb();

  const target = nextBusinessDay(now);
  const targetISO = localDateISO(target);
  const dayStart = new Date(target);
  dayStart.setHours(0, 0, 0, 0);
  const dayEnd = new Date(target);
  dayEnd.setHours(23, 59, 59, 999);

  const dueCount = db.tasks.filter(
    (t) =>
      t.visibility !== "private" &&
      !HIDDEN_TASK_STATUSES.has(t.status) &&
      t.status !== "done" &&
      dueOnDate(targetISO, t.endAt),
  ).length;

  // 첫 회의: 다음 영업일에 겹치는 이벤트 중 가장 이른 것. private면 제목 마스킹.
  const meetings = db.calendarEvents
    .filter((e) => onDate(dayStart, dayEnd, e.startAt, e.endAt))
    .sort((a, b) => a.startAt.localeCompare(b.startAt));
  const first = meetings[0];
  const firstMeeting = first
    ? {
        timeLabel: timeLabel(first.startAt, first.endAt) ?? "",
        title: first.visibility === "private" ? "일정" : first.title,
      }
    : undefined;

  const milestones = db.milestones
    .map((m) => ({ m, dday: ddayFrom(now, m.dueAt) }))
    .filter(({ dday }) => dday >= 0)
    .sort((a, b) => a.dday - b.dday)
    .slice(0, 3)
    .map(({ m, dday }) => ({ title: m.title, dday, riskStatus: m.riskStatus }));

  const weekday = WEEKDAY_KR[target.getDay()];
  const dateLabel = `${target.getMonth() + 1}/${target.getDate()}(${weekday})`;

  return { dateISO: targetISO, dateLabel, dueCount, firstMeeting, milestones };
}

/** page.tsx 시간대 판정 헬퍼(서버 KST). */
export function shouldShowNextDayPreview(now: Date, totalBoardCards: number): boolean {
  return isWeekendKST(now) || now.getHours() >= 18 || totalBoardCards === 0;
}

// ---------- 3a. 슬라이드쇼: 마일스톤 스트립 페이지 ----------

export interface ViewMilestoneStripItem {
  id: string;
  title: string;
  projectLabel?: string;
  dday: number;
  riskStatus: Milestone["riskStatus"];
  critical: boolean;
}

/** 다가오는 마일스톤(오늘 이후·가까운 순) 최대 8. */
export async function getViewMilestoneStrip(now: Date): Promise<ViewMilestoneStripItem[]> {
  const db = await loadReadOnlyDb();
  const projectById = new Map(db.projects.map((p) => [p.id, p]));

  return db.milestones
    .map((m) => ({ m, dday: ddayFrom(now, m.dueAt) }))
    .filter(({ dday }) => dday >= 0)
    .sort((a, b) => a.dday - b.dday)
    .slice(0, 8)
    .map(({ m, dday }) => {
      const project = projectById.get(m.projectId);
      return {
        id: m.id,
        title: m.title,
        projectLabel: project
          ? formatProjectLabel(project, db.clientOf(project))
          : undefined,
        dday,
        riskStatus: m.riskStatus,
        critical: m.critical === true,
      };
    });
}

// ---------- 3b. 슬라이드쇼: 위험 보드 페이지 ----------
// 문제/홀드 작업 — 제목·담당자 이름·상태(기존 보드가 이미 노출하는 동급). 사유·상세는 제외.

export interface ViewRiskItem {
  id: string;
  title: string;
  status: Extract<TaskStatus, "issue" | "on_hold">;
  ownerName: string;
  ownerColor: string;
  clientLabel?: string;
}

/** 현재 문제(issue)/홀드(on_hold) 작업 목록. issue 먼저. */
export async function getViewRiskBoard(): Promise<ViewRiskItem[]> {
  const db = await loadReadOnlyDb();
  const userById = new Map(db.users.map((u) => [u.id, u]));
  const projectById = new Map(db.projects.map((p) => [p.id, p]));

  const rank: Record<string, number> = { issue: 0, on_hold: 1 };

  return db.tasks
    .filter(
      (t) =>
        t.visibility !== "private" &&
        (t.status === "issue" || t.status === "on_hold"),
    )
    .sort(
      (a, b) =>
        (rank[a.status] ?? 9) - (rank[b.status] ?? 9) ||
        a.title.localeCompare(b.title),
    )
    .map((t) => {
      const owner = userById.get(t.assigneeId);
      const project = t.projectId ? projectById.get(t.projectId) : undefined;
      return {
        id: t.id,
        title: t.title,
        status: t.status as "issue" | "on_hold",
        ownerName: owner?.name ?? t.assigneeId,
        ownerColor: owner?.avatarColor ?? "#666666",
        clientLabel: project
          ? formatProjectLabel(project, db.clientOf(project))
          : undefined,
      };
    });
}
