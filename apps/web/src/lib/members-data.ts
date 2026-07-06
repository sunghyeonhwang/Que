import { format, startOfWeek, subWeeks } from "date-fns";
import { ko } from "date-fns/locale";
import { departmentForUser, emailForUser, rankForUser, type Task, type User } from "@que/core";
import { getDb } from "./db";
import type { PerformancePoint } from "./performance-data";

// 팀 화면(/members)용 조회 전용 집계 — 팀 개요 KPI + 멤버 상세.
// team-data.ts / heatmap-data.ts와 동일한 "활성 작업" 기준을 공유한다.

/** 진행 흐름에 남아 있는(취소/병합/완료가 아닌) 작업 상태 */
const ACTIVE = new Set(["scheduled", "in_progress", "needs_reschedule", "on_hold", "issue"]);

/** 로컬 날짜 기준 같은 날 판정 (오늘 활동 집계용) */
function isSameDay(iso: string, now: Date): boolean {
  const d = new Date(iso);
  return (
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  );
}

// ─────────────────────────────────────────────────────────────────────────
// 팀(/members) 재작업용 조회 계층: 팀 개요 KPI + 멤버 상세.
// performance-data.ts(주별 completed/created/overdue) / heatmap-data.ts(intensity)의
// 계산 패턴을 이 멤버 스코프로 재사용한다. 전부 서버에서 계산하고 PII는 다루지 않는다.
// ─────────────────────────────────────────────────────────────────────────

/** performance-data.ts와 동일한 "진행 중(열림)" 상태 집합 — 기한 초과/created 판정에 쓴다 */
const OPEN = new Set(["scheduled", "in_progress", "needs_reschedule", "on_hold", "issue"]);
/** heatmap-data.ts와 동일하게 히트맵 셀에 계상하는 상태 */
const HEAT_COUNTED = new Set([
  "scheduled",
  "in_progress",
  "needs_reschedule",
  "on_hold",
  "issue",
  "done",
]);

/** 작업 상태 → 한국어 라벨 (활동 로그 요약용) */
const STATUS_LABEL: Record<string, string> = {
  scheduled: "예정",
  in_progress: "진행중",
  done: "완료",
  needs_reschedule: "시간변경필요",
  on_hold: "홀드",
  issue: "문제발생",
  cancelled: "취소",
  merged: "병합",
};

/** YYYY-MM-DD 로컬 날짜 키 */
function dayKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** heatmap-data.ts의 toIntensity와 동일 임계값 (0~4) */
function toIntensity(score: number): number {
  if (score <= 0) return 0;
  if (score <= 2) return 1;
  if (score <= 4) return 2;
  if (score <= 6) return 3;
  return 4;
}

/** 분/시간/일 전 상대 시각 표기 */
function formatRelative(iso: string, now: Date): string {
  const diffMs = now.getTime() - new Date(iso).getTime();
  const min = Math.floor(diffMs / 60000);
  if (min < 1) return "방금 전";
  if (min < 60) return `${min}분 전`;
  const hours = Math.floor(min / 60);
  if (hours < 24) return `${hours}시간 전`;
  const days = Math.floor(hours / 24);
  return `${days}일 전`;
}

// ── 팀 개요 ──

export interface TeamKpis {
  totalMembers: number;
  activeToday: number;
  totalDepartments: number;
  avgCompletedPerWeek: number;
}

export interface TeamMemberCard {
  id: string;
  name: string;
  email: string;
  department: string;
  rank: string;
  role: "admin" | "member";
  avatarColor: string;
}

export interface TeamOverview {
  kpis: TeamKpis;
  members: TeamMemberCard[];
}

