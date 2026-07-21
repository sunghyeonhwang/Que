import { addDays, differenceInCalendarDays, format } from "date-fns";
import { ko } from "date-fns/locale";
import {
  canEditTask,
  canManageMilestone,
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
  /** 시작 ISO datetime. 없으면 null. */
  startAt: string | null;
  /** "9/8(월) 14:00" 콤팩트 포맷(목록 뷰 시작 컬럼용). 없으면 null. */
  startLabel: string | null;
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

// ---------- 마일스톤 (프로젝트 스코프 공용) ----------

/**
 * 프로젝트 화면(캘린더 셀·보드/목록 상단 띠·간트 레인)이 공유하는 마일스톤 뷰모델.
 * /schedule의 공용 MilestoneChip과 같은 필드 계약(id·title·dueAt·riskStatus·projectName·canManage).
 * canManage는 서버에서 canManageMilestone으로 판정해 내려보낸다(클라이언트 신뢰 금지).
 */
export interface ProjectMilestone {
  id: string;
  title: string;
  /** 기한 ISO datetime. */
  dueAt: string;
  /** dateKey 'yyyy-MM-dd'(캘린더 셀 배치·간트 레인 위치용). */
  day: string;
  projectName: string;
  riskStatus: "on_track" | "at_risk" | "late";
  /** 중요 마일스톤(최종 런칭일 등) — 칩이 붉은 그라데이션으로 표기된다. */
  critical?: boolean;
  /** 완료 시각(ISO) — 있으면 달성 완료(칩 스타일링·위험 제외 판정용, null=미완료). */
  achievedAt: string | null;
  canManage: boolean;
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
  /** 시작 ISO datetime. 없으면 null. */
  startAt: string | null;
  /** 편집 피커용 원시 시작일 yyyy-MM-dd. 없으면 null. */
  startDate: string | null;
  /** 편집 피커용 원시 시작시각 HH:mm. 없으면 null. */
  startTime: string | null;
  /** 마감 ISO datetime. 없으면 null. */
  endAt: string | null;
  /** 편집 피커용 원시 마감일 yyyy-MM-dd. 없으면 null. */
  dueDate: string | null;
  /** 편집 피커용 원시 마감시각 HH:mm. 없으면 null. */
  dueTime: string | null;
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
  /** 선행으로 연결 가능한 후보(같은 프로젝트·취소/병합 제외·자기 제외·순환 유발 제외).
      마감일 최신순(없으면 뒤) — 선행은 보통 시간상 직전 작업이라 최근 것이 위에 온다. */
  predecessorOptions: { id: string; title: string; statusLabel: string; dueLabel: string | null }[];
  /** 연결된 핵심결과(KR) id. 없으면 null(기획 §4 — Task↔KR 단일 연결). */
  keyResultId: string | null;
  /** 연결 가능한 KR 후보(취소 제외). 내 월 KR을 우선 정렬(§4). 본인 작업 편집 지점에서만 노출. */
  keyResultOptions: {
    id: string;
    title: string;
    objectiveTitle: string;
    month: string;
    isMine: boolean;
  }[];
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

/** 시작 일시 콤팩트 라벨 "9/8(월) 14:00" — 목록 뷰 시작 컬럼용(좁은 폭 대비 짧게). */
function formatStart(startAt: string | undefined): string | null {
  if (!startAt) return null;
  return format(new Date(startAt), "M/d(EEE) HH:mm", { locale: ko });
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

/** 편집 피커용 원시 시각 HH:mm(로컬/KST 벽시계). 없으면 null. */
function toTime(at: string | undefined): string | null {
  if (!at) return null;
  return format(new Date(at), "HH:mm");
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

/**
 * 스코프 내 프로젝트의 마일스톤을 공용 뷰모델로. 기한(day) 오름차순.
 * canManage는 canManageMilestone(관리자·프로젝트 담당자)으로 서버 판정.
 * 캘린더 셀·보드/목록 띠·간트 레인이 같은 데이터를 공유한다.
 */
function buildProjectMilestones(
  db: Awaited<ReturnType<typeof getDb>>,
  projectIds: string[],
  actor: User,
): ProjectMilestone[] {
  const idSet = new Set(projectIds);
  const projectById = projectByIdMap(db);
  return db.milestones
    .filter((m) => idSet.has(m.projectId))
    .map((m) => {
      const project = projectById.get(m.projectId);
      return {
        id: m.id,
        title: m.title,
        dueAt: m.dueAt,
        day: format(new Date(m.dueAt), "yyyy-MM-dd"),
        projectName: project?.name ?? m.projectId,
        riskStatus: m.riskStatus,
        critical: m.critical,
        achievedAt: m.achievedAt ?? null,
        canManage: canManageMilestone(actor, project),
      };
    })
    .sort((a, b) => a.day.localeCompare(b.day));
}

/**
 * 보드·목록 상단 띠용 마일스톤 목록(스코프 존중). 기한 오름차순.
 * 캘린더/간트는 각자 그리드에 배치하므로 별도 경로로 조회한다.
 */
export async function getProjectMilestones(
  actor: User,
  projectIds: string[],
): Promise<ProjectMilestone[]> {
  const db = await getDb();
  return buildProjectMilestones(db, projectIds, actor);
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
    startAt: task.startAt ?? null,
    startLabel: formatStart(task.startAt),
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
    // 관리자가 정한 표시 순서(sortOrder 오름차순) → 이름. /clients 그룹 정렬과 일관.
    .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0) || a.name.localeCompare(b.name, "ko"))
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

  // 배정 후보 = 전체 active 팀원(이름순). 소유자+기존 담당자로만 좁히면 새 프로젝트에 본인만 떠서
  // 담당자 배정이 막힌다(8인 팀 — 전체 노출이 맞다). 목록 필터 후보가 넓어지는 건 무해·일관.
  const members = db.users
    .filter((u) => u.active !== false)
    .map((u) => resolveMember(u.id))
    .filter((m): m is ListViewMember => m !== null)
    .sort((a, b) => a.name.localeCompare(b.name));

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
        .sort((a, b) => {
          // 마감일 최신순, 마감 없는 작업은 뒤로, 동률이면 제목 가나다.
          if (a.endAt !== b.endAt) {
            if (!a.endAt) return 1;
            if (!b.endAt) return -1;
            return b.endAt.localeCompare(a.endAt);
          }
          return a.title.localeCompare(b.title, "ko");
        })
        .map((t) => ({
          id: t.id,
          title: t.title,
          statusLabel: STATUS_LABEL[t.status],
          dueLabel: t.endAt ? format(new Date(t.endAt), "M/d", { locale: ko }) : null,
        }));

  // KR 연결 후보(기획 §4) — 취소된 KR 제외. 내 월(현재 월) KR을 맨 위로, 그다음 내 KR, 나머지 순.
  // 목록 상세는 과설계 금지 — Objective 제목·월만 라벨에 붙인다. 연결/해제는 core canEditTask가 강제.
  const nowMonthKey = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, "0")}`;
  const objectiveTitleById = new Map(db.objectives.map((o) => [o.id, o.title] as const));
  const krRank = (isMine: boolean, month: string): number =>
    isMine && month === nowMonthKey ? 0 : isMine ? 1 : 2;
  const keyResultOptions = db.keyResults
    .filter((k) => k.status !== "cancelled")
    .map((k) => ({
      id: k.id,
      title: k.title,
      objectiveTitle: objectiveTitleById.get(k.objectiveId) ?? "",
      month: k.month,
      isMine: k.ownerId === actor.id,
    }))
    .sort((a, b) => {
      const ra = krRank(a.isMine, a.month);
      const rb = krRank(b.isMine, b.month);
      if (ra !== rb) return ra - rb;
      if (a.month !== b.month) return b.month.localeCompare(a.month);
      return a.title.localeCompare(b.title, "ko");
    });

  return {
    taskId: task.id,
    projectId: task.projectId ?? "",
    title: task.title,
    description: task.description ?? null,
    status: task.status,
    columnKey,
    statusLabel: STATUS_LABEL[task.status],
    priority: task.priority,
    startAt: task.startAt ?? null,
    startDate: toDate(task.startAt),
    startTime: toTime(task.startAt),
    endAt: task.endAt ?? null,
    dueDate: toDate(task.endAt),
    dueTime: toTime(task.endAt),
    dueLabel: formatDue(task.endAt),
    isOverdue: isTaskOverdue(task),
    assignee: resolveMember(task.assigneeId),
    commentCount: comments.get(task.id) ?? 0,
    comments: commentViews.get(task.id) ?? [],
    activity,
    predecessorIds: task.predecessorIds ?? [],
    predecessorOptions,
    keyResultId: task.keyResultId ?? null,
    keyResultOptions,
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
  /** 소속 프로젝트 id — 전체 보기 그룹핑 키(클라이언트→프로젝트). 미소속이면 null. */
  projectId: string | null;
  /** 소속 클라이언트명 — 그룹 헤더 "클라이언트 · 프로젝트명" 병기용. 미소속이면 null. */
  clientName: string | null;
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

/** 간트 레인 마일스톤 = 공용 ProjectMilestone(그라데이션 칩·수정 진입점 공유). */
export type GanttMilestone = ProjectMilestone;

export interface ProjectGantt {
  /** 전체 보기: 클라이언트→프로젝트(sortOrder→이름) 그룹으로 묶어 시작일 순. 단일 보기: 시작일 순. */
  tasks: GanttTask[];
  /** 일정 없는 작업 — 간트에 못 그리므로 하단 칩으로 노출(날짜 지정 유도). */
  unscheduled: {
    taskId: string;
    title: string;
    assigneeName: string | null;
    projectName: string | null;
  }[];
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
/**
 * 오른쪽(미래)으로 최소 확보하는 일수 — 작업 범위가 짧아도 우측에 빈 날짜 칸이 계속 이어져
 * 앞일을 미리 배치할 수 있게 한다(2026-07-11 요청 5: "7/19 이후가 안 나옴"). 왼쪽은 기존 유지.
 */
const GANTT_MIN_FUTURE_DAYS = 56;

const toDay = (iso: string): string => format(new Date(iso), "yyyy-MM-dd");

/**
 * E-9d 일정 주의 판정 — "선행이 안 끝났는데 내 시작이 다가온다"를 사람이 읽는 문장으로.
 * 우선순위: ①선행 마감 지남·미완료(확실한 지연) ②선행 마감이 내 시작보다 늦음(계획 겹침)
 * ③선행 자체가 주의 상태(연쇄 전파). 완료/취소·병합 작업은 주의를 달지 않는다.
 *
 * export: 홈의 viewer-scoped 알림(getViewerAlerts)·팀 우선 확인(getTeamPriorityItems)이
 * 같은 문장을 재사용한다 — 간트·홈에서 "일정 주의" 문구가 어긋나지 않게 한 출처로 둔다.
 */
export function computeGanttRisk(
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

/**
 * 간트 뷰 데이터 — 보드와 같은 스코프(취소/병합 제외), 상태색·권한 규칙 공유.
 * @param now 오늘 라인·과거 판정 기준 시각. 기본 현재. 통합 간트가 서버 시각을 주입한다(하위호환 옵션).
 */
export async function getProjectGantt(
  actor: User,
  projectIds: string[],
  now: Date = new Date(),
): Promise<ProjectGantt> {
  const db = await getDb();
  const projectById = projectByIdMap(db);
  const clientById = new Map(db.clients.map((c) => [c.id, c]));
  const tasks = boardTasksOf(db, projectIds);
  const taskById = new Map(db.tasks.map((t) => [t.id, t]));
  const todayIso = now.toISOString();
  const today = toDay(todayIso);
  const risks = computeGanttRisk(tasks, taskById, todayIso);

  const scheduled = tasks.filter((t) => t.startAt || t.endAt);
  const milestones: GanttMilestone[] = buildProjectMilestones(db, projectIds, actor);

  const ganttTasks: GanttTask[] = scheduled
    .map((t) => {
      const start = toDay(t.startAt ?? t.endAt!);
      const end = toDay(t.endAt ?? t.startAt!);
      const project = projectById.get(t.projectId ?? "");
      const client = project?.clientId ? clientById.get(project.clientId) : undefined;
      const reason = risks.get(t.id) ?? null;
      return {
        taskId: t.id,
        title: t.title,
        status: t.status,
        assignee: resolveMember(t.assigneeId),
        projectName: project?.name ?? null,
        projectId: project?.id ?? null,
        clientName: client?.name ?? null,
        startDay: start <= end ? start : end,
        endDay: start <= end ? end : start,
        predecessorIds: t.predecessorIds ?? [],
        isOverdue: isTaskOverdue(t),
        canEdit: canEditTask(actor, t, project),
        atRisk: reason !== null,
        riskReason: reason,
      };
    })
    // 전체 보기 그룹핑용 정렬: 클라이언트(sortOrder→이름) → 프로젝트(sortOrder→이름) → 시작일.
    // 같은 프로젝트가 연속으로 모여 그룹 헤더를 한 번만 넣을 수 있다. 미소속은 뒤로.
    // 단일 프로젝트 보기는 프로젝트 키가 모두 같아 시작일 정렬로 귀결(기존 동작과 동일).
    .sort((a, b) => {
      const pa = projectById.get(a.projectId ?? "");
      const pb = projectById.get(b.projectId ?? "");
      const ca = pa?.clientId ? clientById.get(pa.clientId) : undefined;
      const cb = pb?.clientId ? clientById.get(pb.clientId) : undefined;
      const csoA = ca?.sortOrder ?? Number.MAX_SAFE_INTEGER;
      const csoB = cb?.sortOrder ?? Number.MAX_SAFE_INTEGER;
      if (csoA !== csoB) return csoA - csoB;
      const cCmp = (ca?.name ?? "").localeCompare(cb?.name ?? "", "ko");
      if (cCmp !== 0) return cCmp;
      const psoA = pa?.sortOrder ?? 0;
      const psoB = pb?.sortOrder ?? 0;
      if (psoA !== psoB) return psoA - psoB;
      const pCmp = (pa?.name ?? "").localeCompare(pb?.name ?? "", "ko");
      if (pCmp !== 0) return pCmp;
      // 같은 프로젝트 내부는 관리자/담당자가 간트에서 정한 수동 순서(sortOrder 오름차순) 우선.
      // 미지정(과거 데이터)은 0으로 해석 → 기존 시작일/마감일 순으로 자연 귀결.
      const soA = taskById.get(a.taskId)?.sortOrder ?? 0;
      const soB = taskById.get(b.taskId)?.sortOrder ?? 0;
      if (soA !== soB) return soA - soB;
      return a.startDay.localeCompare(b.startDay) || a.endDay.localeCompare(b.endDay);
    });

  // 범위: 작업·마일스톤·오늘을 덮고 ±2일. 상한(180일)을 넘으면 오늘 주변을 우선 보존.
  const days = [
    ...ganttTasks.flatMap((t) => [t.startDay, t.endDay]),
    ...milestones.map((m) => m.day),
    today,
  ].sort();
  let rangeStart = format(addDays(new Date(days[0]), -GANTT_PAD_DAYS), "yyyy-MM-dd");
  let rangeEnd = format(addDays(new Date(days[days.length - 1]), GANTT_PAD_DAYS), "yyyy-MM-dd");
  // 우측을 오늘+N일까지 최소 확보 — 작업이 근시일에 몰려 있어도 미래 날짜 칸이 계속 이어진다.
  const minFutureEnd = format(addDays(new Date(today), GANTT_MIN_FUTURE_DAYS), "yyyy-MM-dd");
  if (rangeEnd < minFutureEnd) rangeEnd = minFutureEnd;
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
        projectName: projectById.get(t.projectId ?? "")?.name ?? null,
      })),
    milestones,
    rangeStart,
    rangeEnd,
    today,
  };
}

/**
 * 전 프로젝트 통합 간트 — gant.griff.co.kr(회의용 조망)의 데이터 공급자.
 * 활성(active) 프로젝트 전부의 작업·마일스톤을 한 ProjectGantt로 합산한다.
 * clientId가 있으면 그 클라이언트 소속 프로젝트로 스코프를 좁힌다(상단 클라이언트 필터).
 * getProjectGantt를 그대로 재사용하므로 상태색·권한(canManage)·위험 판정이 /projects와 동일하다.
 * showProject=true로 렌더하면 각 행에 소속 프로젝트명이 붙는다(통합 화면 구분 라벨).
 */
export async function getUnifiedGantt(
  actor: User,
  now: Date = new Date(),
  clientId?: string,
): Promise<ProjectGantt> {
  const db = await getDb();
  const projectIds = db.projects
    .filter((p) => p.status === "active")
    .filter((p) => (clientId ? p.clientId === clientId : true))
    .map((p) => p.id);
  return getProjectGantt(actor, projectIds, now);
}

/** 오늘 조정된 마일스톤 1건(하단 요약 바 · 회의록 초안 후보). 읽기 전용. */
export interface GanttAdjustment {
  id: string;
  milestoneTitle: string;
  projectName: string | null;
  actorName: string;
  createdAt: string;
  changeType: ChangeLog["changeType"];
}

/**
 * 오늘(now 기준 날짜) 발생한 마일스톤 ChangeLog를 최신순으로. 회의 중 조정 요약 → 회의록 초안 후보.
 * getProjectGantt의 today와 같은 날짜 계산(format(now))을 써 "오늘 라인"과 집계 기준을 일치시킨다.
 */
export async function getTodayMilestoneAdjustments(
  now: Date = new Date(),
): Promise<GanttAdjustment[]> {
  const db = await getDb();
  const today = format(now, "yyyy-MM-dd");
  const userById = new Map(db.users.map((u) => [u.id, u]));
  const msById = new Map(db.milestones.map((m) => [m.id, m]));
  const projectById = projectByIdMap(db);
  return db.changeLogs
    .filter(
      (log) =>
        log.entityType === "milestone" &&
        format(new Date(log.createdAt), "yyyy-MM-dd") === today,
    )
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .map((log) => {
      const ms = msById.get(log.entityId);
      const project = ms ? projectById.get(ms.projectId) : undefined;
      return {
        id: log.id,
        milestoneTitle: ms?.title ?? log.afterValue ?? log.entityId,
        projectName: project?.name ?? null,
        actorName: userById.get(log.actorId)?.name ?? log.actorId,
        createdAt: log.createdAt,
        changeType: log.changeType,
      };
    });
}
