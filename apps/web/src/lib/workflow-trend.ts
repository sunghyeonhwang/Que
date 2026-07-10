import { format } from "date-fns";
import type { getDb } from "./db";

// 주별 업무 흐름(신규·완료·기한초과) + 순증 산출 — 홈(Home/WorkflowTrend)과 팀 리포트(업무 흐름 카드)가
// 공유하는 단일 출처. 중복 구현을 막고 '신규=최초 상태로그(생성 프록시)' 관례를 한 곳에서 강제한다.

type Db = Awaited<ReturnType<typeof getDb>>;

/** Home/WorkflowTrend 주별 한 점. PerformancePoint와 키가 호환된다(라인 차트 공용). */
export interface WorkflowWeek {
  /** 날짜 구간 "MM.DD-MM.DD". */
  label: string;
  /** 신규(해당 주 최초 상태로그 = 생성 시각). */
  created: number;
  /** 완료(해당 주 done 전이). */
  completed: number;
  /** 기한초과(해당 주 마감인데 기한 내 완료 못 한 작업). */
  overdue: number;
}

export interface WorkflowTrend {
  weeks: WorkflowWeek[];
  /** 창 크기(주). 4|8|12. */
  weeksBack: number;
  /** 이번 주 순증 = 이번 주 신규 - 완료. 음수 가능(적체 감소). */
  netChange: number;
  /** "이번 주 순증 -2 (적체 감소)" 배지 문구. */
  netLabel: string;
}

/** 주별 업무 흐름(신규·완료·기한초과) + 순증(Home/WorkflowTrend·리포트 업무 흐름). 클라이언트 필터 존중. */
export function computeWorkflowTrend(
  db: Db,
  now: Date,
  weeksBack: number,
  clientId?: string,
): WorkflowTrend {
  const clientTasks = db.tasksForClient(clientId);
  const clientTaskIds = new Set(clientTasks.map((t) => t.id));
  const inClient = (taskId: string): boolean => !clientId || clientTaskIds.has(taskId);

  // 작업 생성 시각 프록시 = 그 작업의 최초 상태로그 createdAt(Task에 createdAt 컬럼 없음).
  const firstLogAt = new Map<string, number>();
  for (const l of db.statusLogs) {
    const t = new Date(l.createdAt).getTime();
    const prev = firstLogAt.get(l.taskId);
    if (prev === undefined || t < prev) firstLogAt.set(l.taskId, t);
  }
  // 작업별 기한 내 완료 여부(마감 이전에 done 전이가 있었나).
  const onTimeDone = new Set<string>();
  for (const l of db.statusLogs.filter((l) => l.toStatus === "done")) {
    if (clientId && !clientTaskIds.has(l.taskId)) continue;
    const task = db.tasks.find((x) => x.id === l.taskId);
    if (task?.endAt && new Date(l.createdAt).getTime() <= new Date(task.endAt).getTime()) {
      onTimeDone.add(l.taskId);
    }
  }

  const weeks: WorkflowWeek[] = [];
  for (let w = weeksBack - 1; w >= 0; w -= 1) {
    const wEnd = new Date(now);
    wEnd.setDate(wEnd.getDate() - w * 7);
    wEnd.setHours(23, 59, 59, 999);
    const wStart = new Date(wEnd);
    wStart.setDate(wStart.getDate() - 6);
    wStart.setHours(0, 0, 0, 0);
    const sMs = wStart.getTime();
    const eMs = wEnd.getTime();
    const inWeek = (ms: number): boolean => ms >= sMs && ms <= eMs;

    const created = [...firstLogAt.entries()].filter(
      ([id, ms]) => inClient(id) && inWeek(ms),
    ).length;
    const completed = db.statusLogs.filter(
      (l) => l.toStatus === "done" && inClient(l.taskId) && inWeek(new Date(l.createdAt).getTime()),
    ).length;
    const overdue = clientTasks.filter(
      (t) => t.endAt && inWeek(new Date(t.endAt).getTime()) && !onTimeDone.has(t.id),
    ).length;

    weeks.push({
      label: `${format(wStart, "MM.dd")}-${format(wEnd, "MM.dd")}`,
      created,
      completed,
      overdue,
    });
  }

  const last = weeks[weeks.length - 1];
  const netChange = last ? last.created - last.completed : 0;
  const netLabel =
    netChange > 0
      ? `이번 주 순증 +${netChange} (적체 증가)`
      : netChange < 0
        ? `이번 주 순증 ${netChange} (적체 감소)`
        : "이번 주 순증 0 (변화 없음)";
  return { weeks, weeksBack, netChange, netLabel };
}
