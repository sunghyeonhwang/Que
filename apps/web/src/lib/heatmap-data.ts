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
  totalScore: number;
  totalHours: number;
  issueOrHold: number;
}

export interface HeatmapData {
  days: string[];
  rows: HeatRow[];
  maxTotal: number;
  overloaded: string[];
  relaxed: string[];
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
}

export async function getHeatmapData(
  now: Date = new Date(),
  opts: HeatmapOptions = {},
): Promise<HeatmapData> {
  const db = await getDb();
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

  const rows: HeatRow[] = db.users.map((user) => {
    const cells: HeatCell[] = days.map((date) => {
      const dayTasks = db.tasks.filter(
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

    return {
      user,
      cells,
      totalScore: cells.reduce((sum, c) => sum + c.score, 0),
      totalHours: cells.reduce((sum, c) => sum + c.hours, 0),
      issueOrHold: db.tasks.filter(
        (t) => t.assigneeId === user.id && (t.status === "issue" || t.status === "on_hold"),
      ).length,
    };
  });

  const totals = rows.map((r) => r.totalScore);
  const maxTotal = Math.max(...totals, 1);
  const avg = totals.reduce((a, b) => a + b, 0) / rows.length;

  return {
    days,
    rows,
    maxTotal,
    overloaded: rows
      .filter((r) => r.totalScore >= Math.max(avg * 1.5, 6))
      .map((r) => r.user.name),
    relaxed: rows.filter((r) => r.totalScore <= avg * 0.4).map((r) => r.user.name),
  };
}
