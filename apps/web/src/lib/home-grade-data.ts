import { format } from "date-fns";
import { ko } from "date-fns/locale";
import {
  formatProjectLabel,
  gradeForUser,
  personScopeForGrade,
  type Task,
  type User,
} from "@que/core";
import { getDb } from "./db";
import { computeAwayChip, type HomeAwayChip, type HomeAwayEntry } from "./away";
import type { ListViewMember } from "./pm-types";
import {
  getHomeData,
  type HomeData,
  type HomeScheduleItem,
  type HomeTodoItem,
} from "./home-data";
import {
  getPerformanceData,
  type MonthlyCompletion,
  type PerfKpi,
  type ProjectProgressRow,
} from "./performance-data";
import { getHeatmapData, type HeatmapData } from "./heatmap-data";
import { computeHomeLoad, OPEN, OVERLOAD_HOURS, type HomeLoad } from "./home-load";
import {
  getStandupData,
  getTeamData,
  type AttentionEntry,
  type ConflictEntry,
  type TeamData,
} from "./team-data";
import { getAdminReportData, type AdminReportData, type ReportBlocker } from "./report-data";
import { getPlanningData, type MilestoneRow } from "./planning-data";
import { getClientOverview, type ClientOverviewRow } from "./client-overview";
import {
  getTeamPriorityItems,
  getViewerAlerts,
  type AlertsData,
  type TeamPriorityData,
} from "./alerts-data";
import { isAwaitingAnswer } from "./notifications/checkin-prompt";
import { getNoteSummary, type NoteSummary } from "./notes-summary";
import { computeWorkflowTrend, type WorkflowTrend, type WorkflowWeek } from "./workflow-trend";

export type { WorkflowTrend, WorkflowWeek };

// 직급별(대표/관리자/사원) 홈 데이터 조립 계층. 기존 조회 계층(getHomeData·performance·team·
// report·planning·alerts·notes)을 재사용해 grade별 번들을 만든다. 프론트는 grade로 3분기 렌더한다.
//
// 권한 방어: grade는 세션 사용자(user.id)에서만 판정하고(gradeForUser), 관리자/대표 전용 데이터는
// getAdminReportData(role==="admin" 게이트)·getPerformanceData(viewer 재유도)를 통과해야만
// 채워진다. 사원이 URL로 관리자 홈을 요청해도 dispatch가 staff로 떨어지고, 설령 관리자 함수를
// 직접 불러도 report-data 게이트가 빈 골격을 돌려준다(3중 방어).

export interface GradeHomeOptions {
  /** 히트맵 기준 월(1-12). 기본=현재월. */
  hm?: number;
  /** 작업 분포 창(getHomeData). 기본 "week". */
  dp?: "week" | "month";
  /** 클라이언트 필터. */
  clientId?: string;
  /** 업무 흐름(WorkflowTrend) 창 — 최근 몇 주. 4|8|12. 기본 8. */
  wf?: 4 | 8 | 12;
}

// ── 홈 공통 파생 타입(홈 명세 §1 네이밍 계약) ─────────────────────────────────
// 화면(Home/*)이 이 타입들을 소비한다. 기존 필드(kpis·heatmap·loadByMember 등)는 화면 교체
// 전까지 유지하고, 아래 신규 필드로 §3~§5 섹션 계약을 채운다.

/** Home/KPICard 한 칸. 숫자만 두지 않고 관련 필터 화면으로 연결(href). */
export interface HomeKpi {
  key: string;
  label: string;
  value: number;
  /** 클릭 시 이동할 상세/필터 화면. 없으면 비링크. */
  href?: string;
  /** 강조 tone. danger=위험(문제·기한초과), warning=주의, success=완료, info/기본. */
  tone?: "default" | "info" | "warning" | "danger" | "success";
}

// 오늘 부재 칩 타입·조립은 away.ts로 이관(홈·데일리 공유). 기존 import 경로 호환을 위해 재노출한다.
export type { HomeAwayEntry, HomeAwayChip };

