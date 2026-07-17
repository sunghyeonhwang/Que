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
import { getPaymentData } from "@/lib/payment-data";
import { getDecisionLog } from "@/lib/meeting-decisions";
import { getWeeklyRetroData } from "@/lib/weekly-retro-data";
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
    name: "get_payments",
    description:
      "결제 요청 현황. '미결제/입금 대기/결제 현황/누가 결제를 올렸나/이번 달 결제' 같은 질문에 쓴다. 상태로 필터한다. 계좌번호는 제공하지 않고, 금액은 권한에 따라 마스킹된 표시값(비공개면 없음)만 제공된다.",
    parameters: {
      type: "object",
      properties: {
        status: {
          type: "string",
          enum: ["waiting", "done", "cancelled", "all"],
          description: "조회 상태. waiting=대기(기본), done=완료, cancelled=취소, all=전체.",
        },
      },
    },
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
  {
    name: "get_decisions",
    description:
      "회의에서 결정된 사항(결정 로그). '지난 회의에서 뭘 정했나·~하기로 한 것·무슨 결정이 났나' 같은 질문에 쓴다. AI가 회의록 원문에서 뽑은 파생물이라 정확한 문구는 원문 대조가 필요하다(답변에 이 점을 덧붙여라). 비공개 회의록 결정은 열람 권한이 있는 것만 나온다.",
    parameters: {
      type: "object",
      properties: {
        projectId: {
          type: "string",
          description: "특정 프로젝트의 결정만 볼 때 그 프로젝트 ID(모르면 생략 — 전체 회의 결정).",
        },
        limit: {
          type: "number",
          description: "최대 개수(기본 10, 최대 30). 최신순으로 반환.",
        },
      },
    },
  },
  {
    name: "get_weekly_retro",
    description:
      "한 주(월~금) 스탠드업 회고: 일자별 제출 현황·사람별 포커스와 완료 작업 수·그 주 막힘 목록. '지난주 어땠나·이번 주 회고·누가 뭐에 집중했나·막힌 게 뭐였나' 같은 질문에 쓴다.",
    parameters: {
      type: "object",
      properties: {
        week: {
          type: "string",
          description: "조회할 주의 월요일(YYYY-MM-DD). 생략하면 이번 주. '지난주'면 지난 월요일 날짜를 넣는다.",
        },
      },
    },
  },
  {
    name: "get_today_load",
    description:
      "지금 로그인한 사용자 '본인'의 오늘 업무 부하: 오늘 할 일 개수·예상 소요시간 합계·예상시간 입력 현황. '오늘 얼마나 바쁜가·부하가 어떤가·오늘 일이 많은가' 같은 질문에 쓴다. **본인만 조회 가능** — 다른 사람의 부하는 이 도구로 볼 수 없다(팀 전체 부하는 get_workload, 특정인 상황은 get_team_blockers/search_items로 안내).",
    parameters: { type: "object", properties: {} },
  },
];

/** 읽기 도구 이름 집합(copilot.ts에서 propose_*와 구분). */
export const COPILOT_READ_TOOL_NAMES = new Set(
  COPILOT_READ_TOOL_DECLARATIONS.map((d) => d.name),
);

// ---- 실행기 ----

type Args = Record<string, unknown>;
const str = (v: unknown): string | undefined => (typeof v === "string" ? v : undefined);
const num = (v: unknown): number | undefined =>
  typeof v === "number" && Number.isFinite(v) ? v : undefined;

const KST_OFFSET_MS = 9 * 60 * 60 * 1000;
const DOW_KO = ["일", "월", "화", "수", "목", "금", "토"];

/**
 * ISO datetime → KST 사람 표기("7월 21일(화) 17:00", 시각이 00:00이면 날짜만).
 * 도구 데이터에 ISO(propose용)와 **함께** 실어, 답변 본문이 ISO 원문 대신 이 표기를 쓰게 한다.
 * 파싱 실패 시 원본 문자열을 그대로 돌려준다(방어).
 */
