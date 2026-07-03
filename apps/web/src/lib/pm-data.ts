import {
  addDays,
  addMonths,
  format,
  isSameDay,
  isSameMonth,
  startOfMonth,
  startOfWeek,
  subMonths,
} from "date-fns";
import { ko } from "date-fns/locale";
import { findUser } from "@que/core";

// 프로젝트(Projects) 화면용 신규 mock 모델. (P1: mock 우선, DB 연동 없음)
// 담당자 아바타는 core의 USERS(avatarColor)를 재사용한다.

export type PmPriority = "high" | "normal" | "low";

export type AttachmentKind = "pdf" | "doc" | "img" | "file";

export interface PmAttachment {
  id: string;
  name: string;
  /** 표시용 용량 라벨(예: "12.0 MB"). */
  sizeLabel: string;
  kind: AttachmentKind;
}

export interface Workspace {
  id: string;
  name: string;
  /** 스위처 정사각 뱃지 글자(예: "MX"). */
  initials: string;
  /** 뱃지 배경색(hex). */
  color: string;
}

export interface PmProject {
  id: string;
  workspaceId: string;
  name: string;
  description: string;
  memberIds: string[];
}

export interface TaskGroup {
  id: string;
  projectId: string;
  name: string;
  /** 그룹 상태 점 색상(hex). green=완료, blue=예정, amber=진행/주의, neutral=백로그. */
  color: string;
  order: number;
}

export interface PmTask {
  id: string;
  groupId: string;
  name: string;
  description: string;
  /** ISO 날짜(yyyy-MM-dd). 없으면 마감일 미정. */
  dueAt: string | null;
  priority: PmPriority;
  assigneeIds: string[];
  done: boolean;
  /** 카드 댓글 수(보드 뷰 푸터). */
  commentCount: number;
  /** 카드 첨부 수(보드 뷰 푸터). */
  attachmentCount: number;
  /** 상세 드로어용 분류(예: "UX 리서치"). 없으면 표시 안 함. */
  category?: string;
  /** 상세 드로어용 시간대(예: "09:00 - 11:30 AM"). 없으면 표시 안 함. */
  timeRange?: string;
  /** 상세 드로어용 첨부 파일. 없으면 섹션 생략. */
  attachments?: PmAttachment[];
}

// ---------- seed ----------

const WORKSPACES: Workspace[] = [
  { id: "ws-mendix", name: "멘딕스", initials: "MX", color: "#7c3aed" },
];

const PROJECTS: PmProject[] = [
  {
    id: "proj-mendix",
    workspaceId: "ws-mendix",
    name: "멘딕스",
    description: "여러 플랫폼에 원활하게 적응하는 동적 디자인 시스템을 만드세요.",
    memberIds: [
      "hwang-sunghyeon",
      "oh-seunghoon",
      "hwang-sungjin",
      "park-seunghwan",
      "song-suyong",
      "lee-yejin",
      "kim-riwon",
    ],
  },
];

// TASKS/GROUPS는 mock mutation 대상이다. 서버 프로세스 생존 동안만 유지되며 DB화는 후속 단계다.
// GROUPS는 push로만 변경(재할당 없음)해 const, TASKS는 delete/move에서 재할당하므로 let.
// PROJECTS/WORKSPACES는 seed 고정이다.
const GROUPS: TaskGroup[] = [
  { id: "grp-backlog", projectId: "proj-mendix", name: "백로그", color: "#9ca3af", order: 0 },
  { id: "grp-todo", projectId: "proj-mendix", name: "할 일", color: "#3388ff", order: 1 },
  { id: "grp-doing", projectId: "proj-mendix", name: "진행 중", color: "#f59e0b", order: 2 },
  { id: "grp-done", projectId: "proj-mendix", name: "완료", color: "#22c55e", order: 3 },
];