/** 사원 오늘 요약(규칙 기반, AI 폴백 겸 기본). */
export interface StaffTodaySummary {
  todoCount: number;
  /** 24시간 내 마감 임박(본인). */
  dueSoonCount: number;
  /** 응답할 자동 체크인 수. */
  checkInCount: number;
  /** 어제 못 끝나 이월된 작업 수(getStandupData 재사용). */
  carryoverCount: number;
  /** "오늘 할 일 3건, 어제 못 끝낸 2건이 이월됐습니다" 같은 규칙 기반 문장. */
  lines: string[];
}

/** 사원 '작업 상태 확인'(Home/CheckIn) 리스트 행. */
export interface HomeCheckInItem {
  checkInId: string;
  taskId: string;
  taskTitle: string;
  projectLabel: string | null;
  question: string;
}

/** 관리자 오늘 요약(팀관리 AI 브리핑 폴백 겸 기본). */
export interface ManagerTodaySummary {
  /** 문제·홀드(막힘). */
  issueCount: number;
  /** 일정 충돌. */
  conflictCount: number;
  /** 과부하 인원(예상 시간 임계 초과). */
  overloadCount: number;
  /** 상태 응답 대기(자동 체크인). */
  awaitingCount: number;
  lines: string[];
}

/** 대표 오늘 요약(경영 AI 브리핑 폴백 겸 기본). */
export interface CeoTodaySummary {
  /** 위험/지연 프로젝트. */
  riskProjectCount: number;
  /** 기한초과 열린 작업(전사). */
  overdueCount: number;
  /** 과부하 인원. */
  overloadCount: number;
  /** 결정·확인 대기(확인 필요 Action + 결제 대기). */
  decisionCount: number;
  lines: string[];
}

/** Home/ProjectOverview 한 행(위험도 높은 활성 프로젝트). */
export interface HomeProjectRow {
  projectId: string;
  name: string;
  /** 진행률 = done/전체(merged·cancelled 제외), 0~100. */
  progress: number;
  /** 임박 마일스톤 또는 임박 작업 마감 "M월 d일". 없으면 null. */
  dueLabel: string | null;
  /** 기한초과 열린 작업 수. */
  overdueTasks: number;
  /** 문제·홀드로 막힌 작업 수. */
  blockedTasks: number;
  /** 열린(집계 대상, done 제외) 작업 수. */
  openTasks: number;
  /** 지연/주의/정상. */
  status: "delayed" | "at_risk" | "on_track";
}

/** Home/Pending 요약(보조 대기 신호). */
export interface HomePending {
  /** 대기(waiting) 결제 수. */
  pendingPayments: number;
  /** 마감 초과 결제 수. */
  overduePayments: number;
  /** 대기 결제 중 최장 대기 일수(생성 이후 경과일). 없으면 0. */
  paymentOldestWaitDays: number;
  /** 확인 필요 Action 수. */
  needsReviewActions: number;
  /** 확인 필요 Action의 출처 회의록 수(distinct meetingNoteId). */
  actionSourceNoteCount: number;
  /** 7일 이상 응답 없는 자동 체크인 수(장기 상태 응답 대기). */
  longAwaitingCheckins: number;
  /** 장기 응답 대기 중 최장 대기 일수. 없으면 0. */
  checkinOldestWaitDays: number;
}

interface HomeBase {
  givenName: string;
  headerMembers: ListViewMember[];
  memberOverflow: number;
  /** 본인 오늘 할 일. */
  todos: HomeTodoItem[];
  todoCount: number;
  /** 본인 오늘 일정. */
  schedule: HomeScheduleItem[];
  scheduleDateLabel: string;
  /** 오늘 일정 카드 하단 부재 칩(전 역할 공통). */
  awayChip: HomeAwayChip;
}

/** 사원 홈: 본인 중심(내 오늘 요약·KPI·할 일·일정·체크인·우선 확인). 팀 지표·업무 흐름 없음(§3). */
export interface StaffHomeData extends HomeBase {
  grade: "staff";
  // ── 신규(§3 섹션 계약) ──
  /** Home/KPIGroup — 오늘 할 일·진행 중·이번 주 완료·기한 초과(전부 본인). */
  homeKpis: HomeKpi[];
  /** Home/TodaySummary — 규칙 기반 오늘 요약(어제 이월 포함). AI 브리핑 폴백. */
  todaySummary: StaffTodaySummary;
  /** Home/CheckIn — 응답 대기 자동 체크인 리스트(있을 때만 카드 표시). */
  checkIns: HomeCheckInItem[];
  /** Home/Priority + 상단바 벨과 같은 viewer-scoped 소스(체크인 포함). 화면은 kind!=="checkin"만 우선 확인에. */
  alerts: AlertsData;
  /** 확인 필요 Action 등 회의록 요약. */
  noteSummary: NoteSummary;
}

