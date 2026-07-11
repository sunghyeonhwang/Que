import "server-only";

import type { ChangeRequest, ChangeRequestStage, MockQueDb } from "@que/core";
import { getDb } from "./db";

// OS-2b 외부 변경 접수(부록 C) 조회 계층. 진행 중 목록 + SLA 마감 카운트다운 파생.
// /daily 상단 "진행 중 변경 대응" 카드(단계 프로그레스·마감 카운트다운)와 주간 회의 ⑷(미결)이 소비한다.

/** 5단계 순서(프로그레스 인덱스 계산용). */
export const CHANGE_REQUEST_STAGE_ORDER: ChangeRequestStage[] = [
  "received",
  "impact_analyzed",
  "renegotiated",
  "approved",
  "closed",
];

/** 단계 라벨. */
export const CHANGE_REQUEST_STAGE_LABELS: Record<ChangeRequestStage, string> = {
  received: "접수",
  impact_analyzed: "영향 분석",
  renegotiated: "재협의",
  approved: "승인",
  closed: "종결",
};

/** 단계 로그 1건에 사람 이름을 붙인 표시용. */
export interface ChangeRequestStageLogView {
  stage: ChangeRequestStage;
  at: string;
  byName: string;
}

export interface ChangeRequestView {
  changeRequest: ChangeRequest;
  projectName: string;
  milestoneTitle?: string;
  /** 0-based 단계 인덱스(프로그레스 바). */
  stageIndex: number;
  /** 전체 단계 수(종결 제외 진행 4단계 + 종결). */
  stageTotal: number;
  /** SLA(영향 분석 마감)까지 남은 밀리초. 음수면 초과. */
  msRemaining: number;
  /** SLA 초과 여부. */
  overdue: boolean;
  /** 남은 시간 라벨(예: "12시간 20분", "초과 3시간"). */
  countdownLabel: string;
  /** 연결 프로젝트의 관련 작업 수(취소·병합 제외). */
  relatedTaskCount: number;
  /** 단계 로그(사람 이름 해석) — 완료 단계별 언제·누가 표시용. */
  stageLog: ChangeRequestStageLogView[];
}

/** ms → 사람이 읽는 시/분 라벨. */
function humanizeDuration(ms: number): string {
  const abs = Math.abs(ms);
  const hours = Math.floor(abs / (60 * 60 * 1000));
  const minutes = Math.floor((abs % (60 * 60 * 1000)) / (60 * 1000));
  if (hours > 0) return `${hours}시간 ${minutes}분`;
  return `${minutes}분`;
}

/** ChangeRequest → 카운트다운·프로그레스 파생 뷰. */
export function toChangeRequestView(
  db: MockQueDb,
  cr: ChangeRequest,
  now: Date,
): ChangeRequestView {
  const project = db.projects.find((p) => p.id === cr.projectId);
  const milestone = cr.milestoneId ? db.milestones.find((m) => m.id === cr.milestoneId) : undefined;
  const msRemaining = Date.parse(cr.impactDeadline) - now.getTime();
  // overdue(빨간 강조)도 received 단계에서만 — 분석 완료 건에 색으로 거짓말하지 않는다(게이트 잔여 Low).
  const overdue = cr.stage === "received" && msRemaining < 0;
  const nameOf = (id: string): string => db.users.find((u) => u.id === id)?.name ?? id;
  const relatedTaskCount = db.tasks.filter(
    (t) => t.projectId === cr.projectId && t.status !== "cancelled" && t.status !== "merged",
  ).length;
  return {
    changeRequest: cr,
    projectName: project?.name ?? "-",
    milestoneTitle: milestone?.title,
    stageIndex: CHANGE_REQUEST_STAGE_ORDER.indexOf(cr.stage),
    stageTotal: CHANGE_REQUEST_STAGE_ORDER.length,
    msRemaining,
    overdue,
    // SLA 카운트다운은 영향 분석 전(received)에만 의미가 있다 — 분석 완료 이후 단계에서
    // "N시간 초과"를 표기하면 허위 경보(게이트 High-1과 같은 뿌리). 이후 단계는 단계명만.
    countdownLabel:
      cr.stage === "received"
        ? msRemaining >= 0
          ? `${humanizeDuration(msRemaining)} 남음`
          : `초과 ${humanizeDuration(msRemaining)}`
        : cr.stage === "closed"
          ? "종결"
          : "영향 분석 완료",
    relatedTaskCount,
    stageLog: cr.stageLog.map((l) => ({ stage: l.stage, at: l.at, byName: nameOf(l.by) })),
  };
}

/** 진행 중(종결 전) 변경 대응 목록 — 마감 임박순(남은 시간 오름차순). */
export async function getOpenChangeRequests(now: Date = new Date()): Promise<ChangeRequestView[]> {
  const db = await getDb();
  return db
    .openChangeRequests()
    .map((cr) => toChangeRequestView(db, cr, now))
    .sort((a, b) => a.msRemaining - b.msRemaining);
}
