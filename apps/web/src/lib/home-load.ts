import { formatProjectLabel } from "@que/core";
import type { getDb } from "./db";

// 업무 부하(Home/Workload, §A) 산출의 단일 출처 — 홈(직급별)·성과·리포트가 공유한다.
// workflow-trend.ts 선례처럼 조회 계층에서 순수 계산만 담당한다(개인 평가 아님, 배분 조정용).

type Db = Awaited<ReturnType<typeof getDb>>;

/** 열린(집계 대상) 작업 상태 — 부하·과부하 판정 공통 기준. */
export const OPEN = new Set(["scheduled", "in_progress", "needs_reschedule", "on_hold", "issue"]);

/** 주간 가용(과부하 임계) 시간 상수. 예상/가용 비율의 분모이자 남은 가용 계산 기준. */
export const OVERLOAD_HOURS = 40;

/** Home/Workload 한 행 — 업무 배분 조정용(개인 평가 아님, §A). */
export interface HomeLoadRow {
  userId: string;
  name: string;
  /** 예상 소요 시간 합(열린 작업 estimatedHours 합, 미입력은 0). */
  estimatedHours: number;
  /** 주간 가용(상수 40h). */
  capacityHours: number;
  /** 예상/가용 % — 예상 미입력(estimatedHours===0)이면 null(판단 불가). */
  ratio: number | null;
  /** 열린(집계 대상) 작업 수. */
  openTasks: number;
  /** 마감 임박(오늘~7일 내 마감인 열린 작업). */
  dueSoonCount: number;
  /** 홀드(on_hold) 작업 수. */
  holdCount: number;
  /** 영향 프로젝트명 상위 2(열린 작업이 걸린 프로젝트). */
  impactProjects: string[];
}

/** Home/Workload 요약칩(§A). */
export interface HomeLoadSummary {
  /** ratio>=100%. */
  overloadCount: number;
  /** ratio 90~99%. */
  cautionCount: number;
  /** Σ max(0, 40 - 예상) — 이번 주 남은 가용. */
  remainingCapacityHours: number;
  /** 예상시간 미입력 열린 작업 수. */
  noEstimateCount: number;
  /** 열린 작업이 단일 담당자에게만 걸린 활성 프로젝트 수(단일 담당자 의존). */
  soloDependencyCount: number;
}

export interface HomeLoad {
  rows: HomeLoadRow[];
  summary: HomeLoadSummary;
}

/** 업무 부하(Home/Workload, §A). personScope로 스코프(대표=전원/관리=대표 제외/사원=본인).
 *  배분 조정용(평가 아님). 클라이언트 필터를 존중한다. */
export function computeHomeLoad(
  db: Db,
  personIds: string[],
  now: Date,
  clientId?: string,
): HomeLoad {
  const dayStart = new Date(now);
  dayStart.setHours(0, 0, 0, 0);
  const dayStartMs = dayStart.getTime();
  const soon7Ms = dayStartMs + 7 * 864e5;
  const clientTasks = db.tasksForClient(clientId);
  const projectById = new Map(db.projects.map((p) => [p.id, p]));
  const clientById = new Map(db.clients.map((c) => [c.id, c]));
  const projectLabelOf = (projectId?: string): string | null => {
    if (!projectId) return null;
    const p = projectById.get(projectId);
    return p ? formatProjectLabel(p, p.clientId ? clientById.get(p.clientId) : undefined) : null;
  };

  const personSet = new Set(personIds);
  const scopedUsers = db.users.filter((u) => personSet.has(u.id));

  let noEstimateCount = 0;
  const rows: HomeLoadRow[] = scopedUsers.map((u) => {
    const open = clientTasks.filter((t) => t.assigneeId === u.id && OPEN.has(t.status));
    const estimatedHours = open.reduce((sum, t) => sum + (t.estimatedHours ?? 0), 0);
    noEstimateCount += open.filter((t) => t.estimatedHours == null).length;
    const ratio =
      estimatedHours > 0 ? Math.round((estimatedHours / OVERLOAD_HOURS) * 100) : null;
    const dueSoonCount = open.filter((t) => {
      if (!t.endAt) return false;
      const e = new Date(t.endAt).getTime();
      return e >= dayStartMs && e <= soon7Ms;
    }).length;
    const holdCount = open.filter((t) => t.status === "on_hold").length;

    const projCount = new Map<string, number>();
    for (const t of open) {
      const label = projectLabelOf(t.projectId);
      if (label) projCount.set(label, (projCount.get(label) ?? 0) + 1);
    }
    const impactProjects = [...projCount.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 2)
      .map(([name]) => name);

    return {
      userId: u.id,
      name: u.name,
      estimatedHours,
      capacityHours: OVERLOAD_HOURS,
      ratio,
      openTasks: open.length,
      dueSoonCount,
      holdCount,
      impactProjects,
    };
  });

  // 단일 담당자 의존: 열린 작업이 존재하고 그 담당자가 정확히 1명뿐인 활성 프로젝트.
  const activeProjects = db.projects.filter(
    (p) => p.status === "active" && (!clientId || p.clientId === clientId),
  );
  let soloDependencyCount = 0;
  for (const p of activeProjects) {
    const openInProject = clientTasks.filter((t) => t.projectId === p.id && OPEN.has(t.status));
    if (openInProject.length === 0) continue;
    if (new Set(openInProject.map((t) => t.assigneeId)).size === 1) soloDependencyCount += 1;
  }

  return {
    rows,
    summary: {
      overloadCount: rows.filter((r) => r.ratio != null && r.ratio >= 100).length,
      cautionCount: rows.filter((r) => r.ratio != null && r.ratio >= 90 && r.ratio < 100).length,
      remainingCapacityHours: rows.reduce(
        (sum, r) => sum + Math.max(0, OVERLOAD_HOURS - r.estimatedHours),
        0,
      ),
      noEstimateCount,
      soloDependencyCount,
    },
  };
}