/** 팀 카드 목록 + 개요 KPI. 조회 전용. */
export async function getTeamOverview(now?: Date): Promise<TeamOverview> {
  const at = now ?? new Date();
  const db = await getDb();

  // 활성 팀 명단만(비활성=퇴사/정지는 제외). 과거 작업의 이름 표시는 다른 경로에서 유지된다.
  const activeUsers = db.users.filter((u) => u.active !== false);

  // 카드: 프로필(비-PII)만
  const members: TeamMemberCard[] = activeUsers.map((user) => ({
    id: user.id,
    name: user.name,
    email: emailForUser(user.id),
    department: departmentForUser(user),
    rank: rankForUser(user),
    role: user.role,
    avatarColor: user.avatarColor,
  }));

  // taskId → assigneeId (status_log는 담당자를 직접 갖지 않으므로 작업으로 되짚는다)
  const assigneeOfTask = new Map<string, string>();
  for (const t of db.tasks) assigneeOfTask.set(t.id, t.assigneeId);

  // 오늘 status_log가 있는 멤버
  const activeIds = new Set<string>();
  for (const log of db.statusLogs) {
    if (!isSameDay(log.createdAt, at)) continue;
    const assignee = assigneeOfTask.get(log.taskId);
    if (assignee) activeIds.add(assignee);
  }
  // 오늘 시작/마감인 활성 작업이 있는 멤버
  for (const t of db.tasks) {
    if (!ACTIVE.has(t.status)) continue;
    if ((t.startAt && isSameDay(t.startAt, at)) || (t.endAt && isSameDay(t.endAt, at))) {
      activeIds.add(t.assigneeId);
    }
  }

  // 부서 고유값(비어있지 않은 것) — 활성 명단 기준
  const departments = new Set<string>();
  for (const user of activeUsers) {
    const dept = departmentForUser(user);
    if (dept) departments.add(dept);
  }

  // 최근 6주 done 전이 합 / 6
  const sixWeeksAgo = at.getTime() - 6 * 7 * 864e5;
  const doneLast6w = db.statusLogs.filter(
    (l) => l.toStatus === "done" && new Date(l.createdAt).getTime() >= sixWeeksAgo,
  ).length;

  const kpis: TeamKpis = {
    totalMembers: activeUsers.length,
    activeToday: activeIds.size,
    totalDepartments: departments.size,
    avgCompletedPerWeek: Math.round(doneLast6w / 6),
  };

  return { kpis, members };
}

// ── 멤버 상세 ──

export type MemberActivityKind = "completed" | "created" | "updated" | "status";

export interface MemberActivity {
  id: string;
  kind: MemberActivityKind;
  title: string;
  description: string;
  relative: string;
}

export interface MemberHeatCell {
  date: string;
  count: number;
  hours: number;
  intensity: number; // 0..4
}

export interface MemberInfoField {
  icon: "dept" | "rank" | "role" | "email";
  label: string;
  value: string;
}

export interface MemberDetail {
  user: User;
  email: string;
  department: string;
  rank: string;
  roleLabel: string; // 관리자 / 팀원
  infoFields: MemberInfoField[]; // 정확히 4개: 부서/직급/역할/이메일 (PII 없음)
  activeTotal: number;
  completedTotal: number;
  activities: MemberActivity[]; // 최신순, 최대 6개
  heatmap: { cells: MemberHeatCell[]; monthLabel: string; totalCount: number; weeks: number };
  performanceTrend: PerformancePoint[]; // 이 멤버 스코프의 주별 3계열, 8주
}

