import { formatProjectLabel, type User } from "@que/core";
import { getDb } from "./db";
import { computeWorkflowTrend, type WorkflowTrend } from "./workflow-trend";

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

/** 운영 건강도 지표 한 칸(전 기간 대비 증감 포함). 색은 화살표·텍스트의 보조로만 쓴다. */
export interface HealthMetric {
  /** 큰 수치 표시 문구. 산출 불가(분모 0·표본 없음)면 "—". */
  value: string;
  /** 화살표: up=↑, down=↓, flat=변화 없음, none=전 기간 대비 비교 불가. */
  direction: "up" | "down" | "flat" | "none";
  /** 증감 요약 문구(예: "12h 단축", "5%p 개선", "1건 감소"). */
  deltaLabel: string;
  /** 이 방향이 개선(green)/악화(red)/중립인지. tone만으로 의미 전달하지 않는다(화살표+텍스트 동반). */
  tone: "good" | "bad" | "neutral";
  /** 보조 설명(분모·미해소 등). */
  sub: string;
}

/** 운영 건강도 3종 — statusLogs·tasks로만 산출(감시 아님, 흐름·구조 진단). */
export interface OpsHealth {
  /** 병목 해소 시간(진입→해소 평균 소요). 짧아지면 개선. */
  resolution: HealthMetric;
  /** 기한 준수율(기간 내 마감 도래 작업 중 기한 내 완료 비율). 오르면 개선. */
  adherence: HealthMetric;
  /** 재발 병목(기간 내 issue/on_hold 진입 2회 이상 작업 수). 줄면 개선. */
  recurring: HealthMetric;
  /** 재발 병목 대표 작업명(툴팁·서브텍스트, 최대 2). */
  recurringNames: string[];
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
    userId: string;
    name: string;
    openTasks: number;
    openHours: number;
    loadScore: number;
    blocked: number;
  }[];
  weeklyTrend: { label: string; completed: number }[];
  /** 최근 8주 업무 흐름(신규·완료·기한초과 + 순증) — 기간 필터와 무관한 고정 추이(홈과 동일 산출). */
  workflowTrend: WorkflowTrend;
  /** 운영 건강도 3종(리포트 기간 스코프, 전 기간 대비 증감 포함). */
  opsHealth: OpsHealth;
}

/** 병목으로 치는 상태(진입/해소 판정). */
const BLOCKED_STATUSES = new Set(["issue", "on_hold"]);

const EMPTY_METRIC: HealthMetric = {
  value: "—",
  direction: "none",
  deltaLabel: "이전 기간 대비 비교 불가",
  tone: "neutral",
  sub: "",
};

const EMPTY_OPS_HEALTH: OpsHealth = {
  resolution: EMPTY_METRIC,
  adherence: EMPTY_METRIC,
  recurring: EMPTY_METRIC,
  recurringNames: [],
};

/** 소요(ms)를 사람이 읽는 라벨로: 24h 미만은 시간(h), 이상은 일(d). */
function durationLabel(ms: number): string {
  const hours = ms / 3.6e6;
  if (hours < 24) return `${hours < 10 ? hours.toFixed(1) : Math.round(hours)}h`;
  return `${(hours / 24).toFixed(1)}d`;
}

/** 증감 방향·극성 판정(diff 양수=값 증가). goodDir=값이 어느 방향일 때 개선인지. */
function dirTone(
  diff: number,
  goodDir: "up" | "down",
): { direction: "up" | "down" | "flat"; tone: HealthMetric["tone"] } {
  if (diff === 0) return { direction: "flat", tone: "neutral" };
  const direction = diff > 0 ? "up" : "down";
  return { direction, tone: direction === goodDir ? "good" : "bad" };
}

const ymd = (d: Date): string =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

