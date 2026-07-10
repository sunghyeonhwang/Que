import {
  addDays,
  addMonths,
  differenceInCalendarDays,
  format,
  isSameDay,
  isSameMonth,
  startOfMonth,
  startOfWeek,
  subMonths,
} from "date-fns";
import { ko } from "date-fns/locale";
import {
  canEditTask,
  findUser,
  type ChangeLog,
  type Project,
  type Task,
  type TaskStatus,
  type User,
} from "@que/core";
import { getDb } from "./db";
import { getCommentViewsByTask } from "./comments";
import type { TaskCommentView } from "@/components/app/task-comments";
import type { ListViewMember } from "./pm-types";

// 프로젝트(/projects) PM 도구 뷰모델 계층. 구 pm-data.ts(in-memory mock)를 대체한다.
// 카드 = core Task, 컬럼 = status 고정 4열. 모든 데이터는 core(getDb)에서 읽고,
// 쓰기는 서버 액션(pm-actions.ts)이 core mutation을 거친다.
//
// 담당자는 단수(Task.assigneeId), 분류/첨부/시간대 필드는 폐기됐다(A안).

export type TaskPriority = Task["priority"];

// ---------- status → 4열 고정 매핑 ----------

/** 보드/목록의 4개 고정 컬럼 키. status를 이 4열 중 하나로 접는다. */
export type BoardColumnKey = "scheduled" | "in_progress" | "blocked" | "done";

/** 컬럼 표시 라벨(운영 도구 상태 색상 의미 고정). */
export const COLUMN_LABEL: Record<BoardColumnKey, string> = {
  scheduled: "예정",
  in_progress: "진행중",
  blocked: "홀드·문제",
  done: "완료",
};

/** 컬럼 표시 순서. */
export const COLUMN_ORDER: readonly BoardColumnKey[] = [
  "scheduled",
  "in_progress",
  "blocked",
  "done",
];

/**
 * TaskStatus → 컬럼 매핑. cancelled/merged는 보드에서 제외(undefined)한다.
 * domain.ts taskStatus 전수 매핑 — 새 status가 생기면 여기서 컴파일 에러가 나야 한다.
 */
const STATUS_TO_COLUMN: Record<TaskStatus, BoardColumnKey | null> = {
  scheduled: "scheduled",
  needs_reschedule: "scheduled", // 시간변경필요도 아직 착수 전 → 예정 열
  in_progress: "in_progress",
  on_hold: "blocked",
  issue: "blocked",
  done: "done",
  cancelled: null, // 보드/목록/캘린더에서 제외
  merged: null, // 보드/목록/캘린더에서 제외
};

/** 카드가 보드에 표시되는 status인지(취소/병합 제외). */
function columnForStatus(status: TaskStatus): BoardColumnKey | null {
  return STATUS_TO_COLUMN[status];
}

// ---------- 프로젝트 목록/선택 ----------

/** 좌측 프로젝트 목록 항목. */
export interface ProjectListItem {
  id: string;
  name: string;
  description: string | null;
  /** 소속 클라이언트(거래처). 내부 잡무 등 미소속이면 null. */
  clientName: string | null;
  /** 보드에 노출되는(취소/병합 제외) 태스크 수. */
  taskCount: number;
}

/** 프로젝트 담당자·필터 피커용 메타. */
export interface ProjectMeta {
  id: string;
  name: string;
  description: string | null;
  /** 소속 클라이언트 id. 미소속이면 null. */
  clientId: string | null;
  /** 소속 클라이언트명(헤더 보조 텍스트용). 미소속이면 null. */
  clientName: string | null;
  /** 담당 지정 드롭다운·아바타 스택용 멤버(프로젝트 owner + 태스크 담당자). */
  members: ListViewMember[];
}

// ---------- 카드 ----------

/** 보드/목록 공용 태스크 카드. */
export interface TaskCard {
  taskId: string;
  title: string;
  status: TaskStatus;
  columnKey: BoardColumnKey;
  /** 담당자. Task.assigneeId는 필수지만 로스터에서 못 찾으면 null. */
  assignee: ListViewMember | null;
  /** 소속 프로젝트명. 전체 보기에서 카드가 어느 프로젝트인지 표시하는 소형 라벨용. 없으면 null. */
  projectName: string | null;
  priority: TaskPriority;
  /** 마감(종료) ISO datetime. 없으면 null. */
  endAt: string | null;
  /** "2025년 9월 8일 금요일" 포맷. 없으면 null. */
  dueLabel: string | null;
  /** 마감이 지났고 아직 완료/취소/병합이 아닌 지연 상태인지. red 신호용. */
  isOverdue: boolean;
  /** task_comments 실집계 수. */
  commentCount: number;
  /** 현재 사용자가 이 카드를 편집/이동할 수 있는지(canEditTask). false면 읽기 전용. */
  canEdit: boolean;
}