/** 관리자 홈: 팀 운영(요약·병목·충돌·부하·프로젝트·업무 흐름·처리 대기) + 본인 실행 축소. */
export interface ManagerHomeData extends HomeBase {
  grade: "manager";
  // ── 신규(§4 섹션 계약) ──
  /** Home/CheckIn — 본인 응답 대기 자동 체크인(있을 때만 카드 표시, 사원과 동일 산출). */
  checkIns: HomeCheckInItem[];
  /** Home/KPIGroup — 활성 프로젝트·열린 작업·현재 막힘·마감 임박·일정 충돌·상태 응답 대기. */
  homeKpis: HomeKpi[];
  /** Home/TodaySummary — 규칙 기반 요약. 팀관리 AI 브리핑 폴백. */
  todaySummary: ManagerTodaySummary;
  /** Home/Priority — 팀 우선 확인(문제→홀드→도움요청→충돌→응답대기→선행지연, 최대 5 + 총수). */
  teamPriority: TeamPriorityData;
  /** Home/ProjectOverview — 위험도 높은 활성 프로젝트 최대 5. */
  projectOverview: HomeProjectRow[];
  /** Home/WorkflowTrend — 주별 신규·완료·기한초과 + 순증(전사 스코프, 클라이언트 필터 존중). */
  workflowTrend: WorkflowTrend;
  /** Home/Pending — 결제 대기·확인 필요 Action·장기 상태 응답 대기. */
  pending: HomePending;

  // ── 기존(유지) ──
  teamSummary: TeamData["summary"];
  /** 주의 필요 병목(대표 담당 작업의 문제/홀드 포함 — 병목 공유). */
  attention: AttentionEntry[];
  conflicts: ConflictEntry[];
  /** 업무 부하 — 대표(ceo) 제외. 배분 조정용(§A). */
  load: HomeLoad;
  /** 날짜별 업무 집중도 히트맵 — 대표 제외 스코프(§B). */
  heatmap: HeatmapData;
  noteSummary: NoteSummary;
  pendingPayments: number;
  overduePayments: number;
}

/** 대표 홈: 전사 관점(2줄 KPI·우선 확인·프로젝트/클라이언트·업무 흐름·전원 부하·처리 대기) + 본인. */
export interface CeoHomeData extends HomeBase {
  grade: "ceo";
  // ── 신규(§5 섹션 계약) ──
  /** Home/CheckIn — 본인 응답 대기 자동 체크인(있을 때만 카드 표시, 사원과 동일 산출). */
  checkIns: HomeCheckInItem[];
  /** Home/KPIGroup 위험 줄 — 위험/지연 프로젝트·기한초과·위험 마일스톤·과부하·확인 대기·결제 대기. */
  riskKpis: HomeKpi[];
  /** Home/KPIGroup 운영 줄 — 관리자와 동일 6종(활성 프로젝트·열린 작업·막힘·마감 임박·충돌·응답 대기). */
  opsKpis: HomeKpi[];
  /** Home/TodaySummary — 규칙 기반 요약. 경영 AI 브리핑 폴백. */
  todaySummary: CeoTodaySummary;
  /** Home/Priority — 결정·확인 관점 우선 확인(getTeamPriorityItems 재사용). */
  teamPriority: TeamPriorityData;
  /** Home/ProjectOverview — 위험도 높은 활성 프로젝트 최대 5(+ clientOverview 병행). */
  projectOverview: HomeProjectRow[];
  /** Home/WorkflowTrend — 전사 주별 흐름 + 순증. */
  workflowTrend: WorkflowTrend;
  /** Home/Pending — 결제·확인 필요 Action·장기 상태 응답 대기. */
  pending: HomePending;

