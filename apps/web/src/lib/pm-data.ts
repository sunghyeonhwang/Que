import { format } from "date-fns";
import { ko } from "date-fns/locale";
import { findUser } from "@que/core";

// 프로젝트(Projects) 화면용 신규 mock 모델. (P1: mock 우선, DB 연동 없음)
// 담당자 아바타는 core의 USERS(avatarColor)를 재사용한다.

export type PmPriority = "high" | "normal" | "low";

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

const GROUPS: TaskGroup[] = [
  { id: "grp-backlog", projectId: "proj-mendix", name: "백로그", color: "#9ca3af", order: 0 },
  { id: "grp-todo", projectId: "proj-mendix", name: "할 일", color: "#3388ff", order: 1 },
  { id: "grp-doing", projectId: "proj-mendix", name: "진행 중", color: "#f59e0b", order: 2 },
  { id: "grp-done", projectId: "proj-mendix", name: "완료", color: "#22c55e", order: 3 },
];

const TASKS: PmTask[] = [
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
    attachmentCount: 0,
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
  },
  // 진행 중
  {
    id: "task-6",
    groupId: "grp-doing",
    name: "정보 아키텍처 매핑",
    description: "핵심 페이지와 작업 계층 구조를 구성하여 탐색과 사용자 여정을 단순화하세요.",
    dueAt: "2025-09-08",
    priority: "normal",
    assigneeIds: ["hwang-sunghyeon", "oh-seunghoon"],
    done: false,
    commentCount: 5,
    attachmentCount: 2,
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
  },
];

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

/** 프로젝트 목록 뷰 모델. 서버 컴포넌트에서 호출해 클라이언트에 직렬화 전달한다. */
export function getProjectListView(projectId: string): ProjectListView {
  const project = PROJECTS.find((p) => p.id === projectId) ?? PROJECTS[0];
  const groups = GROUPS.filter((g) => g.projectId === project.id).sort(
    (a, b) => a.order - b.order,
  );

  const listGroups: ListViewGroup[] = groups.map((group) => {
    const tasks = TASKS.filter((t) => t.groupId === group.id).map<ListViewTask>((t) => ({
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
export function getProjectBoardView(projectId: string): ProjectBoardView {
  const project = PROJECTS.find((p) => p.id === projectId) ?? PROJECTS[0];
  const groups = GROUPS.filter((g) => g.projectId === project.id).sort(
    (a, b) => a.order - b.order,
  );

  const boardGroups: BoardViewGroup[] = groups.map((group) => {
    const tasks = TASKS.filter((t) => t.groupId === group.id).map<BoardViewTask>((t) => ({
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