// ---------- 보드 뷰 ----------

export interface BoardColumn {
  key: BoardColumnKey;
  label: string;
  count: number;
  cards: TaskCard[];
}

export interface ProjectBoard {
  /** 항상 4열, COLUMN_ORDER 순. */
  columns: BoardColumn[];
}

// ---------- 목록 뷰 ----------

/** 목록 뷰 = 보드와 동일한 4열을 세로 섹션으로 표현. */
export interface ProjectList {
  columns: BoardColumn[];
}

// ---------- 캘린더 뷰 ----------

export interface CalendarCard {
  taskId: string;
  title: string;
  status: TaskStatus;
  columnKey: BoardColumnKey;
  /** 소속 프로젝트명. 전체 보기 pill에 표시. 없으면 null. */
  projectName: string | null;
  /** 마감이 지났고 아직 완료/취소/병합이 아닌 지연 상태인지. red 신호용. */
  isOverdue: boolean;
}

export interface CalendarDay {
  /** yyyy-MM-dd. */
  date: string;
  day: number;
  inMonth: boolean;
  isToday: boolean;
  cards: CalendarCard[];
}

export interface ProjectCalendar {
  /** 해석된 표시 월 "yyyy-MM". */
  month: string;
  monthLabel: string;
  prevMonth: string;
  nextMonth: string;
  /** 6주 × 7일 = 42 셀(일요일 시작). */
  days: CalendarDay[];
}

// ---------- 태스크 상세(드로어) ----------

/** 드로어 활동 로그 항목 — core ChangeLog(via:web) 1건을 표시용으로 접은 것. 읽기 전용. */
export interface TaskActivityItem {
  id: string;
  /** 변경한 사람 이름(로스터에서 못 찾으면 "알 수 없음"). */
  actorName: string;
  /** "담당자를 △△(으)로 변경했습니다" 식 요약 문구. */
  text: string;
  /** "3일 전" 식 상대 시각. */
  timeLabel: string;
}

export interface TaskDetail {
  taskId: string;
  /** 소속 프로젝트 id. 전체 보기에서 드로어가 해당 프로젝트 메타를 찾을 때 쓴다. */
  projectId: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  columnKey: BoardColumnKey;
  statusLabel: string;
  priority: TaskPriority;
  /** 마감 ISO datetime. 없으면 null. */
  endAt: string | null;
  /** 편집 피커용 원시 마감일 yyyy-MM-dd. 없으면 null. */
  dueDate: string | null;
  /** "2025년 9월 12일 금요일". 없으면 null. */
  dueLabel: string | null;
  /** 마감이 지났고 아직 완료/취소/병합이 아닌 지연 상태인지. red 신호용. */
  isOverdue: boolean;
  assignee: ListViewMember | null;
  commentCount: number;
  /** 댓글·도움 요청 목록. 타인 작업에도 노출(기획 권한 모델). */
  comments: TaskCommentView[];
  /** 최근 변경 이력(누가·무엇을·언제). 최신순 최대 5건. core ChangeLog에서 읽음. */
  activity: TaskActivityItem[];
  /** 선행 작업(E-9) — 이 작업들이 끝나야 시작. */
  predecessorIds: string[];
  /** 선행으로 연결 가능한 후보(같은 프로젝트·취소/병합 제외·자기 제외·순환 유발 제외). */
  predecessorOptions: { id: string; title: string; statusLabel: string }[];
  canEdit: boolean;
}

// ---------- 헬퍼 ----------

function resolveMember(id: string | undefined): ListViewMember | null {
  if (!id) return null;
  const user = findUser(id);
  if (!user) return null;
  return { id: user.id, name: user.name, avatarColor: user.avatarColor };
}

function formatDue(endAt: string | undefined): string | null {
  if (!endAt) return null;
  return format(new Date(endAt), "yyyy년 M월 d일 EEEE", { locale: ko });
}

