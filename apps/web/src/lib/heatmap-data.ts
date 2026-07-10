import type { User } from "@que/core";
import { getDb } from "./db";

// 작업량 히트맵 (기획서 "작업량 히트맵").
// 단순 작업 수가 아니라 예상 소요 시간 + 문제/홀드/마감 임박 가중치를 반영한다.
// 개인 평가가 아니라 업무 배분/병목 조정용이다.

export interface HeatCell {
  date: string; // YYYY-MM-DD
  hours: number;
  taskCount: number;
  score: number;
  /** 0(없음)~4(과부하) */
  intensity: number;
}

export interface HeatRow {
  user: User;
  cells: HeatCell[];
}

export interface HeatmapData {
  days: string[];
  rows: HeatRow[];
}

function toIntensity(score: number): number {
  if (score <= 0) return 0;
  if (score <= 2) return 1;
  if (score <= 4) return 2;
  if (score <= 6) return 3;
  return 4;
}

const COUNTED = new Set(["scheduled", "in_progress", "needs_reschedule", "on_hold", "issue", "done"]);

export interface HeatmapOptions {
  /** 지정 시 그 달의 1일~말일 전체를 days로 만든다(월 단위 히트맵). 없으면 now부터 7일. */
  monthAnchor?: Date;
  /** 클라이언트 필터. 지정 시 그 클라이언트 소속 프로젝트 작업만 집계(무소속 제외). */
  clientId?: string;
  /** 사람 스코프(userId 화이트리스트). 지정 시 이 userId들만 rows로 만든다(대표=전원/관리=대표
   *  제외/사원=본인). 세션 grade에서만 유도한다(URL로 확대 불가). 미지정이면 전원. */
  personScope?: string[];
}

export async function getHeatmapData(
  now: Date = new Date(),
  opts: HeatmapOptions = {},
): Promise<HeatmapData> {
  const db = await getDb();
  // 히트맵의 모든 셀 강도·부하 집계 소스. clientId 미지정이면 전체 작업.
  const clientTasks = db.tasksForClient(opts.clientId);
  const days: string[] = [];
  if (opts.monthAnchor) {
    // 월 단위: 앵커 달의 1일~말일 각 날짜 셀.
    const y = opts.monthAnchor.getFullYear();
    const m = opts.monthAnchor.getMonth();
    const lastDay = new Date(y, m + 1, 0).getDate();
    for (let day = 1; day <= lastDay; day += 1) {
      const d = new Date(y, m, day);
      days.push(
        `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`,
      );
    }
  } else {
    // 하위호환: now부터 7일 그리드.
    for (let i = 0; i < 7; i += 1) {
      const d = new Date(now);
      d.setDate(d.getDate() + i);
      days.push(
        `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`,
      );
    }
  }
  const dayOf = (iso: string): string => {
    const d = new Date(iso);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  };

  // 사람 스코프: 지정 시 화이트리스트 userId만 rows로(부하 노출 범위 = 직급 스코프). 순서는
  // db.users 원 순서를 유지한다. 미지정이면 전원.
  const personSet = opts.personScope ? new Set(opts.personScope) : undefined;
  const scopedUsers = personSet ? db.users.filter((u) => personSet.has(u.id)) : db.users;

  const rows: HeatRow[] = scopedUsers.map((user) => {
    const cells: HeatCell[] = days.map((date) => {
      const dayTasks = clientTasks.filter(
        (t) =>
          t.assigneeId === user.id &&
          t.startAt &&
          COUNTED.has(t.status) &&
          dayOf(t.startAt) === date,
      );
      const hours = dayTasks.reduce((sum, t) => sum + (t.estimatedHours ?? 1), 0);
      const weight = dayTasks.reduce((sum, t) => {
        let w = 0;
        if (t.status === "issue") w += 2;
        if (t.status === "on_hold") w += 1;
        if (t.endAt && dayOf(t.endAt) === date && t.status !== "done") w += 1;
        return sum + w;
      }, 0);
      const score = hours + weight;
      return { date, hours, taskCount: dayTasks.length, score, intensity: toIntensity(score) };
    });

    return { user, cells };
  });

  return { days, rows };
}
