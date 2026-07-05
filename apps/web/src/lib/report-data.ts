import { formatProjectLabel, type User } from "@que/core";
import { getDb } from "./db";

// 관리자 리포트 (기획서 "관리자 리포트", 2026-07-03 확정, 대표/관리자 전용).
// 원칙: 개인 점수화·순위화 없음. "누가 많이 했나"가 아니라 "무엇이 얼마나 나아갔고(진척),
// 어디가 막혔고(병목), 부하가 어떻게 분포하는지(밸런싱)"만 보여준다 — 히트맵·팀 현황판과 같은
// "감시 아님 / 병목 진단" 원칙(기획서 211·229행)을 그대로 따른다.

export type ReportPeriod = "week" | "month";

/** 미완료(열려 있는) 작업으로 치는 상태 — 완료/취소/병합은 제외. */
const OPEN_STATUSES = new Set(["scheduled", "in_progress", "needs_reschedule", "on_hold", "issue"]);

export interface ReportBlocker {
  taskId: string;
  taskTitle: string;
  assigneeName: string;
  projectName?: string;
  status: "issue" | "on_hold";
  reason?: string;
  sinceLabel: string;
}

export interface AdminReportData {
  isAdmin: boolean;
  period: ReportPeriod;
  rangeStart: string; // YYYY-MM-DD
  rangeEnd: string; // YYYY-MM-DD
  overall: {
    activeProjects: number;
    openTasks: number;
    blockedNow: number;
    pendingPayments: number;
    overduePayments: number;
    atRiskMilestones: number;
  };
  completedInPeriod: number;
  cancelledInPeriod: number;
  completedByProject: { name: string; count: number }[];
  raisedIssues: number;
  raisedHolds: number;
  currentBlockers: ReportBlocker[];
  loadByMember: {
    name: string;
    openTasks: number;
    openHours: number;
    loadScore: number;
    blocked: number;
  }[];
  weeklyTrend: { label: string; completed: number }[];
}

const ymd = (d: Date): string =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