  // ── 기존(유지) ──
  kpis: PerfKpi[];
  rangeLabel: string;
  completionByMonth: MonthlyCompletion[];
  projects: ProjectProgressRow[];
  overallProgress: number;
  /** 위험/지연 마일스톤(riskStatus !== on_track). */
  riskMilestones: MilestoneRow[];
  /** 현재 막힌 작업(문제/홀드). */
  currentBlockers: ReportBlocker[];
  /** 클라이언트별 현황(신규 집계). */
  clientOverview: ClientOverviewRow[];
  /** 전 인원 부하 — 배분 조정용(§A). */
  load: HomeLoad;
  /** 전 인원 날짜별 업무 집중도 히트맵(§B). */
  heatmap: HeatmapData;
  pendingPayments: number;
  overduePayments: number;
  /** 대표 본인에게 온 viewer-scoped 신호 — 상단바 벨과 같은 소스(DASH-6). */
  alerts: AlertsData;
  /** 확인 필요 Action 등 회의록 요약(처리 대기 카드 소스). */
  noteSummary: NoteSummary;
}

export type GradeHomeData = StaffHomeData | ManagerHomeData | CeoHomeData;

type Db = Awaited<ReturnType<typeof getDb>>;

function base(home: HomeData, awayChip: HomeAwayChip): HomeBase {
  return {
    givenName: home.givenName,
    headerMembers: home.headerMembers,
    memberOverflow: home.memberOverflow,
    todos: home.todos,
    todoCount: home.todoCount,
    schedule: home.schedule,
    scheduleDateLabel: home.scheduleDateLabel,
    awayChip,
  };
}

const isOverdue = (t: Task, nowMs: number): boolean =>
  !!t.endAt && OPEN.has(t.status) && new Date(t.endAt).getTime() < nowMs;

/** 본인 응답 대기 자동 체크인 → '작업 상태 확인'(Home/CheckIn) 리스트 행.
 *  전 역할 공통(사원·관리자·대표 모두 본인 스코프로 산출). done/cancelled/merged 작업은 제외. */
function computeCheckIns(db: Db, user: User, now: Date): HomeCheckInItem[] {
  const projectById = new Map(db.projects.map((p) => [p.id, p]));
  const clientById = new Map(db.clients.map((c) => [c.id, c]));
  const projectLabelOf = (projectId?: string): string | null => {
    if (!projectId) return null;
    const p = projectById.get(projectId);
    return p ? formatProjectLabel(p, p.clientId ? clientById.get(p.clientId) : undefined) : null;
  };
  return db.checkIns
    .filter((c) => c.assigneeId === user.id && isAwaitingAnswer(c, now))
    .map((c) => {
      const t = db.tasks.find((x) => x.id === c.taskId);
      if (!t || t.status === "done" || t.status === "cancelled" || t.status === "merged") return null;
      return {
        checkInId: c.id,
        taskId: t.id,
        taskTitle: t.title,
        projectLabel: projectLabelOf(t.projectId),
        question: `‘${t.title}’ 작업은 어떻게 진행되고 있나요?`,
      };
    })
    .filter((x): x is HomeCheckInItem => x !== null);
}

/** 위험도 높은 활성 프로젝트 최대 5(Home/ProjectOverview). 클라이언트 필터 존중. */
function computeProjectOverview(db: Db, viewer: User, now: Date, clientId?: string): HomeProjectRow[] {
  const nowMs = now.getTime();
  const clientTasks = db.tasksForClient(clientId);
  const clientById = new Map(db.clients.map((c) => [c.id, c]));
  const rows: HomeProjectRow[] = db.projects
    .filter((p) => p.status === "active" && (!clientId || p.clientId === clientId))
    .map((p) => {
      const counted = clientTasks.filter(
        (t) => t.projectId === p.id && t.status !== "merged" && t.status !== "cancelled",
      );
      const total = counted.length;
      const done = counted.filter((t) => t.status === "done").length;
      const open = counted.filter((t) => t.status !== "done");
      const overdueTasks = open.filter((t) => isOverdue(t, nowMs)).length;
      const blockedTasks = open.filter((t) => t.status === "issue" || t.status === "on_hold").length;

      const ms = db.milestones.filter((m) => m.projectId === p.id);
      const lateMs = ms.some((m) => m.riskStatus === "late");
      const atRiskMs = ms.some((m) => m.riskStatus === "at_risk");
      // 임박 마감: 미래 마일스톤 중 가장 가까운 것, 없으면 임박 열린 작업 마감.
      const futureMsDue = ms
        .map((m) => m.dueAt)
        .filter((d) => new Date(d).getTime() >= nowMs)
        .sort()[0];
      const futureTaskDue = open
        .map((t) => t.endAt)
        .filter((d): d is string => !!d && new Date(d).getTime() >= nowMs)
        .sort()[0];
      const due = futureMsDue ?? futureTaskDue;

      const status: HomeProjectRow["status"] =
        overdueTasks > 0 || lateMs ? "delayed" : blockedTasks > 0 || atRiskMs ? "at_risk" : "on_track";

      return {
        projectId: p.id,
        name: formatProjectLabel(p, p.clientId ? clientById.get(p.clientId) : undefined),
        progress: total === 0 ? 0 : Math.round((done / total) * 100),
        dueLabel: due ? format(new Date(due), "M월 d일", { locale: ko }) : null,
        overdueTasks,
        blockedTasks,
        openTasks: open.length,
        status,
      };
    });

  const rank = { delayed: 0, at_risk: 1, on_track: 2 } as const;
  return rows
    .sort(
      (a, b) =>
        rank[a.status] - rank[b.status] ||
        b.overdueTasks + b.blockedTasks - (a.overdueTasks + a.blockedTasks),
    )
    .slice(0, 5);
}