let TASKS: PmTask[] = [
  // 백로그
  {
    id: "task-1",
    groupId: "grp-backlog",
    name: "기존 컴포넌트 검토",
    description: "현재 모든 디자인 컴포넌트를 검토하고 플랫폼 간 불일치를 문서화하세요.",
    dueAt: "2025-09-08",
    priority: "high",
    assigneeIds: ["park-seunghwan"],
    done: false,
    commentCount: 0,
    attachmentCount: 1,
    category: "디자인 시스템",
    attachments: [
      { id: "att-1a", name: "Component-Audit.pdf", sizeLabel: "8.4 MB", kind: "pdf" },
    ],
  },
  {
    id: "task-2",
    groupId: "grp-backlog",
    name: "디자인 원칙 초안",
    description: "일관성, 간격, 브랜드 표현에 대한 핵심 원칙을 정리하세요.",
    dueAt: "2025-09-08",
    priority: "low",
    assigneeIds: ["lee-yejin"],
    done: false,
    commentCount: 0,
    attachmentCount: 0,
    category: "디자인 시스템",
  },
  {
    id: "task-3",
    groupId: "grp-backlog",
    name: "타이포그래피 탐색",
    description: "가독성을 위한 균형 잡힌 계층 구조를 만들기 위해 폰트 조합을 실험해 보세요.",
    dueAt: "2025-09-08",
    priority: "normal",
    assigneeIds: ["kim-riwon"],
    done: false,
    commentCount: 1,
    attachmentCount: 0,
    category: "디자인 시스템",
  },
  // 할 일
  {
    id: "task-4",
    groupId: "grp-todo",
    name: "핵심 버튼 컴포넌트 제작",
    description: "Figma에서 기본 버튼 변형을 개발하세요.",
    dueAt: "2025-09-16",
    priority: "low",
    assigneeIds: ["song-suyong", "lee-yejin"],
    done: false,
    commentCount: 0,
    attachmentCount: 0,
    category: "디자인 시스템",
    timeRange: "09:00 - 11:30 AM",
  },
  {
    id: "task-5",
    groupId: "grp-todo",
    name: "아이콘 세트 제작",
    description: "일관된 획과 정렬 규칙으로 통합 아이콘을 디자인하세요.",
    dueAt: "2025-09-15",
    priority: "low",
    assigneeIds: ["hwang-sungjin", "kim-riwon"],
    done: false,
    commentCount: 0,
    attachmentCount: 0,
    category: "디자인 시스템",
  },
  // 진행 중
  {
    id: "task-6",
    groupId: "grp-doing",
    name: "정보 아키텍처 매핑",
    description:
      "핵심 페이지와 작업 계층 구조를 구성하여 탐색과 사용자 여정을 단순화하세요.\n주요 사용자 시나리오를 기준으로 내비게이션 흐름을 정리하고, 개발 이관 전 최종 검토를 진행합니다.",
    dueAt: "2025-09-08",
    priority: "normal",
    assigneeIds: ["hwang-sunghyeon", "oh-seunghoon"],
    done: false,
    commentCount: 5,
    attachmentCount: 2,
    category: "UX 리서치",
    timeRange: "09:00 - 11:30 AM",
    attachments: [
      { id: "att-6a", name: "User-Research.pdf", sizeLabel: "12.0 MB", kind: "pdf" },
      { id: "att-6b", name: "Persona-Analysis.docx", sizeLabel: "3.2 MB", kind: "doc" },
    ],
  },
  {
    id: "task-7",
    groupId: "grp-doing",
    name: "컬러 시스템 정의",
    description: "브랜드와 상태 색상을 위한 접근성 높은 팔레트를 구성하세요.",
    dueAt: "2025-09-12",
    priority: "high",
    assigneeIds: ["lee-yejin"],
    done: false,
    commentCount: 12,
    attachmentCount: 4,
    category: "디자인 시스템",
    timeRange: "14:00 - 16:00 PM",
    attachments: [
      { id: "att-7a", name: "Color-Tokens.pdf", sizeLabel: "5.6 MB", kind: "pdf" },
      { id: "att-7b", name: "Palette-Preview.png", sizeLabel: "2.1 MB", kind: "img" },
    ],
  },
  {
    id: "task-8",
    groupId: "grp-doing",
    name: "반응형 그리드 설계",
    description: "브레이크포인트별 레이아웃 규칙을 정의하고 태블릿·데스크톱을 함께 검증하세요.",
    dueAt: "2025-09-18",
    priority: "normal",
    assigneeIds: ["park-seunghwan", "song-suyong"],
    done: false,
    commentCount: 8,
    attachmentCount: 0,
    category: "디자인 시스템",
  },
  // 완료
  {
    id: "task-9",
    groupId: "grp-done",
    name: "프로젝트 킥오프",
    description: "이해관계자와 목표·범위를 정렬했습니다.",
    dueAt: "2025-08-29",
    priority: "normal",
    assigneeIds: ["hwang-sunghyeon", "oh-seunghoon"],
    done: true,
    commentCount: 3,
    attachmentCount: 1,
    category: "기획",
    attachments: [{ id: "att-9a", name: "Kickoff-Notes.docx", sizeLabel: "1.1 MB", kind: "doc" }],
  },
  {
    id: "task-10",
    groupId: "grp-done",
    name: "리서치 정리",
    description: "경쟁 제품 분석과 사용자 인터뷰 결과를 정리했습니다.",
    dueAt: "2025-09-01",
    priority: "low",
    assigneeIds: ["kim-riwon"],
    done: true,
    commentCount: 6,
    attachmentCount: 2,
    category: "UX 리서치",
    attachments: [
      { id: "att-10a", name: "Competitive-Analysis.pdf", sizeLabel: "9.8 MB", kind: "pdf" },
      { id: "att-10b", name: "Interview-Summary.docx", sizeLabel: "2.4 MB", kind: "doc" },
    ],
  },
];

