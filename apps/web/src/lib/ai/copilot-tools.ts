import "server-only";

import { personScopeForGrade, type User } from "@que/core";
import type { GeminiFunctionDeclaration } from "@/lib/ai/gemini";
import { getDb } from "@/lib/db";
import { getTodayData } from "@/lib/today-data";
import { getDailyData } from "@/lib/daily-data";
import { getTeamData } from "@/lib/team-data";
import { getOkrData } from "@/lib/okr-data";
import { searchWorkspace } from "@/lib/search-data";
import { computeHomeLoad } from "@/lib/home-load";
import {
  getActiveProjects,
  getProjectBoard,
  getProjectMeta,
  getProjectMilestones,
} from "@/lib/projects-data";

// Que Copilot 읽기 도구 레이어 (기획 모듈 D — C-1 조회·정리).
// 각 도구는 기존 데이터 계층을 재사용한다 → 권한 스코프(role·회의록 열람·PII 마스킹)를
// 데이터 계층이 이미 강제하고, 여기서 권한을 새로 뚫지 않는다("권한은 말하는 사람의 권한").
// 결과는 반드시 sourcePath(딥링크)를 포함한다(환각 방어 + 출처 첨부). server-only.

/** 답변에 붙는 출처 딥링크. */
export interface CopilotSource {
  label: string;
  href: string;
}

/** 도구 실행 결과 — data(모델에 되먹일 JSON)와 sources(출처 딥링크). */
export interface ToolResult {
  data: unknown;
  sources: CopilotSource[];
}

/**
 * 읽기 도구 함수 선언(Gemini function calling). 쓰기(propose_*)는 copilot.ts가 별도로 붙인다.
 * 도구는 조회 전용이라 인자를 최소화한다(과설계 금지).
 */
export const COPILOT_READ_TOOL_DECLARATIONS: GeminiFunctionDeclaration[] = [
  {
    name: "get_my_today",
    description:
      "지금 로그인한 사용자의 오늘 업무 상황: 내 오늘 작업 목록·마감 임박·막힌(문제/홀드) 작업·미응답 체크인·나에게 온 도움 요청·일정 충돌 수·오늘 체크인(스탠드업) 제출 여부.",
    parameters: { type: "object", properties: {} },
  },
  {
    name: "get_team_blockers",
    description:
      "팀 전체에서 지금 주의가 필요한 항목: 문제발생·홀드 작업, 도움 요청, 응답 대기 체크인. 누가 어디서 막혔는지 요약할 때 쓴다.",
    parameters: { type: "object", properties: {} },
  },
  {
    name: "get_project_status",
    description:
      "특정 프로젝트의 진행 상황: 상태별 작업 수·완료율·다가오는 마일스톤·위험. 프로젝트 이름 일부로 조회(퍼지 매칭). 못 찾으면 후보 목록을 돌려준다.",
    parameters: {
      type: "object",
      properties: {
        query: { type: "string", description: "프로젝트 이름 또는 그 일부(예: '에픽게임즈', '리브랜딩')." },
      },
      required: ["query"],
    },
  },
  {
    name: "get_milestones",
    description: "다가오는 마일스톤과 위험 상태. 기한 순으로 정렬.",
    parameters: {
      type: "object",
      properties: {
        range: {
          type: "string",
          enum: ["week", "month", "all"],
          description: "조회 범위. week=이번 주, month=이번 달(기본), all=전체 예정.",
        },
      },
    },
  },
  {
    name: "get_okr_progress",
    description: "이번 분기 Objective와 Key Result 진척률(회사 OKR). 목표 진행 상황을 물을 때 쓴다.",
    parameters: { type: "object", properties: {} },
  },
  {
    name: "get_workload",
    description:
      "팀 업무 부하 표(볼 수 있는 범위): 사람별 예상 소요/가용 비율·열린 작업 수·마감 임박·홀드 수, 과부하/주의 요약. 개인 평가가 아니라 배분 조정용.",
    parameters: { type: "object", properties: {} },
  },
  {
    name: "list_clients",
    description:
      "활성 클라이언트(거래처) 목록 {id, name}. 프로젝트를 만들거나 클라이언트를 지정할 때 id를 얻는 용도.",
    parameters: { type: "object", properties: {} },
  },
  {
    name: "search_items",
    description:
      "워크스페이스 전역 검색(작업·회의록·Action·결제·팀원). 특정 이름/키워드로 항목을 찾을 때 쓴다. 열람 권한과 민감정보 마스킹은 이미 적용된다.",
    parameters: {
      type: "object",
      properties: { query: { type: "string", description: "검색어." } },
      required: ["query"],
    },
  },
];