/** 처리 대기(Home/Pending). 장기 응답 대기 = 7일 이상 미응답 체크인. */
function computePending(db: Db, viewer: User, now: Date): HomePending {
  const nowMs = now.getTime();
  const sevenDaysMs = 7 * 864e5;
  const dayMs = 864e5;
  const taskById = new Map(db.tasks.map((t) => [t.id, t]));
  const longAwaiting = db.checkIns.filter((c) => {
    if (!isAwaitingAnswer(c, now)) return false;
    const task = taskById.get(c.taskId);
    if (!task || !OPEN.has(task.status)) return false;
    return nowMs - new Date(c.scheduledAt).getTime() >= sevenDaysMs;
  });
  const checkinOldestWaitDays = longAwaiting.reduce(
    (max, c) => Math.max(max, Math.floor((nowMs - new Date(c.scheduledAt).getTime()) / dayMs)),
    0,
  );

  const waitingPayments = db.paymentRequests.filter((p) => p.status === "waiting");
  const paymentOldestWaitDays = waitingPayments.reduce(
    (max, p) => Math.max(max, Math.floor((nowMs - new Date(p.createdAt).getTime()) / dayMs)),
    0,
  );

  const needsReview = db.actionItems.filter((a) => a.status === "needs_review");
  const actionSourceNoteCount = new Set(needsReview.map((a) => a.meetingNoteId)).size;

  return {
    pendingPayments: waitingPayments.length,
    overduePayments: waitingPayments.filter(
      (p) => p.dueAt && new Date(p.dueAt).getTime() < nowMs,
    ).length,
    paymentOldestWaitDays,
    needsReviewActions: needsReview.length,
    actionSourceNoteCount,
    longAwaitingCheckins: longAwaiting.length,
    checkinOldestWaitDays,
  };
}

/** 앵커 연도: 선택 월이 현재월보다 크면 작년으로 간주(미래 월 방지). performance-data와 동일 규칙. */
function anchorYear(month: number, now: Date): number {
  return month > now.getMonth() + 1 ? now.getFullYear() - 1 : now.getFullYear();
}

/** 과부하 인원 수(예상 시간 임계 초과). */
function overloadCountOf(loadByMember: AdminReportData["loadByMember"]): number {
  return loadByMember.filter((m) => m.openHours > OVERLOAD_HOURS).length;
}