// ---------- mutation 계층 (서버 전용 순수 함수, mock in-place 변경) ----------
// 서버 액션에서만 호출한다. revalidatePath는 호출부(pm-actions)의 책임이다.

/** 신규 태스크를 생성해 TASKS 끝에 push. priority 기본 "normal", 나머지 빈/0/false. */
export function createTask(input: {
  groupId: string;
  name: string;
  description?: string;
  dueAt?: string | null;
  priority?: PmPriority;
  assigneeIds?: string[];
}): PmTask {
  const task: PmTask = {
    id: `task-${crypto.randomUUID()}`,
    groupId: input.groupId,
    name: input.name,
    description: input.description ?? "",
    dueAt: input.dueAt ?? null,
    priority: input.priority ?? "normal",
    assigneeIds: input.assigneeIds ?? [],
    done: false,
    commentCount: 0,
    attachmentCount: 0,
  };
  TASKS.push(task);
  return task;
}

/** 부분 업데이트. 존재하지 않으면 null. groupId 변경도 허용(단순 소속 변경, 순서 재배치는 moveTask). */
export function updateTask(
  id: string,
  patch: Partial<{
    name: string;
    description: string;
    dueAt: string | null;
    priority: PmPriority;
    assigneeIds: string[];
    groupId: string;
  }>,
): PmTask | null {
  const task = TASKS.find((t) => t.id === id);
  if (!task) return null;
  if (patch.name !== undefined) task.name = patch.name;
  if (patch.description !== undefined) task.description = patch.description;
  if (patch.dueAt !== undefined) task.dueAt = patch.dueAt;
  if (patch.priority !== undefined) task.priority = patch.priority;
  if (patch.assigneeIds !== undefined) task.assigneeIds = patch.assigneeIds;
  if (patch.groupId !== undefined) task.groupId = patch.groupId;
  return task;
}

/** 태스크 삭제. 삭제되면 true, 없으면 false. */
export function deleteTask(id: string): boolean {
  const before = TASKS.length;
  TASKS = TASKS.filter((t) => t.id !== id);
  return TASKS.length < before;
}

/** 완료 토글. 존재하지 않으면 null. */
export function setTaskDone(id: string, done: boolean): PmTask | null {
  const task = TASKS.find((t) => t.id === id);
  if (!task) return null;
  task.done = done;
  return task;
}

/**
 * 태스크를 대상 그룹으로 이동. TASKS 배열에서 제거 후 대상 그룹 태스크들 사이 toIndex
 * 위치(없으면 끝)에 재삽입해 그룹 내 순서를 유지한다. 존재하지 않으면 null.
 */