export function humanizeKst(iso: string): string {
  const ms = Date.parse(iso);
  if (Number.isNaN(ms)) return iso;
  const d = new Date(ms + KST_OFFSET_MS);
  const base = `${d.getUTCMonth() + 1}월 ${d.getUTCDate()}일(${DOW_KO[d.getUTCDay()]})`;
  const h = d.getUTCHours();
  const m = d.getUTCMinutes();
  if (h === 0 && m === 0) return base; // 시각 없음 → 날짜만
  const p = (n: number) => String(n).padStart(2, "0");
  return `${base} ${p(h)}:${p(m)}`;
}

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
    case "get_payments":
      return getPayments(
        user,
        str(args.status) as "waiting" | "done" | "cancelled" | "all" | undefined,
        now,
      );
    case "search_items":
      return searchItems(user, str(args.query) ?? "");
    case "get_decisions":
      return getDecisions(user, str(args.projectId), num(args.limit));
    case "get_weekly_retro":
      return getWeeklyRetro(user, str(args.week), now);
    case "get_today_load":
      return getTodayLoad(user, now);
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
        note: "이름이 일치하는 프로젝트를 찾지 못했습니다. 사용자가 말한 이름이 아래 후보에 없으면 propose_create_project로 새 프로젝트 생성을 제안하세요(누구나 만들 수 있음). 후보 중 하나를 의도한 것 같으면 그것으로 진행하거나 사용자에게 확인하세요.",
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
        dueAtHuman: humanizeKst(m.dueAt),
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
        dueAtHuman: humanizeKst(m.dueAt),
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
      // 빈 결과는 "찾지 못했습니다"로 끝나면 막다른 답이 된다(2026-07-12 실사용 리포트) —
      // 모델이 다음 행동(어디서 만드는지)을 안내하도록 힌트를 데이터에 싣는다.
      ...(okr.objectives.length === 0 && {
        hint: "아직 등록된 OKR이 없다. '데일리' 메뉴의 OKR 탭(/daily?tab=okr)에서 관리자가 분기 목표(Objective)를 만들고, 그 아래에 월 핵심결과(KR)를 추가하면 여기서 진척률을 조회할 수 있다 — 이 안내를 사용자에게 전하라.",
      }),
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

/**
 * 결제 요청 현황(상태 필터, 기본 waiting). 결제 데이터 계층(getPaymentData)을 재사용해
 * 권한별 마스킹을 그대로 위임한다 — **계좌번호는 모델에 싣지 않고, 금액은 마스킹된 표시값만**(비공개면 null).
 */