/** 읽기 도구 이름 집합(copilot.ts에서 propose_*와 구분). */
export const COPILOT_READ_TOOL_NAMES = new Set(
  COPILOT_READ_TOOL_DECLARATIONS.map((d) => d.name),
);

// ---- 실행기 ----

type Args = Record<string, unknown>;
const str = (v: unknown): string | undefined => (typeof v === "string" ? v : undefined);

/**
 * 읽기 도구 1개 실행. name이 읽기 도구가 아니면 예외.
 * user는 호출자 — 데이터 계층에 그대로 넘겨 권한 스코프를 위임한다(권한 상승 없음).
 */
export async function runCopilotReadTool(
  name: string,
  args: Args,
  user: User,
  now: Date = new Date(),
): Promise<ToolResult> {
  switch (name) {
    case "get_my_today":
      return getMyToday(user, now);
    case "get_team_blockers":
      return getTeamBlockers(user, now);
    case "get_project_status":
      return getProjectStatus(user, str(args.query) ?? "");
    case "get_milestones":
      return getMilestones(user, str(args.range) as "week" | "month" | "all" | undefined, now);
    case "get_okr_progress":
      return getOkrProgress(user);
    case "get_workload":
      return getWorkload(user, now);
    case "list_clients":
      return listClients();
    case "search_items":
      return searchItems(user, str(args.query) ?? "");
    default:
      throw new Error(`알 수 없는 도구: ${name}`);
  }
}

async function getMyToday(user: User, now: Date): Promise<ToolResult> {
  const [today, daily] = await Promise.all([getTodayData(user, now), getDailyData(user, now)]);
  return {
    data: {
      date: daily.date,
      checkInSubmitted: Boolean(daily.myEntry),
      myTasksCount: today.myTasks.length,
      myTasks: today.myTasks.slice(0, 15).map((t) => ({
        id: t.id,
        title: t.title,
        status: t.status,
        endAt: t.endAt ?? null,
        priority: t.priority,
      })),
      dueSoon: today.dueSoon.slice(0, 10).map((t) => ({ id: t.id, title: t.title, endAt: t.endAt ?? null })),
      blockers: today.attention.slice(0, 15).map((a) => ({
        taskId: a.task.id,
        title: a.task.title,
        status: a.task.status,
        reason: a.reason ?? null,
        help: a.helpUserNames ?? [],
        nextCheckAt: a.nextCheckAt ?? null,
      })),
      pendingCheckInCount: today.pendingCheckIns.length,
      helpRequests: today.helpRequests.slice(0, 10).map((c) => ({
        taskTitle: c.taskTitle,
        from: c.authorName,
        body: c.body,
      })),
      conflictCount: today.conflictCount,
    },
    sources: [{ label: "오늘 할 일", href: "/today" }],
  };
}

async function getTeamBlockers(user: User, now: Date): Promise<ToolResult> {
  const team = await getTeamData(user, now);
  return {
    data: {
      summary: team.summary,
      attention: team.attention.slice(0, 30).map((a) => ({
        type: a.type,
        taskId: a.taskId,
        title: a.title,
        assignee: a.assigneeName,
        detail: a.detail ?? null,
        help: a.helpUserNames ?? [],
        nextCheckAt: a.nextCheckAt ?? null,
      })),
    },
    sources: [{ label: "팀 현황", href: "/team" }],
  };
}

/** 이름 일부 → 프로젝트 매칭. 정확 포함 우선, 없으면 부분 일치 첫 항목. */
function fuzzyMatchProject<T extends { name: string; clientName: string | null }>(
  projects: T[],
  query: string,
): T | undefined {
  const q = query.trim().toLowerCase();
  if (!q) return undefined;
  const hay = (p: T) => `${p.name} ${p.clientName ?? ""}`.toLowerCase();
  return (
    projects.find((p) => p.name.toLowerCase() === q) ??
    projects.find((p) => hay(p).includes(q)) ??
    projects.find((p) => q.split(/\s+/).some((tok) => tok.length >= 2 && hay(p).includes(tok)))
  );
}