/**
 * 마감이 지났고 아직 완료/취소/병합이 아닌 지연 상태인지.
 * Que 다른 화면(home-data·performance-data)과 동일 규칙(endMs < nowMs).
 */
function isTaskOverdue(task: Task): boolean {
  if (!task.endAt) return false;
  if (task.status === "done" || task.status === "cancelled" || task.status === "merged") {
    return false;
  }
  return new Date(task.endAt).getTime() < Date.now();
}

function toDate(endAt: string | undefined): string | null {
  if (!endAt) return null;
  return format(new Date(endAt), "yyyy-MM-dd");
}

/** 분/시간/일 전 상대 시각(members-data.ts와 동일 규칙). */
function formatRelative(iso: string, now: number): string {
  const min = Math.floor((now - new Date(iso).getTime()) / 60000);
  if (min < 1) return "방금 전";
  if (min < 60) return `${min}분 전`;
  const hours = Math.floor(min / 60);
  if (hours < 24) return `${hours}시간 전`;
  return `${Math.floor(hours / 24)}일 전`;
}

/** 태스크 status enum → 사람이 읽는 라벨(활동 로그용, 미지원 값은 원문 유지). */
function statusText(raw: string | undefined): string {
  if (!raw) return "";
  return (STATUS_LABEL as Record<string, string>)[raw] ?? raw;
}

/**
 * core ChangeLog 1건을 드로어 활동 문구로 접는다(읽기 전용, 새 mutation 없음).
 * before/after 원문 포맷(mock-db.ts logChange)에 의존한다.
 */
function changeLogText(log: ChangeLog): string {
  switch (log.changeType) {
    case "create":
      return "작업을 만들었습니다";
    case "delete":
      return "작업을 취소했습니다";
    case "move":
      return "일정을 변경했습니다";
    case "status_change":
      return `상태를 ${statusText(log.beforeValue)} → ${statusText(log.afterValue)}(으)로 변경했습니다`;
    case "update": {
      // 담당자 변경은 afterValue가 "담당: 홍길동" 형태(mock-db reassignTask).
      const after = log.afterValue ?? "";
      if (after.startsWith("담당: ")) {
        return `담당자를 ${after.slice("담당: ".length)}(으)로 변경했습니다`;
      }
      return "작업 정보를 수정했습니다";
    }
    default:
      return "작업을 변경했습니다";
  }
}

const STATUS_LABEL: Record<TaskStatus, string> = {
  scheduled: "예정",
  in_progress: "진행중",
  done: "완료",
  needs_reschedule: "시간변경필요",
  on_hold: "홀드",
  issue: "문제발생",
  cancelled: "취소",
  merged: "병합됨",
};

/**
 * 스코프(프로젝트 id 배열) 소속 · 보드 노출(취소/병합 제외) 태스크만.
 * 전체 보기는 스코프 내 여러 프로젝트를 합산한다(단일 보기는 [id] 1개).
 */
function boardTasksOf(db: Awaited<ReturnType<typeof getDb>>, projectIds: string[]): Task[] {
  const idSet = new Set(projectIds);
  return db.tasks.filter(
    (t) => t.projectId !== undefined && idSet.has(t.projectId) && columnForStatus(t.status) !== null,
  );
}

/** projectId → Project 조회 맵(카드의 소속 프로젝트명·권한 판단용). */
function projectByIdMap(db: Awaited<ReturnType<typeof getDb>>): Map<string, Project> {
  return new Map(db.projects.map((p) => [p.id, p]));
}

function commentCountMap(db: Awaited<ReturnType<typeof getDb>>): Map<string, number> {
  const map = new Map<string, number>();
  for (const c of db.taskComments) {
    map.set(c.taskId, (map.get(c.taskId) ?? 0) + 1);
  }
  return map;
}

function toCard(
  task: Task,
  actor: User,
  project: Project | undefined,
  comments: Map<string, number>,
): TaskCard {
  const columnKey = columnForStatus(task.status)!; // 호출부에서 이미 보드 노출 태스크만 넘긴다
  return {
    taskId: task.id,
    title: task.title,
    status: task.status,
    columnKey,
    assignee: resolveMember(task.assigneeId),
    projectName: project?.name ?? null,
    priority: task.priority,
    endAt: task.endAt ?? null,
    dueLabel: formatDue(task.endAt),
    isOverdue: isTaskOverdue(task),
    commentCount: comments.get(task.id) ?? 0,
    canEdit: canEditTask(actor, task, project),
  };
}