/** 관리자만 실데이터를 받는다. 비관리자에게는 빈 골격(isAdmin:false)만 돌려준다 — 페이지 가드와 함께 이중 방어. */
export async function getAdminReportData(
  viewer: User,
  period: ReportPeriod,
  now: Date = new Date(),
  clientId?: string,
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
    workflowTrend: { weeks: [], weeksBack: 8, netChange: 0, netLabel: "" },
    opsHealth: EMPTY_OPS_HEALTH,
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
  // ID→작업 조회 맵: 로그/병목의 이름·프로젝트 참조용이라 전체 유지(필터 금지).
  const taskById = new Map(db.tasks.map((t) => [t.id, t]));
  // 표시/집계 소스는 클라이언트 필터를 반영한다.
  const clientTasks = db.tasksForClient(clientId);
  const clientTaskIds = clientId ? new Set(clientTasks.map((t) => t.id)) : null;
  // 상태 전이 로그의 집계도 필터와 정합하도록: 필터 시 해당 클라이언트 작업의 로그만 센다.
  const inClient = (taskId: string): boolean => !clientTaskIds || clientTaskIds.has(taskId);

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
  const logsInRange = db.statusLogs.filter((l) => inRange(l.createdAt) && inClient(l.taskId));
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
  const blockedTasks = clientTasks.filter((t) => t.status === "issue" || t.status === "on_hold");
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
    const open = clientTasks.filter((t) => t.assigneeId === u.id && OPEN_STATUSES.has(t.status));
    const openHours = open.reduce((sum, t) => sum + (t.estimatedHours ?? 1), 0);
    const weight = open.reduce((sum, t) => {
      let w = 0;
      if (t.status === "issue") w += 2;
      if (t.status === "on_hold") w += 1;
      if (t.endAt && new Date(t.endAt).getTime() <= dueSoonMs) w += 1; // 마감 임박
      return sum + w;
    }, 0);
    return {
      userId: u.id,
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
        inClient(l.taskId) &&
        new Date(l.createdAt).getTime() >= wStart.getTime() &&
        new Date(l.createdAt).getTime() <= wEnd.getTime(),
    ).length;
    weeklyTrend.push({
      label: w === 0 ? "이번 주" : `${w}주 전`,
      completed,
    });
  }

  // ── 최근 8주 업무 흐름(기간 필터와 무관 · 홈과 동일 산출) ──
  const workflowTrend = computeWorkflowTrend(db, now, 8, clientId);

  // ── 운영 건강도 3종 — statusLogs·tasks로 산출, 리포트 기간 vs 전 기간 비교 ──
  // 작업별 상태로그를 시간순으로 정렬해 두고(병목 진입/해소 짝 매칭), 두 기간에 재사용한다.
  const logsByTask = new Map<string, typeof db.statusLogs>();
  for (const l of db.statusLogs) {
    if (!inClient(l.taskId)) continue;
    const arr = logsByTask.get(l.taskId);
    if (arr) arr.push(l);
    else logsByTask.set(l.taskId, [l]);
  }
  for (const arr of logsByTask.values()) arr.sort((a, b) => a.createdAt.localeCompare(b.createdAt));

  interface HealthWindow {
    avgResolutionMs: number | null; // 기간 내 해소된 병목의 평균 소요. 해소 0건이면 null.
    resolvedCount: number;
    recurringCount: number;
    recurringNames: string[];
    adherencePct: number | null; // 분모(마감 도래) 0이면 null.
    adherenceDenom: number;
    adherenceMet: number;
  }

  const windowHealth = (sMs: number, eMs: number): HealthWindow => {
    let totalMs = 0;
    let resolvedCount = 0;
    const recurringIds: string[] = [];
    for (const [taskId, arr] of logsByTask) {
      let blockedSince: number | null = null;
      let entriesInWindow = 0;
      for (const l of arr) {
        const at = new Date(l.createdAt).getTime();
        if (BLOCKED_STATUSES.has(l.toStatus)) {
          // 진입 = 비병목→병목. issue→on_hold(병목 연속)은 새 진입으로 세지 않는다.
          if (blockedSince === null) {
            blockedSince = at;
            if (at >= sMs && at <= eMs) entriesInWindow += 1;
          }
        } else if (blockedSince !== null) {
          // 해소 = 병목→다른 상태. 해소 시각이 창 안이면 소요를 집계한다.
          if (at >= sMs && at <= eMs) {
            totalMs += at - blockedSince;
            resolvedCount += 1;
          }
          blockedSince = null;
        }
      }
      // 미해소(창 끝까지 막힘)는 소요 집계에서 제외 — resolvedCount에 안 들어감.
      if (entriesInWindow >= 2) recurringIds.push(taskId);
    }

    // 기한 준수율: 마감(endAt)이 창 안에 도래한 작업 중 마감 전(당일 포함) 완료 비율.
    let adherenceDenom = 0;
    let adherenceMet = 0;
    for (const t of clientTasks) {
      if (!t.endAt || t.status === "cancelled" || t.status === "merged") continue;
      const dueMs = new Date(t.endAt).getTime();
      if (dueMs < sMs || dueMs > eMs) continue;
      adherenceDenom += 1;
      const onTime = (logsByTask.get(t.id) ?? []).some(
        (l) => l.toStatus === "done" && new Date(l.createdAt).getTime() <= dueMs,
      );
      if (onTime) adherenceMet += 1;
    }

    return {
      avgResolutionMs: resolvedCount > 0 ? totalMs / resolvedCount : null,
      resolvedCount,
      recurringCount: recurringIds.length,
      recurringNames: recurringIds.map((id) => taskById.get(id)?.title ?? id).slice(0, 2),
      adherencePct: adherenceDenom > 0 ? Math.round((adherenceMet / adherenceDenom) * 100) : null,
      adherenceDenom,
      adherenceMet,
    };
  };

  const prevStartD = new Date(start);
  prevStartD.setDate(prevStartD.getDate() - spanDays);
  const cur = windowHealth(start.getTime(), end.getTime());
  const prev = windowHealth(prevStartD.getTime(), start.getTime() - 1);

  // 병목 해소 시간 — 짧아지면 개선(green). 미해소=현재 막힌 작업 수.
  let resolution: HealthMetric;
  if (cur.avgResolutionMs === null) {
    resolution = {
      ...EMPTY_METRIC,
      sub: `해소 0건 · 미해소 ${blockedTasks.length}건`,
    };
  } else if (prev.avgResolutionMs === null) {
    resolution = {
      value: durationLabel(cur.avgResolutionMs),
      direction: "none",
      deltaLabel: "이전 기간 대비 비교 불가",
      tone: "neutral",
      sub: `해소 ${cur.resolvedCount}건 · 미해소 ${blockedTasks.length}건`,
    };
  } else {
    const diff = cur.avgResolutionMs - prev.avgResolutionMs;
    const { direction, tone } = dirTone(diff, "down");
    resolution = {
      value: durationLabel(cur.avgResolutionMs),
      direction,
      deltaLabel:
        diff === 0
          ? "이전 기간과 동일"
          : `${durationLabel(Math.abs(diff))} ${diff < 0 ? "단축" : "증가"}`,
      tone,
      sub: `해소 ${cur.resolvedCount}건 · 미해소 ${blockedTasks.length}건`,
    };
  }

  // 기한 준수율 — 오르면 개선(green). 분모 0이면 "—".
  let adherence: HealthMetric;
  if (cur.adherencePct === null) {
    adherence = { ...EMPTY_METRIC, sub: "이 기간에 마감 도래한 작업이 없습니다" };
  } else if (prev.adherencePct === null) {
    adherence = {
      value: `${cur.adherencePct}%`,
      direction: "none",
      deltaLabel: "이전 기간 대비 비교 불가",
      tone: "neutral",
      sub: `마감 ${cur.adherenceDenom}건 중 ${cur.adherenceMet}건 기한 내`,
    };
  } else {
    const diff = cur.adherencePct - prev.adherencePct;
    const { direction, tone } = dirTone(diff, "up");
    adherence = {
      value: `${cur.adherencePct}%`,
      direction,
      deltaLabel:
        diff === 0 ? "이전 기간과 동일" : `${Math.abs(diff)}%p ${diff > 0 ? "개선" : "하락"}`,
      tone,
      sub: `마감 ${cur.adherenceDenom}건 중 ${cur.adherenceMet}건 기한 내`,
    };
  }

  // 재발 병목 — 줄면 개선(green). 카운트는 항상 정의됨.
  const recurringDiff = cur.recurringCount - prev.recurringCount;
  const recurringDT = dirTone(recurringDiff, "down");
  const recurring: HealthMetric = {
    value: `${cur.recurringCount}건`,
    direction: recurringDT.direction,
    deltaLabel:
      recurringDiff === 0
        ? "이전 기간과 동일"
        : `${Math.abs(recurringDiff)}건 ${recurringDiff < 0 ? "감소" : "증가"}`,
    tone: recurringDT.tone,
    sub:
      cur.recurringNames.length > 0
        ? `${cur.recurringNames.join(", ")} 등`
        : "재발 병목 없음",
  };

  const opsHealth: OpsHealth = {
    resolution,
    adherence,
    recurring,
    recurringNames: cur.recurringNames,
  };

  const now2 = now.getTime();
  return {
    isAdmin: true,
    period,
    rangeStart: ymd(start),
    rangeEnd: ymd(end),
    overall: {
      // 클라이언트 필터 시 그 거래처의 활성 프로젝트만 — 성과 화면(performance-data)과 같은 술어로
      // 맞춰 "진행 프로젝트"와 "열린 작업"이 같은 모집단을 보게 한다(화면 간 숫자 불일치 방지).
      activeProjects: db.projects.filter(
        (p) => p.status === "active" && (!clientId || p.clientId === clientId),
      ).length,
      openTasks: clientTasks.filter((t) => OPEN_STATUSES.has(t.status)).length,
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
    workflowTrend,
    opsHealth,
  };
}