export function moveTask(id: string, toGroupId: string, toIndex?: number): PmTask | null {
  const task = TASKS.find((t) => t.id === id);
  if (!task) return null;
  // 먼저 배열에서 제거하고 그룹을 바꾼다.
  TASKS = TASKS.filter((t) => t.id !== id);
  task.groupId = toGroupId;
  // 대상 그룹에 이미 속한 태스크들의 전역 인덱스를 구해 삽입 위치를 계산한다.
  const groupPositions = TASKS.reduce<number[]>((acc, t, i) => {
    if (t.groupId === toGroupId) acc.push(i);
    return acc;
  }, []);
  let insertAt: number;
  if (toIndex === undefined || toIndex >= groupPositions.length) {
    // 끝: 마지막 그룹 멤버 다음, 그룹 멤버가 없으면 배열 끝.
    insertAt = groupPositions.length > 0 ? groupPositions[groupPositions.length - 1] + 1 : TASKS.length;
  } else {
    const clamped = Math.max(0, toIndex);
    insertAt = groupPositions[clamped];
  }
  TASKS.splice(insertAt, 0, task);
  return task;
}

/** 신규 그룹 생성. order=해당 프로젝트 현재 최대+1, 기본색 "#9ca3af". */
export function createGroup(input: {
  projectId: string;
  name: string;
  color?: string;
}): TaskGroup {
  const siblings = GROUPS.filter((g) => g.projectId === input.projectId);
  const maxOrder = siblings.reduce((max, g) => Math.max(max, g.order), -1);
  const group: TaskGroup = {
    id: `grp-${crypto.randomUUID()}`,
    projectId: input.projectId,
    name: input.name,
    color: input.color ?? "#9ca3af",
    order: maxOrder + 1,
  };
  GROUPS.push(group);
  return group;
}

// ---------- 조회 계층 ----------

export interface ListViewMember {
  id: string;
  name: string;
  avatarColor: string;
}

export interface ListViewTask {
  id: string;
  name: string;
  description: string;
  /** "2025년 9월 8일 금요일" 형태로 서버에서 포맷. 없으면 null. */
  dueLabel: string | null;
  priority: PmPriority;
  assignees: ListViewMember[];
  done: boolean;
}

export interface ListViewGroup {
  id: string;
  name: string;
  color: string;
  count: number;
  tasks: ListViewTask[];
}

export interface ProjectListView {
  project: { id: string; name: string; description: string };
  /** 헤더 아바타 스택에 노출할 멤버(최대 3). */
  members: ListViewMember[];
  /** 헤더 아바타 스택의 "+N". */
  memberOverflow: number;
  groups: ListViewGroup[];
}

function resolveMember(id: string): ListViewMember {
  const user = findUser(id);
  return {
    id,
    name: user?.name ?? id,
    avatarColor: user?.avatarColor ?? "#9ca3af",
  };
}

function formatDue(dueAt: string | null): string | null {
  if (!dueAt) return null;
  return format(new Date(`${dueAt}T00:00:00`), "yyyy년 M월 d일 EEEE", { locale: ko });
}

export function getPrimaryWorkspace(): Workspace {
  return WORKSPACES[0];
}

export function getPrimaryProject(): PmProject {
  return PROJECTS[0];
}

/** 목록/보드 뷰 태스크 필터. priority는 포함(OR), assigneeIds는 교집합(하나라도 겹치면 통과). */
export interface TaskFilter {
  priority?: PmPriority[];
  assigneeIds?: string[];
}

/** 필터 통과 여부. 빈/미지정 조건은 통과로 취급한다. */
function matchesFilter(task: PmTask, filter?: TaskFilter): boolean {
  if (!filter) return true;
  if (filter.priority && filter.priority.length > 0 && !filter.priority.includes(task.priority)) {
    return false;
  }
  if (filter.assigneeIds && filter.assigneeIds.length > 0) {
    const overlap = task.assigneeIds.some((id) => filter.assigneeIds!.includes(id));
    if (!overlap) return false;
  }
  return true;
}

/** 태스크 생성/편집/필터 피커가 소비하는 프로젝트 메타. */
export interface ProjectMeta {
  members: ListViewMember[];
  groups: { id: string; name: string; color: string }[];
}

/** 프로젝트 담당자·그룹 피커용 메타. 태스크 생성/편집/필터 UI가 소비한다. */
export function getProjectMeta(projectId: string): ProjectMeta {
  const project = PROJECTS.find((p) => p.id === projectId) ?? PROJECTS[0];
  const groups = GROUPS.filter((g) => g.projectId === project.id)
    .sort((a, b) => a.order - b.order)
    .map((g) => ({ id: g.id, name: g.name, color: g.color }));
  return {
    members: project.memberIds.map(resolveMember),
    groups,
  };
}