// ---------- 조회 API ----------

/**
 * 좌측 프로젝트 목록 — active 프로젝트만, 활성 클라이언트 필터 스코프 존중.
 * clientFilter가 있으면 그 클라이언트 소속 프로젝트만. 이름 오름차순.
 */
export async function getActiveProjects(clientFilter?: string): Promise<ProjectListItem[]> {
  const db = await getDb();
  const counts = new Map<string, number>();
  for (const t of db.tasks) {
    if (!t.projectId || columnForStatus(t.status) === null) continue;
    counts.set(t.projectId, (counts.get(t.projectId) ?? 0) + 1);
  }
  const clientNameOf = (clientId: string | undefined): string | null =>
    clientId ? (db.clients.find((c) => c.id === clientId)?.name ?? null) : null;
  return db.projects
    .filter((p) => p.status === "active")
    .filter((p) => (clientFilter ? p.clientId === clientFilter : true))
    .sort((a, b) => a.name.localeCompare(b.name, "ko"))
    .map((p) => ({
      id: p.id,
      name: p.name,
      description: p.description ?? null,
      clientName: clientNameOf(p.clientId),
      taskCount: counts.get(p.id) ?? 0,
    }));
}

/**
 * URL ?project=<id>를 목록 스코프 안에서 검증해 선택 프로젝트 id를 정한다.
 * 요청 id가 목록에 있으면 그것, 없으면 첫 프로젝트, 목록이 비면 null.
 */
export function resolveSelectedProjectId(
  projects: ProjectListItem[],
  requested: string | undefined,
): string | null {
  if (projects.length === 0) return null;
  if (requested && projects.some((p) => p.id === requested)) return requested;
  return projects[0].id;
}

/** 프로젝트 메타(피커·헤더용). 없으면 null. */
export async function getProjectMeta(projectId: string): Promise<ProjectMeta | null> {
  const db = await getDb();
  const project = db.projects.find((p) => p.id === projectId);
  if (!project) return null;

  const memberIds = new Set<string>([project.ownerId]);
  for (const t of db.tasks) {
    if (t.projectId === project.id) memberIds.add(t.assigneeId);
  }
  const members = [...memberIds]
    .map(resolveMember)
    .filter((m): m is ListViewMember => m !== null);

  const client = project.clientId
    ? db.clients.find((c) => c.id === project.clientId)
    : undefined;

  return {
    id: project.id,
    name: project.name,
    description: project.description ?? null,
    clientId: client?.id ?? null,
    clientName: client?.name ?? null,
    members,
  };
}

/**
 * 보드 뷰 — 4열 고정. cancelled/merged 제외.
 * projectIds가 여러 개면(전체 보기) 스코프 내 프로젝트를 한 보드로 합산한다.
 */
export async function getProjectBoard(
  actor: User,
  projectIds: string[],
): Promise<ProjectBoard> {
  const db = await getDb();
  const projectById = projectByIdMap(db);
  const comments = commentCountMap(db);
  const tasks = boardTasksOf(db, projectIds);

  const byColumn = new Map<BoardColumnKey, TaskCard[]>();
  for (const key of COLUMN_ORDER) byColumn.set(key, []);
  for (const task of tasks) {
    const card = toCard(task, actor, projectById.get(task.projectId ?? ""), comments);
    byColumn.get(card.columnKey)!.push(card);
  }

  const columns: BoardColumn[] = COLUMN_ORDER.map((key) => {
    const cards = byColumn.get(key)!;
    return { key, label: COLUMN_LABEL[key], count: cards.length, cards };
  });
  return { columns };
}

/** 목록 뷰 — 보드와 동일 4열을 섹션으로. */
export async function getProjectList(
  actor: User,
  projectIds: string[],
): Promise<ProjectList> {
  const board = await getProjectBoard(actor, projectIds);
  return { columns: board.columns };
}

/** "yyyy-MM" 화이트리스트(01~12만). */
const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;

function defaultAnchorMonth(tasks: Task[]): string {
  const counts = new Map<string, number>();
  for (const t of tasks) {
    if (!t.endAt) continue;
    counts.set(t.endAt.slice(0, 7), (counts.get(t.endAt.slice(0, 7)) ?? 0) + 1);
  }
  let best: string | null = null;
  let bestCount = -1;
  for (const [key, count] of counts) {
    if (count > bestCount || (count === bestCount && best !== null && key < best)) {
      best = key;
      bestCount = count;
    }
  }
  return best ?? format(new Date(), "yyyy-MM");
}

