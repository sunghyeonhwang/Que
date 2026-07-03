import { emailForUser, rankForUser, type Task, type User } from "@que/core";
import { getDb } from "./db";

// 팀 화면(/members)용 조회 전용 집계. 팀원 카드 + 오늘 업무 요약.
// team-data.ts / heatmap-data.ts와 동일한 "활성 작업" 기준을 공유한다.

/** 진행 흐름에 남아 있는(취소/병합/완료가 아닌) 작업 상태 */
const ACTIVE = new Set(["scheduled", "in_progress", "needs_reschedule", "on_hold", "issue"]);

export interface MemberSummary {
  /** 진행중(in_progress) 작업 수 */
  inProgress: number;
  /** 문제발생(issue) 작업 수 */
  issues: number;
  /** 홀드(on_hold) 작업 수 */
  onHold: number;
  /** 오늘 시작 또는 마감 예정인 활성 작업 수 */
  dueToday: number;
  /** 활성 작업 전체 수 */
  activeTotal: number;
  /** 활성 작업의 예상 소요시간 합(estimatedHours가 있는 작업만 합산) */
  estimatedHours: number;
}

export interface MemberCard {
  user: User;
  email: string;
  rank: string;
  summary: MemberSummary;
}

function isSameDay(iso: string, now: Date): boolean {
  const d = new Date(iso);
  return (
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  );
}

function summarize(tasks: Task[], now: Date): MemberSummary {
  const active = tasks.filter((t) => ACTIVE.has(t.status));
  return {
    inProgress: active.filter((t) => t.status === "in_progress").length,
    issues: active.filter((t) => t.status === "issue").length,
    onHold: active.filter((t) => t.status === "on_hold").length,
    dueToday: active.filter(
      (t) =>
        (t.startAt && isSameDay(t.startAt, now)) || (t.endAt && isSameDay(t.endAt, now)),
    ).length,
    activeTotal: active.length,
    estimatedHours: active.reduce((sum, t) => sum + (t.estimatedHours ?? 0), 0),
  };
}

/** db.users 순서대로 각 멤버의 프로필 + 오늘 업무 요약을 계산한다. */
export async function getMembersData(now: Date = new Date()): Promise<MemberCard[]> {
  const db = await getDb();
  return db.users.map((user) => {
    const tasks = db.tasks.filter((t) => t.assigneeId === user.id);
    return {
      user,
      email: emailForUser(user.id),
      rank: rankForUser(user.id),
      summary: summarize(tasks, now),
    };
  });
}