/** 프로젝트 목록 뷰 모델. 서버 컴포넌트에서 호출해 클라이언트에 직렬화 전달한다. */
export function getProjectListView(projectId: string, filter?: TaskFilter): ProjectListView {
  const project = PROJECTS.find((p) => p.id === projectId) ?? PROJECTS[0];
  const groups = GROUPS.filter((g) => g.projectId === project.id).sort(
    (a, b) => a.order - b.order,
  );

  const listGroups: ListViewGroup[] = groups.map((group) => {
    const tasks = TASKS.filter((t) => t.groupId === group.id && matchesFilter(t, filter)).map<ListViewTask>((t) => ({
      id: t.id,
      name: t.name,
      description: t.description,
      dueLabel: formatDue(t.dueAt),
      priority: t.priority,
      assignees: t.assigneeIds.map(resolveMember),
      done: t.done,
    }));
    return { id: group.id, name: group.name, color: group.color, count: tasks.length, tasks };
  });

  const members = project.memberIds.map(resolveMember);

  return {
    project: { id: project.id, name: project.name, description: project.description },
    members: members.slice(0, 3),
    memberOverflow: Math.max(0, members.length - 3),
    groups: listGroups,
  };
}

// ---------- 보드(칸반) 뷰 ----------

export interface BoardViewTask {
  id: string;
  name: string;
  description: string;
  /** "2025년 9월 8일 금요일" 형태로 서버에서 포맷. 없으면 null. */
  dueLabel: string | null;
  priority: PmPriority;
  assignees: ListViewMember[];
  commentCount: number;
  attachmentCount: number;
}

export interface BoardViewGroup {
  id: string;
  name: string;
  color: string;
  count: number;
  tasks: BoardViewTask[];
}

export interface ProjectBoardView {
  groups: BoardViewGroup[];
}

/** 프로젝트 보드 뷰 모델 — 그룹=열, 태스크=카드. 리스트 뷰와 동일하게 서버에서 날짜 포맷. */
export function getProjectBoardView(projectId: string, filter?: TaskFilter): ProjectBoardView {
  const project = PROJECTS.find((p) => p.id === projectId) ?? PROJECTS[0];
  const groups = GROUPS.filter((g) => g.projectId === project.id).sort(
    (a, b) => a.order - b.order,
  );

  const boardGroups: BoardViewGroup[] = groups.map((group) => {
    const tasks = TASKS.filter((t) => t.groupId === group.id && matchesFilter(t, filter)).map<BoardViewTask>((t) => ({
      id: t.id,
      name: t.name,
      description: t.description,
      dueLabel: formatDue(t.dueAt),
      priority: t.priority,
      assignees: t.assigneeIds.map(resolveMember),
      commentCount: t.commentCount,
      attachmentCount: t.attachmentCount,
    }));
    return { id: group.id, name: group.name, color: group.color, count: tasks.length, tasks };
  });

  return { groups: boardGroups };
}

// ---------- 캘린더(월 그리드) 뷰 ----------

export interface CalendarViewTask {
  id: string;
  /** pill 제목. */
  name: string;
  /** pill 점·틴트 색(hex). 태스크 소속 그룹 색을 사용. */
  color: string;
}

export interface CalendarViewDay {
  /** yyyy-MM-dd. */
  date: string;
  /** 셀 날짜 숫자(1..31). */
  day: number;
  /** 표시 월에 속하는 날짜인지(다른 달은 흐리게). */
  inMonth: boolean;
  /** 오늘 여부(서버에서 계산해 직렬화). */
  isToday: boolean;
  tasks: CalendarViewTask[];
}

export interface ProjectCalendarView {
  /** 해석된 표시 월 "yyyy-MM". */
  month: string;
  /** 헤더 라벨 "2025년 9월". */
  monthLabel: string;
  /** 이전/다음 달 "yyyy-MM"(URL 이동용). */
  prevMonth: string;
  nextMonth: string;
  /** 6주 × 7일 = 42 셀(일요일 시작). */
  days: CalendarViewDay[];
}