/**
 * 캘린더 뷰 — endAt(마감) 기준 배치. cancelled/merged 제외. 읽기 전용.
 * projectIds가 여러 개면(전체 보기) 스코프 내 프로젝트를 합산한다.
 */
export async function getProjectCalendar(
  projectIds: string[],
  anchorMonth: string | null | undefined,
): Promise<ProjectCalendar> {
  const db = await getDb();
  const projectById = projectByIdMap(db);
  const tasks = boardTasksOf(db, projectIds);

  const month =
    anchorMonth && MONTH_RE.test(anchorMonth) ? anchorMonth : defaultAnchorMonth(tasks);
  const anchorDate = new Date(`${month}-01T00:00:00`);
  const gridStart = startOfWeek(startOfMonth(anchorDate), { weekStartsOn: 0 });
  const today = new Date();

  // yyyy-MM-dd → 카드[]
  const byDate = new Map<string, CalendarCard[]>();
  for (const task of tasks) {
    const key = toDate(task.endAt);
    if (!key) continue;
    const card: CalendarCard = {
      taskId: task.id,
      title: task.title,
      status: task.status,
      columnKey: columnForStatus(task.status)!,
      projectName: projectById.get(task.projectId ?? "")?.name ?? null,
      isOverdue: isTaskOverdue(task),
    };
    const list = byDate.get(key) ?? [];
    list.push(card);
    byDate.set(key, list);
  }

  const days: CalendarDay[] = Array.from({ length: 42 }, (_, i) => {
    const d = addDays(gridStart, i);
    const key = format(d, "yyyy-MM-dd");
    return {
      date: key,
      day: d.getDate(),
      inMonth: isSameMonth(d, anchorDate),
      isToday: isSameDay(d, today),
      cards: byDate.get(key) ?? [],
    };
  });

  return {
    month,
    monthLabel: format(anchorDate, "yyyy년 M월", { locale: ko }),
    prevMonth: format(subMonths(anchorDate, 1), "yyyy-MM"),
    nextMonth: format(addMonths(anchorDate, 1), "yyyy-MM"),
    days,
  };
}

/** 태스크 상세(드로어) — 취소/병합 태스크도 열람은 가능(드로어에서 상태 확인). id 없으면 null. */
export async function getTaskDetail(
  actor: User,
  taskId: string | null | undefined,
): Promise<TaskDetail | null> {
  if (!taskId) return null;
  const db = await getDb();
  const task = db.tasks.find((t) => t.id === taskId);
  if (!task) return null;
  const project = db.projects.find((p) => p.id === task.projectId);
  const comments = commentCountMap(db);
  const commentViews = await getCommentViewsByTask();
  const columnKey = columnForStatus(task.status) ?? "scheduled";

  // 최근 변경 이력 — 이 태스크 대상 ChangeLog를 최신순 최대 5건.
  const now = Date.now();
  const activity: TaskActivityItem[] = db.changeLogs
    .filter((log) => log.entityType === "task" && log.entityId === task.id)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, 5)
    .map((log) => ({
      id: log.id,
      actorName: findUser(log.actorId)?.name ?? "알 수 없음",
      text: changeLogText(log),
      timeLabel: formatRelative(log.createdAt, now),
    }));

  // 선행 후보(E-9): 같은 프로젝트, 취소/병합·자기 자신 제외, 그리고 그 후보의 선행 사슬에
  // 이 태스크가 이미 들어 있으면(=연결 시 순환) 제외한다 — UI에서 불가능한 선택지를 안 보여준다.
  const taskById = new Map(db.tasks.map((t) => [t.id, t]));
  const chainsInto = (candidateId: string): boolean => {
    const stack = [candidateId];
    const seen = new Set<string>();
    while (stack.length > 0) {
      const id = stack.pop()!;
      if (id === task.id) return true;
      if (seen.has(id)) continue;
      seen.add(id);
      const t = taskById.get(id);
      if (t?.predecessorIds) stack.push(...t.predecessorIds);
    }
    return false;
  };
  // 현재 연결된 선행은 상태와 무관하게 항상 포함 — 뱃지에 제목이 보이고 해제도 가능해야 한다
  // (core는 기존 연결의 유지·해제를 grandfather로 허용). 신규 후보만 취소/병합·순환을 거른다.
  const linked = new Set(task.predecessorIds ?? []);
  const predecessorOptions = !task.projectId
    ? []
    : db.tasks
        .filter(
          (t) =>
            t.id !== task.id &&
            (linked.has(t.id) ||
              (t.projectId === task.projectId &&
                t.status !== "cancelled" &&
                t.status !== "merged" &&
                !chainsInto(t.id))),
        )
        .sort((a, b) => a.title.localeCompare(b.title, "ko"))
        .map((t) => ({ id: t.id, title: t.title, statusLabel: STATUS_LABEL[t.status] }));

  return {
    taskId: task.id,
    projectId: task.projectId ?? "",
    title: task.title,
    description: task.description ?? null,
    status: task.status,
    columnKey,
    statusLabel: STATUS_LABEL[task.status],
    priority: task.priority,
    endAt: task.endAt ?? null,
    dueDate: toDate(task.endAt),
    dueLabel: formatDue(task.endAt),
    isOverdue: isTaskOverdue(task),
    assignee: resolveMember(task.assigneeId),
    commentCount: comments.get(task.id) ?? 0,
    comments: commentViews.get(task.id) ?? [],
    activity,
    predecessorIds: task.predecessorIds ?? [],
    predecessorOptions,
    canEdit: canEditTask(actor, task, project),
  };
}