/** 멤버 1인 상세. 없는 id면 null. 조회 전용 · PII 없음. */
export async function getMemberDetail(id: string, now?: Date): Promise<MemberDetail | null> {
  const at = now ?? new Date();
  const db = await getDb();

  const user = db.users.find((u) => u.id === id);
  if (!user) return null;

  const email = emailForUser(user.id);
  const department = departmentForUser(user);
  const rank = rankForUser(user);
  const roleLabel = user.role === "admin" ? "관리자" : "팀원";

  // 정확히 4개 필드 — 부서/직급/역할/이메일. 전화·생년월일·위치 등 PII는 넣지 않는다.
  const infoFields: MemberInfoField[] = [
    { icon: "dept", label: "부서", value: department || "미지정" },
    { icon: "rank", label: "직급", value: rank },
    { icon: "role", label: "역할", value: roleLabel },
    { icon: "email", label: "이메일", value: email },
  ];

  const myTasks = db.tasks.filter((t) => t.assigneeId === user.id);
  const myTaskIds = new Set(myTasks.map((t) => t.id));
  const activeTotal = myTasks.filter((t) => ACTIVE.has(t.status)).length;
  const completedTotal = myTasks.filter((t) => t.status === "done").length;
  const titleOf = (taskId: string): string =>
    db.tasks.find((t) => t.id === taskId)?.title ?? "작업";

  // ── 활동: 이 멤버 작업의 status_log를 최신순으로 최대 6개 ──
  // performance-data.ts와 동일하게, 각 작업의 가장 이른 로그를 "생성"으로 본다.
  const earliestLogId = new Map<string, string>();
  const earliestLogMs = new Map<string, number>();
  for (const log of db.statusLogs) {
    if (!myTaskIds.has(log.taskId)) continue;
    const t = new Date(log.createdAt).getTime();
    const prev = earliestLogMs.get(log.taskId);
    if (prev === undefined || t < prev) {
      earliestLogMs.set(log.taskId, t);
      earliestLogId.set(log.taskId, log.id);
    }
  }
  const activities: MemberActivity[] = db.statusLogs
    .filter((l) => myTaskIds.has(l.taskId))
    .slice()
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 6)
    .map((log) => {
      const taskTitle = titleOf(log.taskId);
      const from = STATUS_LABEL[log.fromStatus] ?? log.fromStatus;
      const to = STATUS_LABEL[log.toStatus] ?? log.toStatus;
      let kind: MemberActivityKind;
      let title: string;
      if (log.toStatus === "done") {
        kind = "completed";
        title = "작업 완료";
      } else if (earliestLogId.get(log.taskId) === log.id) {
        kind = "created";
        title = "작업 생성됨";
      } else {
        kind = "status";
        title = "상태 변경";
      }
      const description =
        kind === "created" ? `${taskTitle} · ${to}` : `${taskTitle} · ${from} → ${to}`;
      return { id: log.id, kind, title, description, relative: formatRelative(log.createdAt, at) };
    });

  // ── 히트맵: 최근 35일(오늘 포함 과거 5주), 멤버 스코프 ──
  // heatmap-data.ts와 동일 가중치(문제/홀드/마감 임박) + 시간 합 → intensity 0..4.
  const heatCells: MemberHeatCell[] = [];
  for (let i = 34; i >= 0; i -= 1) {
    const d = new Date(at);
    d.setDate(d.getDate() - i);
    const key = dayKey(d);
    const dayTasks = myTasks.filter(
      (t) => t.startAt && HEAT_COUNTED.has(t.status) && dayKey(new Date(t.startAt)) === key,
    );
    const hours = dayTasks.reduce((sum, t) => sum + (t.estimatedHours ?? 1), 0);
    const weight = dayTasks.reduce((sum, t) => {
      let w = 0;
      if (t.status === "issue") w += 2;
      if (t.status === "on_hold") w += 1;
      if (t.endAt && dayKey(new Date(t.endAt)) === key && t.status !== "done") w += 1;
      return sum + w;
    }, 0);
    heatCells.push({
      date: key,
      count: dayTasks.length,
      hours,
      intensity: toIntensity(hours + weight),
    });
  }
  const heatmap = {
    cells: heatCells,
    monthLabel: format(at, "M월", { locale: ko }),
    totalCount: heatCells.reduce((sum, c) => sum + c.count, 0),
    weeks: 5,
  };

  // ── 주별 성과(8주): performance-data.ts의 주별 로직을 이 멤버 tasks/logs로 필터링 ──
  const earliestAnyLog = new Map<string, number>();
  for (const log of db.statusLogs) {
    if (!myTaskIds.has(log.taskId)) continue;
    const t = new Date(log.createdAt).getTime();
    const prev = earliestAnyLog.get(log.taskId);
    if (prev === undefined || t < prev) earliestAnyLog.set(log.taskId, t);
  }
  const creationMs = (task: Task): number | undefined => {
    const fromLog = earliestAnyLog.get(task.id);
    if (fromLog !== undefined) return fromLog;
    const iso = task.startAt ?? task.endAt;
    return iso ? new Date(iso).getTime() : undefined;
  };
  const liveTasks = myTasks.filter((t) => t.status !== "cancelled" && t.status !== "merged");

  const weekBuckets: { start: number; end: number; label: string }[] = [];
  for (let i = 7; i >= 0; i -= 1) {
    const start = startOfWeek(subWeeks(at, i), { weekStartsOn: 1 });
    const end = startOfWeek(subWeeks(at, i - 1), { weekStartsOn: 1 });
    weekBuckets.push({ start: start.getTime(), end: end.getTime(), label: format(start, "M/d") });
  }
  const performanceTrend: PerformancePoint[] = weekBuckets.map(({ start, end, label }) => {
    const completed = db.statusLogs.filter(
      (l) =>
        myTaskIds.has(l.taskId) &&
        l.toStatus === "done" &&
        new Date(l.createdAt).getTime() >= start &&
        new Date(l.createdAt).getTime() < end,
    ).length;
    const created = liveTasks.filter((t) => {
      const c = creationMs(t);
      return c !== undefined && c >= start && c < end;
    }).length;
    const overdue = myTasks.filter((t) => {
      if (!t.endAt) return false;
      const e = new Date(t.endAt).getTime();
      return e >= start && e < end && OPEN.has(t.status);
    }).length;
    return { label, completed, created, overdue };
  });

  return {
    user,
    email,
    department,
    rank,
    roleLabel,
    infoFields,
    activeTotal,
    completedTotal,
    activities,
    heatmap,
    performanceTrend,
  };
}