/** "yyyy-MM" 형식 화이트리스트(01~12만 허용). */
const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;

/** seed 태스크 dueAt 중 가장 많은 달, 동수면 이른 달을 기본 앵커로. 태스크가 없으면 이번 달. */
function defaultAnchorMonth(): string {
  const counts = new Map<string, number>();
  for (const t of TASKS) {
    if (!t.dueAt) continue;
    const key = t.dueAt.slice(0, 7);
    counts.set(key, (counts.get(key) ?? 0) + 1);
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

/** URL 파라미터 방어: 유효한 "yyyy-MM"이면 그대로, 아니면 기본 앵커. */
function resolveAnchorMonth(raw: string | null | undefined): string {
  return raw && MONTH_RE.test(raw) ? raw : defaultAnchorMonth();
}

/** 프로젝트 캘린더(월) 뷰 모델 — 6주 그리드 각 날짜에 마감 태스크를 매핑. 읽기 전용(P3). */
export function getProjectCalendarView(
  projectId: string,
  anchorMonth: string | null | undefined,
): ProjectCalendarView {
  const project = PROJECTS.find((p) => p.id === projectId) ?? PROJECTS[0];
  const groupColor = new Map(
    GROUPS.filter((g) => g.projectId === project.id).map((g) => [g.id, g.color]),
  );
  const projectTasks = TASKS.filter((t) => groupColor.has(t.groupId));

  const month = resolveAnchorMonth(anchorMonth);
  const anchorDate = new Date(`${month}-01T00:00:00`);
  const gridStart = startOfWeek(startOfMonth(anchorDate), { weekStartsOn: 0 });
  const today = new Date();

  const days: CalendarViewDay[] = Array.from({ length: 42 }, (_, i) => {
    const d = addDays(gridStart, i);
    const key = format(d, "yyyy-MM-dd");
    const tasks = projectTasks
      .filter((t) => t.dueAt === key)
      .map<CalendarViewTask>((t) => ({
        id: t.id,
        name: t.name,
        color: groupColor.get(t.groupId) ?? "#9ca3af",
      }));
    return {
      date: key,
      day: d.getDate(),
      inMonth: isSameMonth(d, anchorDate),
      isToday: isSameDay(d, today),
      tasks,
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

// ---------- 태스크 상세 드로어 뷰 ----------

export interface TaskDetailView {
  id: string;
  name: string;
  description: string;
  /** 소속 그룹명(상태 뱃지 텍스트). */
  groupName: string;
  /** 소속 그룹 색(hex, 상태 뱃지 색). */
  groupColor: string;
  /** 분류. 없으면 null. */
  category: string | null;
  priority: PmPriority;
  /** "2025년 9월 12일 금요일" 형태. 없으면 null. */
  dueLabel: string | null;
  /** "09:00 - 11:30 AM". 없으면 null. */
  timeRange: string | null;
  assignees: ListViewMember[];
  attachments: PmAttachment[];
  /** 편집 피커용 원시 마감일(yyyy-MM-dd). 없으면 null. */
  dueAt: string | null;
  /** 편집 피커용 소속 그룹 id. */
  groupId: string;
  /** 편집 피커용 담당자 id 목록. */
  assigneeIds: string[];
}

/** 태스크 상세 뷰 모델 — 드로어(우측 슬라이드)용. id가 없으면 null. */
export function getTaskDetail(taskId: string | null | undefined): TaskDetailView | null {
  if (!taskId) return null;
  const task = TASKS.find((t) => t.id === taskId);
  if (!task) return null;
  const group = GROUPS.find((g) => g.id === task.groupId);
  return {
    id: task.id,
    name: task.name,
    description: task.description,
    groupName: group?.name ?? "",
    groupColor: group?.color ?? "#9ca3af",
    category: task.category ?? null,
    priority: task.priority,
    dueLabel: formatDue(task.dueAt),
    timeRange: task.timeRange ?? null,
    assignees: task.assigneeIds.map(resolveMember),
    attachments: task.attachments ?? [],
    dueAt: task.dueAt,
    groupId: task.groupId,
    assigneeIds: task.assigneeIds,
  };
}