// ---------- 간트 뷰 (E-9) ----------

/** 간트 행 하나 = 일정(시작 또는 마감)이 있는 작업. 시간은 무시하고 일 단위로 그린다. */
export interface GanttTask {
  taskId: string;
  title: string;
  status: TaskStatus;
  assignee: ListViewMember | null;
  /** 전체 보기에서 소속 표시용. 단일 프로젝트 보기면 null. */
  projectName: string | null;
  /** 막대 구간(dateKey 'yyyy-MM-dd'). 한쪽만 있으면 같은 값(하루 막대). */
  startDay: string;
  endDay: string;
  predecessorIds: string[];
  isOverdue: boolean;
  canEdit: boolean;
  /** E-9d 일정 주의 — 선행 지연/겹침으로 시작이 밀릴 수 있는 상태. */
  atRisk: boolean;
  /** 주의 사유(사람이 읽는 문장). atRisk=false면 null. */
  riskReason: string | null;
}

export interface GanttMilestone {
  id: string;
  title: string;
  /** dateKey 'yyyy-MM-dd'. */
  day: string;
  riskStatus: "on_track" | "at_risk" | "late";
}

export interface ProjectGantt {
  /** startDay 오름차순. */
  tasks: GanttTask[];
  /** 일정 없는 작업 — 간트에 못 그리므로 하단 칩으로 노출(날짜 지정 유도). */
  unscheduled: { taskId: string; title: string; assigneeName: string | null }[];
  milestones: GanttMilestone[];
  /** 그리드 범위(dateKey, 양끝 포함). 작업·마일스톤·오늘을 덮고 앞뒤 2일 패딩. */
  rangeStart: string;
  rangeEnd: string;
  /** 오늘 dateKey — 오늘 라인 위치·과거 판정을 서버 기준(KST)으로 고정. */
  today: string;
}

const GANTT_PAD_DAYS = 2;
/** 그리드 상한(컬럼 수) — 초장기 이상치가 화면을 무한히 늘리는 것 방지. */
const GANTT_MAX_DAYS = 180;

const toDay = (iso: string): string => format(new Date(iso), "yyyy-MM-dd");

/**
 * E-9d 일정 주의 판정 — "선행이 안 끝났는데 내 시작이 다가온다"를 사람이 읽는 문장으로.
 * 우선순위: ①선행 마감 지남·미완료(확실한 지연) ②선행 마감이 내 시작보다 늦음(계획 겹침)
 * ③선행 자체가 주의 상태(연쇄 전파). 완료/취소·병합 작업은 주의를 달지 않는다.
 */