async function getStaffHomeData(
  user: User,
  now: Date,
  opts: GradeHomeOptions,
): Promise<StaffHomeData> {
  const [db, home, alerts, noteSummary, standup] = await Promise.all([
    getDb(),
    getHomeData(user, now, { dp: opts.dp, clientId: opts.clientId }),
    // viewer-scoped 신호(본인 관련만) — 상단바 벨·알림 센터와 같은 소스(수치 일치).
    getViewerAlerts(user, now, { all: true }), // 우선 확인용 — 벨 캡(8)·읽음순에 종속되지 않게 전체
    getNoteSummary(user),
    getStandupData(now, opts.clientId),
  ]);

  const nowMs = now.getTime();
  const soonMs = nowMs + 24 * 60 * 60 * 1000;
  const clientTasks = db.tasksForClient(opts.clientId);
  const mine = clientTasks.filter((t) => t.assigneeId === user.id);

  // ── KPI(전부 본인) ──
  const inProgress = mine.filter((t) => t.status === "in_progress").length;
  const overdueCount = mine.filter((t) => isOverdue(t, nowMs)).length;
  // 이번 주 완료 = 최근 7일 내 done 전이 중 담당이 본인인 작업.
  const weekAgoMs = nowMs - 7 * 864e5;
  const myTaskIds = new Set(mine.map((t) => t.id));
  const doneThisWeek = db.statusLogs.filter(
    (l) =>
      l.toStatus === "done" &&
      myTaskIds.has(l.taskId) &&
      new Date(l.createdAt).getTime() >= weekAgoMs,
  ).length;
  const homeKpis: HomeKpi[] = [
    { key: "todo", label: "오늘 할 일", value: home.todoCount, href: "/today" },
    { key: "in_progress", label: "진행 중", value: inProgress, href: "/today", tone: "info" },
    { key: "done_week", label: "이번 주 완료", value: doneThisWeek, tone: "success" },
    {
      key: "overdue",
      label: "기한 초과",
      value: overdueCount,
      href: "/today",
      tone: overdueCount > 0 ? "danger" : "default",
    },
  ];

  // ── 응답 대기 자동 체크인(리스트형 카드용) ──
  const checkIns = computeCheckIns(db, user, now);

  // ── 오늘 요약(어제 이월 = getStandupData 재사용) ──
  const myStandup = standup.find((r) => r.user.id === user.id);
  const carryoverCount = myStandup?.yesterdayUnfinished.length ?? 0;
  const dueSoonCount = mine.filter(
    (t) => OPEN.has(t.status) && t.endAt && new Date(t.endAt).getTime() <= soonMs && new Date(t.endAt).getTime() >= nowMs,
  ).length;
  const lines: string[] = [];
  lines.push(home.todoCount > 0 ? `오늘 할 일이 ${home.todoCount}건 있습니다.` : "오늘 마감이거나 기한이 지난 작업이 없습니다.");
  if (carryoverCount > 0) lines.push(`어제 못 끝낸 ${carryoverCount}건이 이월됐습니다.`);
  if (checkIns.length > 0) lines.push(`응답할 작업 상태 확인이 ${checkIns.length}건 있습니다.`);
  if (overdueCount > 0) lines.push(`기한이 지난 작업이 ${overdueCount}건 있습니다.`);
  const todaySummary: StaffTodaySummary = {
    todoCount: home.todoCount,
    dueSoonCount,
    checkInCount: checkIns.length,
    carryoverCount,
    lines,
  };

  return {
    grade: "staff",
    ...base(home, computeAwayChip(db, user, now)),
    homeKpis,
    todaySummary,
    checkIns,
    alerts,
    noteSummary,
  };
}

