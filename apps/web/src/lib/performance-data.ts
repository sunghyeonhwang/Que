import { format, startOfMonth, startOfWeek, subMonths, subWeeks } from "date-fns";
import { departmentForUser, formatProjectLabel } from "@que/core";
import { getDb } from "./db";
import { getHeatmapData, type HeatmapData } from "./heatmap-data";

// 성과(퍼포먼스) 대시보드용 집계 셀렉터 — 전부 서버에서 계산한다.
// 원칙(기획서·CLAUDE.md): 개인 평가/순위가 아니라 진척·병목·부하 분포를 드러낸다.
// 데이터 출처: core db(tasks/statusLogs/projects) + 6주 status_logs 이력 + heatmap-data 재사용.
// status_logs는 6주(42일)치라 월별 집계는 최근 1~2개월만 채워진다 — 그 이전은 0(근사, 명시).

const DONE = new Set(["done"]);
const OPEN = new Set(["scheduled", "in_progress", "needs_reschedule", "on_hold", "issue"]);

export type KpiDirection = "up" | "down" | "flat";

export interface PerfKpi {
  key: "total" | "in_progress" | "completed" | "overdue";
  label: string;
  value: number;
  /** 전기(직전 동일 기간) 대비 증감% — 데이터 부족 시 0 근사 */
  deltaPct: number;
  direction: KpiDirection;
  subLabel: string;
}

export interface MonthlyCompletion {
  label: string;
  completed: number;
}

export interface OverduePoint {
  label: string;
  overdue: number;
}

/** 작업 성과(3계열) — 주별 완료/새작업/기한초과 */
export interface PerformancePoint {
  label: string;
  completed: number;
  created: number;
  overdue: number;
}

export interface LowPerformerRow {
  userId: string;
  name: string;
  department: string;
  avatarColor: string;
  overdue: number;
  completed: number;
}

export type ProjectProgressStatus = "in_progress" | "waiting" | "done";

export interface ProjectProgressRow {
  id: string;
  name: string;
  progress: number; // 0~100
  done: number;
  total: number;
  status: ProjectProgressStatus;
  statusLabel: string;
}

export interface PerformanceData {
  rangeLabel: string;
  kpis: PerfKpi[];
  completionByMonth: MonthlyCompletion[];
  overdueTrend: OverduePoint[];
  performanceTrend: PerformancePoint[];
  heatmap: HeatmapData;
  lowPerformers: LowPerformerRow[];
  overallProgress: number;
  projects: ProjectProgressRow[];
}

function pctChange(cur: number, prev: number): { deltaPct: number; direction: KpiDirection } {
  if (prev === 0) {
    const deltaPct = cur > 0 ? 100 : 0;
    return { deltaPct, direction: cur > 0 ? "up" : "flat" };
  }
  const raw = ((cur - prev) / prev) * 100;
  const deltaPct = Math.round(raw * 10) / 10;
  return { deltaPct, direction: deltaPct > 0 ? "up" : deltaPct < 0 ? "down" : "flat" };
}

export interface PerformanceOptions {
  /** 히트맵 월(1-12). 기본=현재월. */
  hm?: number;
  /** 완료율 막대: 이 월(1-12)로 끝나는 최근 6개월. 기본=현재월. */
  cm?: number;
  /** 기한 초과 추이: 최근 N주. 기본=8. */
  ot?: number;
  /** 저성과표 산정 월(1-12). 기본=현재월. */
  lm?: number;
}