function computeGanttRisk(
  tasks: Task[],
  taskById: Map<string, Task>,
  todayIso: string,
): Map<string, string> {
  const reasons = new Map<string, string>();
  const now = Date.parse(todayIso);
  const isDoneLike = (t: Task) => t.status === "done" || t.status === "cancelled" || t.status === "merged";

  // 선행 그래프를 따라 전파해야 하므로, 시작일 순으로 반복 판정(선행이 먼저 판정되도록 정렬).
  const ordered = [...tasks].sort((a, b) =>
    (a.startAt ?? a.endAt ?? "").localeCompare(b.startAt ?? b.endAt ?? ""),
  );
  for (const task of ordered) {
    if (isDoneLike(task) || !task.predecessorIds?.length) continue;
    for (const pid of task.predecessorIds) {
      const p = taskById.get(pid);
      if (!p || isDoneLike(p)) continue;
      if (p.endAt && Date.parse(p.endAt) < now) {
        reasons.set(task.id, `선행 '${p.title}'의 마감이 지났는데 아직 끝나지 않았어요`);
        break;
      }
      if (p.endAt && task.startAt && Date.parse(p.endAt) > Date.parse(task.startAt)) {
        reasons.set(task.id, `선행 '${p.title}'가 끝나기 전에 시작하도록 잡혀 있어요`);
        break;
      }
      if (reasons.has(pid)) {
        reasons.set(task.id, `선행 '${p.title}'의 일정이 밀릴 수 있어요`);
        break;
      }
    }
  }
  return reasons;
}

/** 간트 뷰 데이터 — 보드와 같은 스코프(취소/병합 제외), 상태색·권한 규칙 공유. */
export async function getProjectGantt(actor: User, projectIds: string[]): Promise<ProjectGantt> {
  const db = await getDb();
  const projectById = projectByIdMap(db);
  const tasks = boardTasksOf(db, projectIds);
  const taskById = new Map(db.tasks.map((t) => [t.id, t]));
  const todayIso = new Date().toISOString();
  const today = toDay(todayIso);
  const risks = computeGanttRisk(tasks, taskById, todayIso);

  const scheduled = tasks.filter((t) => t.startAt || t.endAt);
  const idSet = new Set(projectIds);
  const milestones: GanttMilestone[] = db.milestones
    .filter((m) => idSet.has(m.projectId))
    .map((m) => ({ id: m.id, title: m.title, day: toDay(m.dueAt), riskStatus: m.riskStatus }))
    .sort((a, b) => a.day.localeCompare(b.day));

  const ganttTasks: GanttTask[] = scheduled
    .map((t) => {
      const start = toDay(t.startAt ?? t.endAt!);
      const end = toDay(t.endAt ?? t.startAt!);
      const project = projectById.get(t.projectId ?? "");
      const reason = risks.get(t.id) ?? null;
      return {
        taskId: t.id,
        title: t.title,
        status: t.status,
        assignee: resolveMember(t.assigneeId),
        projectName: project?.name ?? null,
        startDay: start <= end ? start : end,
        endDay: start <= end ? end : start,
        predecessorIds: t.predecessorIds ?? [],
        isOverdue: isTaskOverdue(t),
        canEdit: canEditTask(actor, t, project),
        atRisk: reason !== null,
        riskReason: reason,
      };
    })
    .sort((a, b) => a.startDay.localeCompare(b.startDay) || a.endDay.localeCompare(b.endDay));

  // 범위: 작업·마일스톤·오늘을 덮고 ±2일. 상한(180일)을 넘으면 오늘 주변을 우선 보존.
  const days = [
    ...ganttTasks.flatMap((t) => [t.startDay, t.endDay]),
    ...milestones.map((m) => m.day),
    today,
  ].sort();
  let rangeStart = format(addDays(new Date(days[0]), -GANTT_PAD_DAYS), "yyyy-MM-dd");
  let rangeEnd = format(addDays(new Date(days[days.length - 1]), GANTT_PAD_DAYS), "yyyy-MM-dd");
  const span = differenceInCalendarDays(new Date(rangeEnd), new Date(rangeStart)) + 1;
  if (span > GANTT_MAX_DAYS) {
    const half = Math.floor(GANTT_MAX_DAYS / 2);
    rangeStart = format(addDays(new Date(today), -half), "yyyy-MM-dd");
    rangeEnd = format(addDays(new Date(today), half), "yyyy-MM-dd");
  }

  return {
    tasks: ganttTasks,
    unscheduled: tasks
      .filter((t) => !t.startAt && !t.endAt)
      .map((t) => ({
        taskId: t.id,
        title: t.title,
        assigneeName: resolveMember(t.assigneeId)?.name ?? null,
      })),
    milestones,
    rangeStart,
    rangeEnd,
    today,
  };
}
