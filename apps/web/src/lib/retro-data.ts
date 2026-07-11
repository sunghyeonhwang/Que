import "server-only";

import type { MilestoneRetro, MockQueDb, RetroWeekSummary } from "@que/core";
import { retroSummaryForWeek } from "@que/core";
import { getDb } from "./db";

// OS-2a 실패 분류(부록 B) 조회 계층. 마일스톤별 회고·주간 집계·회고 트리거 판정.
// 회고는 프로젝트·마일스톤 단위 — 담당자 이름을 강조하지 않는다(감시 아님). 집계는 core 단일 계산기 재사용.

/** 원인 대분류 라벨. */
export const RETRO_CAUSE_LABELS: Record<MilestoneRetro["cause"], string> = {
  internal: "내부",
  external: "외부",
};

/** 세부 유형 라벨(부록 B). */
export const RETRO_CAUSE_DETAIL_LABELS: Record<MilestoneRetro["causeDetail"], string> = {
  schedule_mgmt: "일정 관리 미흡",
  qa_lack: "QA 부족",
  communication: "커뮤니케이션",
  approval_missed: "승인 누락",
  client_direction: "클라이언트 방향 전환",
  budget_change: "예산 변경",
  schedule_change: "일정 변경",
  event_cancelled: "행사 취소",
  other: "기타",
};

/**
 * 회고 확인 카드 트리거 판정(순수 함수 — UI가 종결 흐름에서 호출).
 * 마일스톤이 late로 종결(riskStatus late)됐거나, 기한을 넘겼는데 아직 위험(주의)이면 회고 대상.
 * (Milestone 스키마에 완료/취소 상태가 없어 riskStatus·dueAt로 근사한다.)
 * 이미 회고가 있는지(중복 방지)는 호출부가 retrosByMilestone로 판단한다.
 */
export function needsRetro(
  milestone: Pick<MockQueDb["milestones"][number], "dueAt" | "riskStatus">,
  now: Date = new Date(),
): boolean {
  if (milestone.riskStatus === "late") return true;
  const overdue = Date.parse(milestone.dueAt) < now.getTime();
  return overdue && milestone.riskStatus === "at_risk";
}

/** 주간 실패 분류 집계(core 단일 계산기 재사용) — meeting-agenda 섹션 ⑴에 주입한다. */
export function retroWeekSummary(db: MockQueDb, now: Date = new Date()): RetroWeekSummary {
  return retroSummaryForWeek(db, now);
}

/** 특정 마일스톤의 회고 목록(최신순). */
export async function getMilestoneRetros(milestoneId: string): Promise<MilestoneRetro[]> {
  const db = await getDb();
  return db.retrosByMilestone(milestoneId);
}

/** 이번(지난 7일) 주간 집계 — 화면/리포트 소비용. */
export async function getRetroWeekSummary(now: Date = new Date()): Promise<RetroWeekSummary> {
  const db = await getDb();
  return retroSummaryForWeek(db, now);
}