async function getManagerHomeData(
  user: User,
  now: Date,
  opts: GradeHomeOptions,
): Promise<ManagerHomeData> {
  const [db, home, team, report, noteSummary, teamPriority] = await Promise.all([
    getDb(),
    getHomeData(user, now, { dp: opts.dp, clientId: opts.clientId }),
    getTeamData(user, now, opts.clientId),
    getAdminReportData(user, "week", now, opts.clientId),
    getNoteSummary(user),
    getTeamPriorityItems(user, now, opts.clientId),
  ]);

  // 관리자 부하표·집중도는 대표(ceo) 제외 — 대표 부하는 관리자에게 노출하지 않는다(관리자끼리 상호 노출).
  // personScope는 세션 사용자 grade에서만 유도한다(URL로 확대 불가). manager → 대표 제외 userId.
  const personScope = personScopeForGrade(user, db.users);
  const load = computeHomeLoad(db, personScope, now, opts.clientId);
  const hmMonth = opts.hm ?? now.getMonth() + 1;
  const heatmap = await getHeatmapData(now, {
    monthAnchor: new Date(anchorYear(hmMonth, now), hmMonth - 1, 1),
    clientId: opts.clientId,
    personScope,
  });

  const overloadCount = overloadCountOf(report.loadByMember);
  const homeKpis: HomeKpi[] = [
    { key: "active_projects", label: "활성 프로젝트", value: report.overall.activeProjects, href: "/projects" },
    { key: "open_tasks", label: "열린 작업", value: report.overall.openTasks, href: "/now" },
    {
      key: "blocked",
      label: "현재 막힘",
      value: report.overall.blockedNow,
      href: "/team",
      tone: report.overall.blockedNow > 0 ? "danger" : "default",
    },
    { key: "due_soon", label: "마감 임박", value: team.summary.dueSoon, href: "/now", tone: "warning" },
    {
      key: "conflicts",
      label: "일정 충돌",
      value: team.conflicts.length,
      href: "/team",
      tone: team.conflicts.length > 0 ? "warning" : "default",
    },
    { key: "awaiting", label: "상태 응답 대기", value: team.summary.awaiting, href: "/team", tone: "info" },
  ];

  const issueCount = team.summary.issues + team.summary.onHold;
  const summaryLines: string[] = [];
  if (issueCount > 0) summaryLines.push(`막힌 작업이 ${issueCount}건 있습니다(문제 ${team.summary.issues}·홀드 ${team.summary.onHold}).`);
  if (team.conflicts.length > 0) summaryLines.push(`일정 충돌이 ${team.conflicts.length}건 있습니다.`);
  if (overloadCount > 0) summaryLines.push(`업무가 몰린 팀원이 ${overloadCount}명입니다.`);
  if (team.summary.awaiting > 0) summaryLines.push(`상태 응답 대기가 ${team.summary.awaiting}건 있습니다.`);
  if (summaryLines.length === 0) summaryLines.push("오늘 조정할 병목·충돌이 없습니다.");
  const todaySummary: ManagerTodaySummary = {
    issueCount,
    conflictCount: team.conflicts.length,
    overloadCount,
    awaitingCount: team.summary.awaiting,
    lines: summaryLines,
  };

  return {
    grade: "manager",
    ...base(home, computeAwayChip(db, user, now)),
    checkIns: computeCheckIns(db, user, now),
    homeKpis,
    todaySummary,
    teamPriority,
    projectOverview: computeProjectOverview(db, user, now, opts.clientId),
    workflowTrend: computeWorkflowTrend(db, now, opts.wf ?? 8, opts.clientId),
    pending: computePending(db, user, now),
    teamSummary: team.summary,
    attention: team.attention,
    conflicts: team.conflicts,
    load,
    heatmap,
    noteSummary,
    pendingPayments: report.overall.pendingPayments,
    overduePayments: report.overall.overduePayments,
  };
}

