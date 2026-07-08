import { gradeForRank, gradeForUser, type User } from "@que/core";
import { getDb } from "./db";
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
  type PerformancePoint,
  type ProjectProgressRow,
} from "./performance-data";
import type { HeatmapData } from "./heatmap-data";
import { getTeamData, type AttentionEntry, type ConflictEntry, type TeamData } from "./team-data";
import { getAdminReportData, type AdminReportData, type ReportBlocker } from "./report-data";
import { getPlanningData, type MilestoneRow } from "./planning-data";
import { getClientOverview, type ClientOverviewRow } from "./client-overview";
import { getAlerts, type AlertsData } from "./alerts-data";
import { getNoteSummary, type NoteSummary } from "./notes-summary";

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
}

/** 사원 홈: 본인 중심(내 KPI·할 일·일정·요청·기여·성과 라인). */
export interface StaffHomeData extends HomeBase {
  grade: "staff";
  /** 본인 스코프 KPI(사원은 KPI도 self). */
  kpis: PerfKpi[];
  rangeLabel: string;
  /** 내 기여 히트맵(본인 1행). */
  contributionHeatmap: HeatmapData;
  /** 내 작업 성과 라인(self). */
  performanceTrend: PerformancePoint[];
  /** 내게 온 신호(병목/확인필요/기한초과/결제) — 상단바 벨과 같은 소스. */
  alerts: AlertsData;
  /** 확인 필요 Action 등 회의록 요약. */
  noteSummary: NoteSummary;
}

/** 관리자 홈: 팀 운영(요약·병목·충돌·부하·확인필요·결제) + 본인 축소. */
export interface ManagerHomeData extends HomeBase {
  grade: "manager";
  teamSummary: TeamData["summary"];
  /** 주의 필요 병목(대표 담당 작업의 문제/홀드 포함 — 병목 공유). */
  attention: AttentionEntry[];
  conflicts: ConflictEntry[];
  /** 팀 부하 — 대표(ceo) 제외. */
  loadByMember: AdminReportData["loadByMember"];
  noteSummary: NoteSummary;
  pendingPayments: number;
  overduePayments: number;
}

/** 대표 홈: 전사 관점(KPI·완료 추이·프로젝트/위험 마일스톤·막힘·클라이언트별·전원 부하) + 본인. */
export interface CeoHomeData extends HomeBase {
  grade: "ceo";
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
  /** 전 인원 부하. */
  loadByMember: AdminReportData["loadByMember"];
  /** 전 인원 히트맵. */
  heatmap: HeatmapData;
  pendingPayments: number;
  overduePayments: number;
  /** 대표 본인에게 온 신호(병목/확인필요/기한초과/결제) — 상단바 벨과 같은 소스(DASH-6). */
  alerts: AlertsData;
  /** 확인 필요 Action 등 회의록 요약(RequestInbox 소스). */
  noteSummary: NoteSummary;
}

export type GradeHomeData = StaffHomeData | ManagerHomeData | CeoHomeData;

function base(home: HomeData): HomeBase {
  return {
    givenName: home.givenName,
    headerMembers: home.headerMembers,
    memberOverflow: home.memberOverflow,
    todos: home.todos,
    todoCount: home.todoCount,
    schedule: home.schedule,
    scheduleDateLabel: home.scheduleDateLabel,
  };
}

async function getStaffHomeData(
  user: User,
  now: Date,
  opts: GradeHomeOptions,
): Promise<StaffHomeData> {
  const [home, perf, alerts, noteSummary] = await Promise.all([
    getHomeData(user, now, { dp: opts.dp, clientId: opts.clientId }),
    // viewer=user(사원) → KPI·히트맵 rows·작업 성과 라인이 본인 스코프로 좁혀진다.
    getPerformanceData(now, { hm: opts.hm, clientId: opts.clientId, viewer: user }),
    getAlerts(user, now),
    getNoteSummary(user),
  ]);

  return {
    grade: "staff",
    ...base(home),
    kpis: perf.kpis,
    rangeLabel: perf.rangeLabel,
    contributionHeatmap: perf.heatmap,
    performanceTrend: perf.performanceTrend,
    alerts,
    noteSummary,
  };
}

async function getManagerHomeData(
  user: User,
  now: Date,
  opts: GradeHomeOptions,
): Promise<ManagerHomeData> {
  const [db, home, team, report, noteSummary] = await Promise.all([
    getDb(),
    getHomeData(user, now, { dp: opts.dp, clientId: opts.clientId }),
    getTeamData(user, now, opts.clientId),
    getAdminReportData(user, "week", now, opts.clientId),
    getNoteSummary(user),
  ]);

  // 관리자 부하표는 대표(ceo) 제외 — 대표 부하는 관리자에게 노출하지 않는다(관리자끼리는 상호 노출).
  // grade는 정적 맵이 아니라 db.users의 rank에서 유도한다(신규/직급변경 반영).
  const rankById = new Map(db.users.map((u) => [u.id, u.rank]));
  const loadByMember = report.loadByMember.filter(
    (row) => gradeForRank(rankById.get(row.userId)) !== "ceo",
  );

  return {
    grade: "manager",
    ...base(home),
    teamSummary: team.summary,
    attention: team.attention,
    conflicts: team.conflicts,
    loadByMember,
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
  const [home, perf, report, planning, clientOverview, alerts, noteSummary] = await Promise.all([
    getHomeData(user, now, { dp: opts.dp, clientId: opts.clientId }),
    // viewer=user(대표) → 사람 스코프 전원, KPI 전체(사원 아님).
    getPerformanceData(now, { hm: opts.hm, clientId: opts.clientId, viewer: user }),
    getAdminReportData(user, "month", now, opts.clientId),
    getPlanningData(user),
    getClientOverview(),
    // 대표 본인에게 온 요청(DASH-6) — 사원 홈과 동일한 core 조회 재사용.
    getAlerts(user, now),
    getNoteSummary(user),
  ]);

  const riskMilestones = planning.milestones.filter((m) => m.riskStatus !== "on_track");

  return {
    grade: "ceo",
    ...base(home),
    kpis: perf.kpis,
    rangeLabel: perf.rangeLabel,
    completionByMonth: perf.completionByMonth,
    projects: perf.projects,
    overallProgress: perf.overallProgress,
    riskMilestones,
    currentBlockers: report.currentBlockers,
    clientOverview,
    loadByMember: report.loadByMember,
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