async function getProjectStatus(user: User, query: string): Promise<ToolResult> {
  const projects = await getActiveProjects();
  const matched = fuzzyMatchProject(projects, query);
  if (!matched) {
    return {
      data: {
        found: false,
        note: "이름이 일치하는 프로젝트를 찾지 못했습니다. 아래 후보 중에서 고르거나 사용자에게 물어보세요.",
        // id를 함께 줘야 모델이 propose_* 에 projectId를 채울 수 있다(2026-07-12 — 프로젝트 미질문 회귀).
        candidates: projects.slice(0, 10).map((p) => ({ id: p.id, name: p.name })),
      },
      sources: [{ label: "프로젝트", href: "/projects" }],
    };
  }
  const [meta, board, milestones] = await Promise.all([
    getProjectMeta(matched.id),
    getProjectBoard(user, [matched.id]),
    getProjectMilestones(user, [matched.id]),
  ]);
  const totalTasks = board.columns.reduce((s, c) => s + c.count, 0);
  const doneTasks = board.columns.find((c) => c.key === "done")?.count ?? 0;
  return {
    data: {
      found: true,
      id: matched.id,
      name: matched.name,
      client: matched.clientName,
      description: meta?.description ?? null,
      columns: board.columns.map((c) => ({ label: c.label, count: c.count })),
      totalTasks,
      doneTasks,
      progressPct: totalTasks > 0 ? Math.round((doneTasks / totalTasks) * 100) : 0,
      milestones: milestones.slice(0, 10).map((m) => ({
        title: m.title,
        dueAt: m.dueAt,
        riskStatus: m.riskStatus,
      })),
    },
    sources: [{ label: `프로젝트 · ${matched.name}`, href: `/projects?project=${matched.id}` }],
  };
}

async function getMilestones(
  user: User,
  range: "week" | "month" | "all" | undefined,
  now: Date,
): Promise<ToolResult> {
  const projects = await getActiveProjects();
  const all = await getProjectMilestones(
    user,
    projects.map((p) => p.id),
  );
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  const spanDays = range === "week" ? 7 : range === "all" ? 3650 : 31;
  const end = new Date(start.getTime() + spanDays * 864e5);
  const upcoming = all
    .filter((m) => {
      const due = new Date(m.dueAt);
      return due >= start && (range === "all" ? true : due <= end);
    })
    .sort((a, b) => a.dueAt.localeCompare(b.dueAt))
    .slice(0, 30);
  return {
    data: {
      range: range ?? "month",
      count: upcoming.length,
      milestones: upcoming.map((m) => ({
        title: m.title,
        project: m.projectName,
        dueAt: m.dueAt,
        riskStatus: m.riskStatus,
      })),
    },
    sources: [{ label: "반복·마일스톤", href: "/planning?tab=milestones" }],
  };
}

async function getOkrProgress(user: User): Promise<ToolResult> {
  const okr = await getOkrData(user);
  return {
    data: {
      period: okr.period,
      objectives: okr.objectives.map((o) => ({
        title: o.objective.title,
        owner: o.ownerName,
        keyResults: o.keyResults.map((kr) => ({
          title: kr.keyResult.title,
          owner: kr.ownerName,
          progressPct: kr.progress,
        })),
      })),
    },
    sources: [{ label: "OKR", href: "/daily?tab=okr" }],
  };
}

async function getWorkload(user: User, now: Date): Promise<ToolResult> {
  const db = await getDb();
  // 부하 스코프는 뷰어 등급에서만 유도한다(관리=대표 제외/사원=본인) — URL로 확대 불가.
  const scope = personScopeForGrade(user, db.users);
  const load = computeHomeLoad(db, scope, now);
  return {
    data: {
      summary: load.summary,
      rows: load.rows.map((r) => ({
        name: r.name,
        estimatedHours: r.estimatedHours,
        capacityHours: r.capacityHours,
        ratioPct: r.ratio,
        openTasks: r.openTasks,
        dueSoonCount: r.dueSoonCount,
        holdCount: r.holdCount,
        impactProjects: r.impactProjects,
      })),
    },
    sources: [{ label: "업무 부하", href: "/home" }],
  };
}

async function searchItems(user: User, query: string): Promise<ToolResult> {
  const groups = await searchWorkspace(query, user);
  return {
    data: {
      query,
      groups: groups.map((g) => ({
        label: g.label,
        total: g.total,
        hits: g.hits.map((h) => ({ title: h.title, subtitle: h.subtitle, href: h.href })),
      })),
    },
    // 상위 매치를 출처 딥링크로 노출(그룹별 최대 2개, 총 6개까지).
    sources: groups
      .flatMap((g) => g.hits.slice(0, 2))
      .slice(0, 6)
      .map((h) => ({ label: h.title, href: h.href })),
  };
}

/** 활성 클라이언트 목록 — 프로젝트 생성 제안 시 clientId 해석용(2026-07-12). */
async function listClients(): Promise<ToolResult> {
  const db = await getDb();
  return {
    data: {
      clients: db.clients
        .filter((c) => c.status !== "archived")
        .map((c) => ({ id: c.id, name: c.name })),
    },
    sources: [{ label: "클라이언트", href: "/clients" }],
  };
}