async function getCeoHomeData(
  user: User,
  now: Date,
  opts: GradeHomeOptions,
): Promise<CeoHomeData> {
  const [db, home, perf, report, planning, clientOverview, alerts, noteSummary, team, teamPriority] =
    await Promise.all([
      getDb(),
      getHomeData(user, now, { dp: opts.dp, clientId: opts.clientId }),
      // viewer=user(대표) → 사람 스코프 전원, KPI 전체(사원 아님).
      getPerformanceData(now, { hm: opts.hm, clientId: opts.clientId, viewer: user }),
      getAdminReportData(user, "month", now, opts.clientId),
      getPlanningData(user),
      getClientOverview(),
      // 대표 본인에게 온 요청(DASH-6) — viewer-scoped 신호(벨과 같은 소스).
      getViewerAlerts(user, now),
      getNoteSummary(user),
      getTeamData(user, now, opts.clientId),
      getTeamPriorityItems(user, now, opts.clientId),
    ]);

  const riskMilestones = planning.milestones.filter((m) => m.riskStatus !== "on_track");
  const nowMs = now.getTime();
  const clientTasks = db.tasksForClient(opts.clientId);
  const overdueCount = clientTasks.filter((t) => isOverdue(t, nowMs)).length;
  const projectOverview = computeProjectOverview(db, user, now, opts.clientId);
  const riskProjectCount = projectOverview.filter((p) => p.status !== "on_track").length;
  const overloadCount = overloadCountOf(report.loadByMember);
  const decisionCount = noteSummary.needsReview + report.overall.pendingPayments;

  // 위험 줄: 조망(전사 위험). 운영 줄: 관리자와 동일 6종.
  const riskKpis: HomeKpi[] = [
    {
      key: "risk_projects",
      label: "위험/지연 프로젝트",
      value: riskProjectCount,
      href: "/projects",
      tone: riskProjectCount > 0 ? "danger" : "default",
    },
    {
      key: "overdue",
      label: "기한 초과",
      value: overdueCount,
      href: "/now",
      tone: overdueCount > 0 ? "danger" : "default",
    },
    {
      key: "risk_milestones",
      label: "위험 마일스톤",
      value: report.overall.atRiskMilestones,
      href: "/planning",
      tone: report.overall.atRiskMilestones > 0 ? "warning" : "default",
    },
    { key: "overload", label: "과부하 인원", value: overloadCount, tone: overloadCount > 0 ? "warning" : "default" },
    { key: "needs_review", label: "확인 대기", value: noteSummary.needsReview, href: "/action", tone: "info" },
    {
      key: "pending_payments",
      label: "결제 대기",
      value: report.overall.pendingPayments,
      href: "/payments",
      tone: "warning",
    },
  ];
  const opsKpis: HomeKpi[] = [
    { key: "active_projects", label: "활성 프로젝트", value: report.overall.activeProjects, href: "/projects" },
    { key: "open_tasks", label: "열린 작업", value: report.overall.openTasks, href: "/now" },
    {
      key: "blocked",
      label: "현재 막힘",
      value: report.overall.blockedNow,
      href: "/team",
      tone: report.overall.blockedNow > 0 ? "danger" : "default",
    },
    { key: "due_soon", label: "마감 임박", value: team.summary.dueSoon, href: "/now", tone: "warning" },
    {
      key: "conflicts",
      label: "일정 충돌",
      value: team.conflicts.length,
      href: "/team",
      tone: team.conflicts.length > 0 ? "warning" : "default",
    },
    { key: "awaiting", label: "상태 응답 대기", value: team.summary.awaiting, href: "/team", tone: "info" },
  ];

  const ceoLines: string[] = [];
  if (riskProjectCount > 0) ceoLines.push(`위험·지연 프로젝트가 ${riskProjectCount}건입니다.`);
  if (overdueCount > 0) ceoLines.push(`기한이 지난 작업이 ${overdueCount}건 있습니다.`);
  if (overloadCount > 0) ceoLines.push(`업무가 몰린 인원이 ${overloadCount}명입니다.`);
  if (decisionCount > 0) ceoLines.push(`결정·확인 대기가 ${decisionCount}건 있습니다(확인 필요 Action·결제 대기).`);
  if (ceoLines.length === 0) ceoLines.push("전사 위험 신호가 없습니다.");
  const todaySummary: CeoTodaySummary = {
    riskProjectCount,
    overdueCount,
    overloadCount,
    decisionCount,
    lines: ceoLines,
  };

  return {
    grade: "ceo",
    ...base(home, computeAwayChip(db, user, now)),
    checkIns: computeCheckIns(db, user, now),
    riskKpis,
    opsKpis,
    todaySummary,
    teamPriority,
    projectOverview,
    workflowTrend: computeWorkflowTrend(db, now, opts.wf ?? 8, opts.clientId),
    pending: computePending(db, user, now),
    kpis: perf.kpis,
    rangeLabel: perf.rangeLabel,
    completionByMonth: perf.completionByMonth,
    projects: perf.projects,
    overallProgress: perf.overallProgress,
    riskMilestones,
    currentBlockers: report.currentBlockers,
    clientOverview,
    load: computeHomeLoad(db, personScopeForGrade(user, db.users), now, opts.clientId),
    heatmap: perf.heatmap,
    pendingPayments: report.overall.pendingPayments,
    overduePayments: report.overall.overduePayments,
    alerts,
    noteSummary,
  };
}

/** 세션 사용자의 grade에서 홈 번들을 조립한다. grade는 user.id로만 판정한다(URL 무관). */
export async function getGradeHomeData(
  user: User,
  now: Date = new Date(),
  opts: GradeHomeOptions = {},
): Promise<GradeHomeData> {
  const grade = gradeForUser(user);
  if (grade === "ceo") return getCeoHomeData(user, now, opts);
  if (grade === "manager") return getManagerHomeData(user, now, opts);
  return getStaffHomeData(user, now, opts);
}
