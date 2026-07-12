import "server-only";

import type { Milestone, MockQueDb } from "@que/core";
import { dateKeyOfIso, kstDateKey } from "@/lib/daily-data";

// 마일스톤 안건 원격 진행(기획 §1-c) — AI가 사회자로 안건을 하나씩 제시하는 비동기 진행의 안건 큐.
// 순수 조회(저장 안 함). 진행 화면(다음 에이전트)·긴급 결정 감지가 재사용한다. server-only.
//
// 안건 수집: ⑴위험(주의/지연) 마일스톤 ⑵이번 주 마감 임박 + 각 안건 맥락(관련 작업 진행률·막힘).
// (지난 회의 이월은 후순위라 생략 — 이월 추적 엔티티가 아직 없다.)

const RISK_LABELS: Record<Milestone["riskStatus"], string> = {
  at_risk: "주의",
  late: "지연",
  on_track: "정상",
};

/** 마일스톤 안건 한 건 + 진행 맥락. */
export interface MilestoneAgendaItem {
  id: string;
  title: string;
  projectId: string;
  projectName: string;
  dueAt: string;
  dueDateKey: string;
  riskStatus: Milestone["riskStatus"];
  risk: string;
  /** 왜 안건인가 — 위험 상태 / 마감 임박. */
  reason: "risk" | "due_soon";
  /** 관련 작업 진행률(프로젝트 공유 — done/전체, %). */
  progress: number;
  doneCount: number;
  totalCount: number;
  /** 막힌(issue/on_hold) 관련 작업 수. */
  blockedCount: number;
  /** 막힌 작업 제목(최대 3). */
  blockedTitles: string[];
}

function agendaItem(
  db: MockQueDb,
  m: Milestone,
  reason: MilestoneAgendaItem["reason"],
): MilestoneAgendaItem {
  const project = db.projects.find((p) => p.id === m.projectId);
  const projTasks = db.tasks.filter(
    (t) => t.projectId === m.projectId && t.status !== "cancelled" && t.status !== "merged",
  );
  const doneCount = projTasks.filter((t) => t.status === "done").length;
  const progress = projTasks.length > 0 ? Math.round((doneCount / projTasks.length) * 100) : 0;
  const blocked = projTasks.filter((t) => t.status === "issue" || t.status === "on_hold");
  return {
    id: m.id,
    title: m.title,
    projectId: m.projectId,
    projectName: project?.name ?? "-",
    dueAt: m.dueAt,
    dueDateKey: dateKeyOfIso(m.dueAt),
    riskStatus: m.riskStatus,
    risk: RISK_LABELS[m.riskStatus],
    reason,
    progress,
    doneCount,
    totalCount: projTasks.length,
    blockedCount: blocked.length,
    blockedTitles: blocked.slice(0, 3).map((t) => t.title),
  };
}

/**
 * 마일스톤 안건 큐 수집(조회형). 위험(주의/지연) 마일스톤을 먼저, 그 다음 이번 주 마감 임박(중복 제외).
 * 각 안건에 관련 작업 진행률·막힘 맥락을 붙인다.
 */
export function buildMilestoneAgendaQueue(
  db: MockQueDb,
  now: Date = new Date(),
): MilestoneAgendaItem[] {
  const today = kstDateKey(now);
  const weekEnd = kstDateKey(new Date(now.getTime() + 7 * 864e5));

  const risky = db.milestones
    .filter((m) => m.riskStatus === "at_risk" || m.riskStatus === "late")
    .map((m) => agendaItem(db, m, "risk"))
    .sort((a, b) => a.dueDateKey.localeCompare(b.dueDateKey));

  const riskyIds = new Set(risky.map((m) => m.id));
  const dueSoon = db.milestones
    .filter((m) => {
      if (riskyIds.has(m.id)) return false;
      const key = dateKeyOfIso(m.dueAt);
      return key >= today && key <= weekEnd;
    })
    .map((m) => agendaItem(db, m, "due_soon"))
    .sort((a, b) => a.dueDateKey.localeCompare(b.dueDateKey));

  return [...risky, ...dueSoon];
}