/** 관리자만 실데이터를 받는다. 비관리자에게는 빈 골격(isAdmin:false)만 돌려준다 — 페이지 가드와 함께 이중 방어. */
export async function getAdminReportData(
  viewer: User,
  period: ReportPeriod,
  now: Date = new Date(),
): Promise<AdminReportData> {
  const empty: AdminReportData = {
    isAdmin: false,
    period,
    rangeStart: ymd(now),
    rangeEnd: ymd(now),
    overall: {
      activeProjects: 0,
      openTasks: 0,
      blockedNow: 0,
      pendingPayments: 0,
      overduePayments: 0,
      atRiskMilestones: 0,
    },
    completedInPeriod: 0,
    cancelledInPeriod: 0,
    completedByProject: [],
    raisedIssues: 0,
    raisedHolds: 0,
    currentBlockers: [],
    loadByMember: [],
    weeklyTrend: [],
  };
  if (viewer.role !== "admin") return empty;

  const db = await getDb();
  const userById = new Map(db.users.map((u) => [u.id, u]));
  const projectById = new Map(db.projects.map((p) => [p.id, p]));
  const clientById = new Map(db.clients.map((c) => [c.id, c]));
  const projectLabel = (projectId?: string): string | undefined => {
    if (!projectId) return undefined;
    const project = projectById.get(projectId);
    if (!project) return undefined;
    return formatProjectLabel(project, project.clientId ? clientById.get(project.clientId) : undefined);
  };
  const taskById = new Map(db.tasks.map((t) => [t.id, t]));

  // 월간은 정확히 4주(28일)로 잡아 헤드라인 완료 수 == 주별 추세 합이 되게 한다 (수치 정합).
  const spanDays = period === "week" ? 7 : 28;
  const start = new Date(now);
  start.setDate(start.getDate() - (spanDays - 1));
  start.setHours(0, 0, 0, 0);
  const end = new Date(now);
  end.setHours(23, 59, 59, 999);
  const inRange = (iso: string): boolean => {
    const t = new Date(iso).getTime();
    return t >= start.getTime() && t <= end.getTime();
  };

  // ── 기간 집계: StatusLog가 상태 전이 타임라인의 유일한 출처(시드 이력 + 런타임 변경 모두 포함) ──
  const logsInRange = db.statusLogs.filter((l) => inRange(l.createdAt));
  const doneLogs = logsInRange.filter((l) => l.toStatus === "done");
  const cancelledInPeriod = logsInRange.filter((l) => l.toStatus === "cancelled").length;
  const raisedIssues = logsInRange.filter((l) => l.toStatus === "issue").length;
  const raisedHolds = logsInRange.filter((l) => l.toStatus === "on_hold").length;

  const byProjectCount = new Map<string, number>();
  for (const log of doneLogs) {
    const task = taskById.get(log.taskId);
    const name = task?.projectId ? (projectLabel(task.projectId) ?? "기타") : "프로젝트 미지정";
    byProjectCount.set(name, (byProjectCount.get(name) ?? 0) + 1);
  }
  const completedByProject = [...byProjectCount.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count);

  // 경과일은 시각(경과시간)이 아니라 달력일 차이로 센다 — 어제 17시에 막힌 작업이
  // 24시간이 안 지났다고 '오늘'로 표기되면 병목 지속시간을 하루씩 과소보고한다.
  const calendarDayDiff = (fromIso: string): number => {
    const f = new Date(fromIso);
    const a = new Date(f.getFullYear(), f.getMonth(), f.getDate());
    const b = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    return Math.max(0, Math.round((b.getTime() - a.getTime()) / 864e5));
  };

  // ── 병목: 현재 막혀 있는 작업 (도움 필요 관점) ──
  const blockedTasks = db.tasks.filter((t) => t.status === "issue" || t.status === "on_hold");
  const currentBlockers: ReportBlocker[] = blockedTasks
    .map((t) => {
      // 해당 작업의 가장 최근 issue/hold 전이 로그에서 사유를 가져온다
      const lastLog = [...db.statusLogs]
        .filter((l) => l.taskId === t.id && (l.toStatus === "issue" || l.toStatus === "on_hold"))
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
      const since = t.lastChangedAt ?? lastLog?.createdAt;
      const days = since ? calendarDayDiff(since) : 0;
      return {
        taskId: t.id,
        taskTitle: t.title,
        assigneeName: userById.get(t.assigneeId)?.name ?? t.assigneeId,
        projectName: projectLabel(t.projectId),
        status: t.status as "issue" | "on_hold",
        reason: lastLog?.reason,
        sinceLabel: days === 0 ? "오늘" : `${days}일째`,
      };
    })
    .sort((a, b) => (a.status === b.status ? 0 : a.status === "issue" ? -1 : 1));

  // ── 부하 분포 (밸런싱용 — 평가 아님) ──
  // 기획서 §9 운영규칙: "단순 작업 개수만 세지 않고 예상 소요 시간, 마감 임박, 문제발생 상태를
  // 함께 반영한다." → 원시 개수 대신 예상 시간 + 가중치로 부하를 잰다. 정렬은 내림차순(리더보드)이
  // 아니라 고정 멤버 순서(db.users)로 둬 순위 인상을 없앤다.
  const dueSoonMs = now.getTime() + 3 * 864e5;
  const loadByMember = db.users.map((u) => {
    const open = db.tasks.filter((t) => t.assigneeId === u.id && OPEN_STATUSES.has(t.status));
    const openHours = open.reduce((sum, t) => sum + (t.estimatedHours ?? 1), 0);
    const weight = open.reduce((sum, t) => {
      let w = 0;
      if (t.status === "issue") w += 2;
      if (t.status === "on_hold") w += 1;
      if (t.endAt && new Date(t.endAt).getTime() <= dueSoonMs) w += 1; // 마감 임박
      return sum + w;
    }, 0);
    return {
      name: u.name,
      openTasks: open.length,
      openHours,
      loadScore: openHours + weight,
      blocked: open.filter((t) => t.status === "issue" || t.status === "on_hold").length,
    };
  });

  // ── 주별 완료 추세 (월간에서 의미, 주간에서도 최근 흐름 참고용) ──
  const weekCount = period === "month" ? 4 : 1;
  const weeklyTrend: { label: string; completed: number }[] = [];
  for (let w = weekCount - 1; w >= 0; w -= 1) {
    const wEnd = new Date(now);
    wEnd.setDate(wEnd.getDate() - w * 7);
    wEnd.setHours(23, 59, 59, 999);
    const wStart = new Date(wEnd);
    wStart.setDate(wStart.getDate() - 6);
    wStart.setHours(0, 0, 0, 0);
    const completed = db.statusLogs.filter(
      (l) =>
        l.toStatus === "done" &&
        new Date(l.createdAt).getTime() >= wStart.getTime() &&
        new Date(l.createdAt).getTime() <= wEnd.getTime(),
    ).length;
    weeklyTrend.push({
      label: w === 0 ? "이번 주" : `${w}주 전`,
      completed,
    });
  }

  const now2 = now.getTime();
  return {
    isAdmin: true,
    period,
    rangeStart: ymd(start),
    rangeEnd: ymd(end),
    overall: {
      activeProjects: db.projects.filter((p) => p.status === "active").length,
      openTasks: db.tasks.filter((t) => OPEN_STATUSES.has(t.status)).length,
      blockedNow: blockedTasks.length,
      pendingPayments: db.paymentRequests.filter((p) => p.status === "waiting").length,
      overduePayments: db.paymentRequests.filter(
        (p) => p.status === "waiting" && p.dueAt && new Date(p.dueAt).getTime() < now2,
      ).length,
      atRiskMilestones: db.milestones.filter(
        (m) => m.riskStatus === "at_risk" || m.riskStatus === "late",
      ).length,
    },
    completedInPeriod: doneLogs.length,
    cancelledInPeriod,
    completedByProject,
    raisedIssues,
    raisedHolds,
    currentBlockers,
    loadByMember,
    weeklyTrend,
  };
}