export async function getPerformanceData(
  now: Date = new Date(),
  opts: PerformanceOptions = {},
): Promise<PerformanceData> {
  const db = await getDb();
  const nowMs = now.getTime();
  const clientById = new Map(db.clients.map((c) => [c.id, c]));

  // 화이트리스트 검증은 호출부(페이지)에서 하고, 여기선 숫자/enum을 그대로 신뢰한다.
  const hm = opts.hm ?? now.getMonth() + 1;
  const cm = opts.cm ?? now.getMonth() + 1;
  const otWeeks = opts.ot ?? 8;
  const lm = opts.lm ?? now.getMonth() + 1;
  // 앵커 연도: 선택 월이 현재월보다 크면 작년으로 간주(현재 시점 이후 월 방지).
  const anchorYear = (month: number): number =>
    month > now.getMonth() + 1 ? now.getFullYear() - 1 : now.getFullYear();

  // ── 작업 생성 시점 근사: 해당 작업의 가장 이른 status_log, 없으면 startAt/endAt ──
  const earliestLog = new Map<string, number>();
  for (const log of db.statusLogs) {
    const t = new Date(log.createdAt).getTime();
    const prev = earliestLog.get(log.taskId);
    if (prev === undefined || t < prev) earliestLog.set(log.taskId, t);
  }
  const creationMs = (taskId: string): number | undefined => {
    if (earliestLog.has(taskId)) return earliestLog.get(taskId);
    const task = db.tasks.find((t) => t.id === taskId);
    const iso = task?.startAt ?? task?.endAt;
    return iso ? new Date(iso).getTime() : undefined;
  };

  const isOverdue = (endAt: string | undefined, status: string): boolean =>
    !!endAt && new Date(endAt).getTime() < nowMs && OPEN.has(status);

  // ── KPI: 28일(4주) 현재 기간 vs 직전 28일 ──
  const PERIOD = 28 * 864e5;
  const curStart = nowMs - PERIOD;
  const prevStart = nowMs - 2 * PERIOD;
  const inCur = (ms: number | undefined) => ms !== undefined && ms > curStart && ms <= nowMs;
  const inPrev = (ms: number | undefined) => ms !== undefined && ms > prevStart && ms <= curStart;

  const liveTasks = db.tasks.filter((t) => t.status !== "cancelled" && t.status !== "merged");
  const totalValue = liveTasks.length;
  const newCur = liveTasks.filter((t) => inCur(creationMs(t.id))).length;
  const newPrev = liveTasks.filter((t) => inPrev(creationMs(t.id))).length;

  const inProgressValue = db.tasks.filter((t) => t.status === "in_progress").length;
  const ipLogCur = db.statusLogs.filter(
    (l) => l.toStatus === "in_progress" && inCur(new Date(l.createdAt).getTime()),
  ).length;
  const ipLogPrev = db.statusLogs.filter(
    (l) => l.toStatus === "in_progress" && inPrev(new Date(l.createdAt).getTime()),
  ).length;

  const completedValue = db.tasks.filter((t) => t.status === "done").length;
  const doneCur = db.statusLogs.filter(
    (l) => l.toStatus === "done" && inCur(new Date(l.createdAt).getTime()),
  ).length;
  const donePrev = db.statusLogs.filter(
    (l) => l.toStatus === "done" && inPrev(new Date(l.createdAt).getTime()),
  ).length;

  const overdueValue = db.tasks.filter((t) => isOverdue(t.endAt, t.status)).length;
  // 기한 초과 증감 근사: 마감이 각 기간에 걸리고 아직 열려 있는(초과) 작업 수 비교
  const overdueEndCur = db.tasks.filter(
    (t) => t.endAt && inCur(new Date(t.endAt).getTime()) && OPEN.has(t.status),
  ).length;
  const overdueEndPrev = db.tasks.filter(
    (t) => t.endAt && inPrev(new Date(t.endAt).getTime()) && OPEN.has(t.status),
  ).length;

  const totalDelta = pctChange(newCur, newPrev);
  const ipDelta = pctChange(ipLogCur, ipLogPrev);
  const doneDelta = pctChange(doneCur, donePrev);
  const overdueDelta = pctChange(overdueEndCur, overdueEndPrev);

  const kpis: PerfKpi[] = [
    {
      key: "total",
      label: "총 작업",
      value: totalValue,
      deltaPct: totalDelta.deltaPct,
      direction: totalDelta.direction,
      subLabel: `새 작업 ${newCur}건 (최근 4주)`,
    },
    {
      key: "in_progress",
      label: "진행 중 작업",
      value: inProgressValue,
      deltaPct: ipDelta.deltaPct,
      direction: ipDelta.direction,
      subLabel: `${inProgressValue}개 작업 진행 중`,
    },
    {
      key: "completed",
      label: "완료된 작업",
      value: completedValue,
      deltaPct: doneDelta.deltaPct,
      direction: doneDelta.direction,
      subLabel: `최근 4주 ${doneCur}건 완료`,
    },
    {
      key: "overdue",
      label: "기한 초과 작업",
      value: overdueValue,
      deltaPct: overdueDelta.deltaPct,
      direction: overdueDelta.direction,
      subLabel: `${overdueValue}건 마감 지남`,
    },
  ];

  // ── 작업 완료율(월별 막대): cm월로 끝나는 최근 6개월, status_logs done 전이 기준 ──
  const cmAnchor = startOfMonth(new Date(anchorYear(cm), cm - 1, 1));
  const months: { start: Date; end: Date; label: string }[] = [];
  for (let i = 5; i >= 0; i -= 1) {
    const start = startOfMonth(subMonths(cmAnchor, i));
    const end = startOfMonth(subMonths(cmAnchor, i - 1));
    months.push({ start, end, label: format(start, "M월") });
  }
  const completionByMonth: MonthlyCompletion[] = months.map(({ start, end, label }) => {
    const s = start.getTime();
    const e = end.getTime();
    const completed = db.statusLogs.filter((l) => {
      if (l.toStatus !== "done") return false;
      const t = new Date(l.createdAt).getTime();
      return t >= s && t < e;
    }).length;
    return { label, completed };
  });

  // ── 주별 버킷 헬퍼: 최근 n주 [start,end) 버킷 ──
  const buildWeeks = (n: number): { start: number; end: number; label: string }[] => {
    const out: { start: number; end: number; label: string }[] = [];
    for (let i = n - 1; i >= 0; i -= 1) {
      const start = startOfWeek(subWeeks(now, i), { weekStartsOn: 1 });
      const end = startOfWeek(subWeeks(now, i - 1), { weekStartsOn: 1 });
      out.push({ start: start.getTime(), end: end.getTime(), label: format(start, "M/d") });
    }
    return out;
  };

  // ── 기한 초과 추이(영역): 최근 otWeeks주 ──
  const overdueTrend: OverduePoint[] = buildWeeks(otWeeks).map(({ start, end, label }) => {
    // 그 주에 마감이 걸렸고 아직 완료되지 못한(초과) 작업 수
    const overdue = db.tasks.filter((t) => {
      if (!t.endAt) return false;
      const e = new Date(t.endAt).getTime();
      return e >= start && e < end && OPEN.has(t.status);
    }).length;
    return { label, overdue };
  });

  // ── 작업 성과(3계열 라인): 8주 고정 ──
  const performanceTrend: PerformancePoint[] = buildWeeks(8).map(({ start, end, label }) => {
    const completed = db.statusLogs.filter(
      (l) => l.toStatus === "done" && new Date(l.createdAt).getTime() >= start && new Date(l.createdAt).getTime() < end,
    ).length;
    const created = liveTasks.filter((t) => {
      const c = creationMs(t.id);
      return c !== undefined && c >= start && c < end;
    }).length;
    const overdue = db.tasks.filter((t) => {
      if (!t.endAt) return false;
      const e = new Date(t.endAt).getTime();
      return e >= start && e < end && OPEN.has(t.status);
    }).length;
    return { label, completed, created, overdue };
  });

  // ── 히트맵 재사용 (멤버×일 초록 강도): hm월 그리드 ──
  const heatmap = await getHeatmapData(now, {
    monthAnchor: new Date(anchorYear(hm), hm - 1, 1),
  });

  // ── 저성과 팀 표: lm월 내 활동 기준 (초과 많고 완료 적은 순) ──
  // overdue=lm월에 마감이 걸렸고 아직 열린 작업, completed=lm월에 done 전이가 있었던 작업.
  const lmStart = new Date(anchorYear(lm), lm - 1, 1).getTime();
  const lmEnd = new Date(anchorYear(lm), lm, 1).getTime();
  const inLm = (ms: number): boolean => ms >= lmStart && ms < lmEnd;
  const taskAssignee = new Map(db.tasks.map((t) => [t.id, t.assigneeId]));
  const doneInLmByUser = new Map<string, number>();
  for (const l of db.statusLogs) {
    if (l.toStatus !== "done") continue;
    if (!inLm(new Date(l.createdAt).getTime())) continue;
    const assignee = taskAssignee.get(l.taskId);
    if (assignee) doneInLmByUser.set(assignee, (doneInLmByUser.get(assignee) ?? 0) + 1);
  }
  const lowPerformers: LowPerformerRow[] = db.users
    .map((u) => {
      const mine = db.tasks.filter((t) => t.assigneeId === u.id);
      return {
        userId: u.id,
        name: u.name,
        department: departmentForUser(u.id),
        avatarColor: u.avatarColor,
        overdue: mine.filter(
          (t) => t.endAt && inLm(new Date(t.endAt).getTime()) && OPEN.has(t.status),
        ).length,
        completed: doneInLmByUser.get(u.id) ?? 0,
      };
    })
    .sort((a, b) => b.overdue - a.overdue || a.completed - b.completed);

  // ── 프로젝트 진행률: project별 완료/전체 ──
  const projectRows: ProjectProgressRow[] = db.projects
    .filter((p) => p.status === "active")
    .map((p) => {
      const tasks = db.tasks.filter((t) => t.projectId === p.id && t.status !== "merged" && t.status !== "cancelled");
      const total = tasks.length;
      const done = tasks.filter((t) => DONE.has(t.status)).length;
      const progress = total === 0 ? 0 : Math.round((done / total) * 100);
      const anyActive = tasks.some((t) => t.status === "in_progress" || t.status === "issue");
      let status: ProjectProgressStatus;
      let statusLabel: string;
      if (progress >= 100) {
        status = "done";
        statusLabel = "완료";
      } else if (anyActive || progress > 0) {
        status = "in_progress";
        statusLabel = "진행 중";
      } else {
        status = "waiting";
        statusLabel = "대기 중";
      }
      const name = formatProjectLabel(p, p.clientId ? clientById.get(p.clientId) : undefined);
      return { id: p.id, name, progress, done, total, status, statusLabel };
    })
    .sort((a, b) => b.progress - a.progress);

  const allLive = liveTasks.length;
  const allDone = liveTasks.filter((t) => DONE.has(t.status)).length;
  const overallProgress = allLive === 0 ? 0 : Math.round((allDone / allLive) * 100);

  const firstMonth = months[0].start;
  const rangeLabel = `${format(firstMonth, "yyyy년 M월 d일")} - ${format(now, "M월 d일")}`;

  return {
    rangeLabel,
    kpis,
    completionByMonth,
    overdueTrend,
    performanceTrend,
    heatmap,
    lowPerformers,
    overallProgress,
    projects: projectRows,
  };
}