async function getPayments(
  user: User,
  status: "waiting" | "done" | "cancelled" | "all" | undefined,
  now: Date,
): Promise<ToolResult> {
  const filter = status ?? "waiting";
  const data = await getPaymentData(user, now);
  const rows = filter === "all" ? data.rows : data.rows.filter((r) => r.status === filter);
  return {
    data: {
      status: filter,
      count: rows.length,
      summary: data.summary,
      payments: rows.slice(0, 30).map((r) => ({
        title: r.title,
        category: r.category,
        // 금액은 권한 마스킹된 표시값(비공개면 null). 계좌번호(원본·마스킹)는 일절 싣지 않는다.
        amount: r.amountDisplay,
        requester: r.requesterName,
        recipient: r.recipientName ?? null,
        dueAt: r.dueAt ?? null,
        dueAtHuman: r.dueAt ? humanizeKst(r.dueAt) : null,
        status: r.status,
        overdue: r.overdue,
      })),
    },
    sources: [{ label: "결제요청", href: "/payments" }],
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

/**
 * 회의 결정 로그(최신순). getDecisionLog를 그대로 재사용해 **뷰어의 회의록 열람 권한**(canViewMeetingNote)을
 * 위임한다 — 비공개(admin/restricted) 회의록 결정은 권한 없는 뷰어에게 새지 않는다(우회 경로 없음).
 * mock/dev(SUPABASE 키 없음)에서는 게이트로 항상 빈 배열 → "이 환경엔 결정 데이터 없음"으로 정직하게 응답.
 * 회의 일시는 *Human을 병기해 답변 본문이 ISO 원문 대신 사람 표기를 쓰게 한다.
 */
async function getDecisions(
  user: User,
  projectId: string | undefined,
  limit: number | undefined,
): Promise<ToolResult> {
  // limit 기본 10·최대 30(도구 계약). 음수·0 방어.
  const capped = Math.max(1, Math.min(limit ?? 10, 30));
  const entries = await getDecisionLog(user, { projectId, limit: capped });
  return {
    data: {
      count: entries.length,
      // AI 추출 파생물임을 모델에 명시 — 답변에 "원문 대조 권고"를 붙이도록 유도한다.
      note: "결정 로그는 AI가 회의록 원문에서 추출한 것이라 정확한 문구는 원문 대조가 필요하다. 답변에 이 점을 짧게 덧붙여라.",
      ...(entries.length === 0 && {
        hint: "열람 가능한 회의 결정 데이터가 없다(이 환경에 결정 로그가 없거나, 해당 프로젝트/권한 범위에 결정이 없음). 없는 결정을 지어내지 말고 그대로 전하라.",
      }),
      decisions: entries.map((e) => ({
        content: e.content,
        noteTitle: e.noteTitle,
        project: e.projectName ?? null,
        meetingAt: e.noteDate,
        meetingAtHuman: humanizeKst(e.noteDate),
        aiExtracted: e.aiExtracted,
      })),
    },
    sources: [{ label: "회의록 · 결정", href: "/meeting-notes?tab=decisions" }],
  };
}

/**
 * 주간 회고(월~금). getWeeklyRetroData를 재사용한다 — 전사 리듬이라 마스킹 대상이 없고(막힘은 본인 서술),
 * 뷰어는 본인 하이라이트(isMe)용으로만 쓰인다(권한 상승 없음). 막힘 해소는 단정하지 않고
 * "이후 언급 없음"(unmentionedSince) 라벨을 그대로 실어 보낸다.
 */
async function getWeeklyRetro(
  user: User,
  week: string | undefined,
  now: Date,
): Promise<ToolResult> {
  const retro = await getWeeklyRetroData(user, week, now);
  return {
    data: {
      weekLabel: retro.weekLabel,
      weekStart: retro.weekStart,
      weekEnd: retro.weekEnd,
      // 일자별 제출 현황(N/전체).
      days: retro.days.map((d) => ({
        label: d.label,
        date: d.date,
        submitted: d.submitted,
        total: d.total,
      })),
      // 사람별 포커스·완료 수(제출 없는 사람은 focuses 빈 배열).
      people: retro.people.map((p) => ({
        name: p.userName,
        isMe: p.isMe,
        submittedDays: p.submittedDays,
        doneCount: p.doneCount,
        focuses: p.focuses.map((f) => f.focus),
      })),
      blockers: retro.blockers.map((b) => ({
        who: b.userName,
        text: b.text,
        lastMentioned: b.lastMentionedDate,
        // 해소 단정 금지 — "이후 언급 없음" 라벨을 모델에 그대로 넘긴다.
        note: b.unmentionedSince ? "이후 언급 없음(해소 여부 불명)" : "그 주 마지막까지 언급됨",
      })),
    },
    sources: [{ label: "주간 회고", href: `/daily?tab=retro&week=${retro.weekStart}` }],
  };
}

/**
 * **본인** 오늘 부하만 요약(getTodayData의 plannedHours + 오늘 작업 수). 타인 부하 조회는 지원하지 않는다 —
 * 개인 평가 오용을 막기 위한 의도적 제약(파라미터를 받지 않아 URL로도 확대 불가). 팀 부하는 get_workload로.
 */
async function getTodayLoad(user: User, now: Date): Promise<ToolResult> {
  const today = await getTodayData(user, now);
  const p = today.plannedHours;
  return {
    data: {
      scope: "본인만(타인 부하는 이 도구로 조회 불가 — 팀 부하는 get_workload)",
      todayTaskCount: today.myTasks.length,
      plannedHoursTotal: p.total,
      tasksWithEstimate: p.withEstimate,
      // 예상시간 입력이 부분적이면 합계가 실제보다 적을 수 있음을 모델에 알린다(과소 계상 방어).
      estimateCoverageNote:
        p.taskCount > 0 && p.withEstimate < p.taskCount
          ? `오늘 하루 작업 ${p.taskCount}건 중 ${p.withEstimate}건만 예상 시간이 입력돼 합계가 실제보다 적을 수 있다.`
          : null,
      dueSoonCount: today.dueSoon.length,
      blockedCount: today.attention.length,
      conflictCount: today.conflictCount,
    },
    sources: [{ label: "오늘 할 일", href: "/today" }],
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
