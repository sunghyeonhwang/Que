import "server-only";

import type { MockQueDb, NotificationIntent } from "@que/core";
import { computeGanttRisk } from "@/lib/projects-data";
import { changeRequestSlaState } from "@que/core";
import { kstDateKey } from "@/lib/daily-data";
import { appBaseUrl, personalDigestEnabled } from "./config";
import { enqueueAndSend, type DispatchCounts } from "./dispatch";

// 긴급 결정 워크플로(기획 §1-e) — 회의가 아니라 응답을 요구하는 결정 절차. AI(크론)가 감지·발송·추적.
// server-only. 카드 남발이 곧 무시로 이어지므로 상한(하루 3건)·dedup·에스컬레이션이 본질이다.
//
// 트리거 3종:
//  ⑴ 마일스톤 riskStatus가 late로 전환(오늘)
//  ⑵ computeGanttRisk가 마일스톤 관련 작업 위험 감지
//  ⑶ 마감 D-2 이내인데 관련 작업 완료율 < 50%
// 수신자: 마일스톤 담당(프로젝트 owner) + 프로젝트 PM(같으면 1인) + admin 1인.
// dedup 접두 `crisis:<milestoneId>:<KST날짜>`(마일스톤·날짜당 이벤트 1회). 다수 수신자 발송을 위해
//   실제 아웃박스 행 키는 수신자를 marker에 덧붙여 `crisis:<mid>:<date>:<recipientId>`로 개별화한다.
// 에스컬레이션: 2h 미해결→재촉(crisis_remind), 4h 미해결→admin·대표(crisis_esc). 해결=발송 후 마일스톤
//   변경(ChangeLog) 또는 트리거 해소.

const KST_OFFSET_MS = 9 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;
const CRISIS_DAILY_CAP = 3; // 하루 최대 신규 크라이시스 마일스톤 수
const REMIND_AFTER_MS = 2 * 60 * 60 * 1000; // 2h 미해결 재촉
const ESCALATE_AFTER_MS = 4 * 60 * 60 * 1000; // 4h 미해결 에스컬레이션
const LOW_PROGRESS_THRESHOLD = 50; // ⑶ 완료율 임계(%)

/** 감지된 긴급 결정 트리거 1건 + 맥락. */
export interface CrisisTrigger {
  milestoneId: string;
  title: string;
  projectId: string;
  projectName: string;
  dueAt: string;
  dueDateKey: string;
  reason: "late" | "predecessor_risk" | "due_soon_low_progress";
  reasonText: string;
  progress: number;
  doneCount: number;
  totalCount: number;
  /** 결정 카드 수신자(마일스톤 담당/PM + admin). */
  recipientIds: string[];
}

/** ISO의 KST 날짜 키. */
function dateKeyOfIso(iso: string): string {
  const ms = Date.parse(iso);
  if (Number.isNaN(ms)) return "";
  return kstDateKey(new Date(ms));
}

/** now의 KST 날짜 키. */
function todayKey(now: Date): string {
  return kstDateKey(now);
}

/** now의 KST 요일(0=일..6=토) — 평일 게이트용. */
function kstDayOfWeek(now: Date): number {
  return new Date(now.getTime() + KST_OFFSET_MS).getUTCDay();
}

/** 결정 카드 수신자 계산 — 마일스톤 담당(프로젝트 owner=PM) + admin 1인(owner와 다르면).
 *  기획 §1-e: **대표는 초기 수신자가 아니라 에스컬레이션 대상** — 여기서는 대표를 제외한다
 *  (owner가 대표 본인인 경우는 담당 자격으로 포함). */
function decisionRecipients(db: MockQueDb, ownerId: string | undefined): string[] {
  const ids: string[] = [];
  const owner = ownerId ? db.users.find((u) => u.id === ownerId && u.active !== false) : undefined;
  if (owner) ids.push(owner.id);
  const admin = db.users.find(
    (u) => u.role === "admin" && u.active !== false && u.id !== ownerId && u.rank !== "대표",
  );
  if (admin) ids.push(admin.id);
  return [...new Set(ids)];
}

/** 에스컬레이션 수신자 — admin(PM 외 1인) + 대표. */
function escalationRecipients(db: MockQueDb, ownerId: string | undefined): string[] {
  const ids: string[] = [];
  const admin = db.users.find(
    (u) => u.role === "admin" && u.active !== false && u.id !== ownerId,
  );
  if (admin) ids.push(admin.id);
  const ceo = db.users.find((u) => u.rank === "대표" && u.active !== false);
  if (ceo) ids.push(ceo.id);
  return [...new Set(ids)];
}

/**
 * 긴급 결정 트리거 감지(순수 조회). 3종 트리거를 우선순위(지연 > 선행 위험 > 마감 임박·저진행)로 판정한다.
 * 각 마일스톤은 최대 1건(가장 심각한 사유)만 낸다.
 */
export function detectCrisisTriggers(db: MockQueDb, now: Date = new Date()): CrisisTrigger[] {
  const today = todayKey(now);
  const nowMs = now.getTime();
  const taskById = new Map(db.tasks.map((t) => [t.id, t]));
  const risks = computeGanttRisk(db.tasks, taskById, now.toISOString());

  const triggers: CrisisTrigger[] = [];
  for (const m of db.milestones) {
    // 오늘 이미 결정(유지/연기/보류)된 마일스톤은 재감지하지 않는다 — 결정 직후에도 카드·DM이
    // 남아 "눌러도 그대로"로 보이던 실사용 버그(2026-07-12). 내일 여전히 위험하면 다시 뜬다.
    if (m.lastDecisionAt && dateKeyOfIso(m.lastDecisionAt) === today) continue;
    const project = db.projects.find((p) => p.id === m.projectId);
    const projTasks = db.tasks.filter(
      (t) => t.projectId === m.projectId && t.status !== "cancelled" && t.status !== "merged",
    );
    const doneCount = projTasks.filter((t) => t.status === "done").length;
    const progress = projTasks.length > 0 ? Math.round((doneCount / projTasks.length) * 100) : 0;

    let reason: CrisisTrigger["reason"] | null = null;
    let reasonText = "";

    // ⑴ 오늘 late로 전환.
    if (m.riskStatus === "late" && m.lastChangedAt && dateKeyOfIso(m.lastChangedAt) === today) {
      reason = "late";
      reasonText = "마일스톤이 오늘 '지연'으로 전환됐습니다.";
    }
    // ⑵ 선행 작업 지연으로 관련 작업 위험.
    if (!reason) {
      const riskyTask = projTasks.find((t) => risks.has(t.id));
      if (riskyTask) {
        reason = "predecessor_risk";
        reasonText = `관련 작업 '${riskyTask.title}'에 일정 위험이 감지됐습니다.`;
      }
    }
    // ⑶ 마감 D-2 이내 + 완료율 < 50%.
    if (!reason) {
      const dueMs = Date.parse(m.dueAt);
      if (!Number.isNaN(dueMs) && dueMs >= nowMs && dueMs <= nowMs + 2 * DAY_MS) {
        if (progress < LOW_PROGRESS_THRESHOLD) {
          reason = "due_soon_low_progress";
          reasonText = `마감이 임박(D-2 이내)했는데 관련 작업 완료율이 ${progress}%입니다.`;
        }
      }
    }
    if (!reason) continue;

    triggers.push({
      milestoneId: m.id,
      title: m.title,
      projectId: m.projectId,
      projectName: project?.name ?? "-",
      dueAt: m.dueAt,
      dueDateKey: dateKeyOfIso(m.dueAt),
      reason,
      reasonText,
      progress,
      doneCount,
      totalCount: projTasks.length,
      recipientIds: decisionRecipients(db, project?.ownerId),
    });
  }
  return triggers;
}

/** 결정 카드 DM 본문(맥락 + 결정 옵션 + 딥링크). */
function crisisText(t: CrisisTrigger): string {
  return [
    `${t.projectName} · ${t.title}`,
    t.reasonText,
    `관련 작업 진행률 ${t.progress}% (${t.doneCount}/${t.totalCount}) · 마감 ${t.dueDateKey}`,
    "결정: 기한 유지 / 연기(새 날짜) / 작업 재배분 / 보류(사유) — 웹에서 결정해 주세요.",
  ].join("\n");
}

/** 크라이시스 계열 DM intent 묶음(수신자별 개별 행 — marker에 recipient 덧붙임). */
function crisisIntents(
  kind: "crisis" | "crisis_remind" | "crisis_esc",
  milestoneId: string,
  date: string,
  recipientIds: string[],
  title: string,
  text: string,
): NotificationIntent[] {
  const deeplink = `${appBaseUrl()}/daily`;
  return recipientIds.map((rid) => ({
    kind,
    entityType: "milestone",
    entityId: milestoneId,
    marker: `${date}:${rid}`, // 접두 `<kind>:<milestoneId>:<date>` + 수신자 개별화
    recipient: rid,
    payload: {
      title,
      text,
      deeplinkPath: "/daily",
      tone: "red",
      actions: [
        { actionId: "crisis:open", label: "결정하러 가기", value: milestoneId, url: deeplink, style: "primary" },
      ],
    },
  }));
}

/** 발송 후 해결됐는지 — 발송 시각 이후 마일스톤 변경(ChangeLog) 또는 트리거 해소.
 *  DM의 '작업 재배분' 옵션처럼 **관련 작업을 손본 대응**도 인정한다(같은 프로젝트 작업의
 *  이동·재배정·상태 변경) — 재배분으로 답한 담당자에게 재촉·에스컬레이션이 오발송되지 않게. */
function isResolved(
  db: MockQueDb,
  milestoneId: string,
  sentMs: number,
  stillTriggered: boolean,
): boolean {
  if (!stillTriggered) return true; // 더는 트리거 상태가 아님(완료율 회복·상태 변경 반영).
  const changedAfter = db.changeLogs.some(
    (log) =>
      log.entityType === "milestone" &&
      log.entityId === milestoneId &&
      (log.changeType === "move" || log.changeType === "update" || log.changeType === "status_change") &&
      Date.parse(log.createdAt) > sentMs,
  );
  if (changedAfter) return true;
  const projectId = db.milestones.find((m) => m.id === milestoneId)?.projectId;
  if (!projectId) return false;
  const projectTaskIds = new Set(db.tasks.filter((t) => t.projectId === projectId).map((t) => t.id));
  return db.changeLogs.some(
    (log) =>
      log.entityType === "task" &&
      projectTaskIds.has(log.entityId) &&
      Date.parse(log.createdAt) > sentMs,
  );
}

/**
 * 긴급 결정 감지·발송·에스컬레이션(크론용). 평일만(주말 게이트는 호출부에서도 걸지만 자체 방어).
 * Bot Token(개인 DM) 게이트. 하루 신규 크라이시스는 3건 상한(당일 crisis 발송 마일스톤 수 카운트).
 */
export async function scanCrisisTriggers(db: MockQueDb, now: Date): Promise<DispatchCounts> {
  const empty: DispatchCounts = { enqueued: 0, sent: 0, held: 0 };
  if (!personalDigestEnabled()) return empty; // 개인 DM — Bot Token 게이트
  const day = kstDayOfWeek(now);
  if (day === 0 || day === 6) return empty; // 평일만(§1-e는 주간 리듬)
  try {
    const date = todayKey(now);
    const nowMs = now.getTime();
    const triggers = detectCrisisTriggers(db, now);
    const triggeredIds = new Set(triggers.map((t) => t.milestoneId));

    // 오늘 이미 크라이시스가 발송된 마일스톤 집합(상한·에스컬레이션 기준).
    const firedToday = new Map<string, number>(); // milestoneId → 최초 발송(created) ms
    for (const e of db.notificationOutbox) {
      if (e.kind !== "crisis") continue;
      if (dateKeyOfIso(e.createdAt) !== date) continue;
      const ms = Date.parse(e.sentAt ?? e.createdAt);
      const prev = firedToday.get(e.entityId);
      if (prev === undefined || ms < prev) firedToday.set(e.entityId, ms);
    }

    const intents: NotificationIntent[] = [];

    // ── 신규 트리거 발송(상한 내) ──
    let newCount = firedToday.size; // 오늘 이미 발송된 마일스톤 수
    for (const t of triggers) {
      if (firedToday.has(t.milestoneId)) continue; // 오늘 이미 발송(dedup) — 신규 아님
      if (newCount >= CRISIS_DAILY_CAP) break; // 하루 3건 상한
      if (t.recipientIds.length === 0) continue;
      intents.push(
        ...crisisIntents("crisis", t.milestoneId, date, t.recipientIds, "긴급 결정 필요", crisisText(t)),
      );
      newCount += 1;
    }

    // ── 에스컬레이션(오늘 발송된 미해결 크라이시스) ──
    for (const [milestoneId, sentMs] of firedToday) {
      const stillTriggered = triggeredIds.has(milestoneId);
      if (isResolved(db, milestoneId, sentMs, stillTriggered)) continue;
      const trigger = triggers.find((t) => t.milestoneId === milestoneId);
      const milestone = db.milestones.find((m) => m.id === milestoneId);
      const project = milestone ? db.projects.find((p) => p.id === milestone.projectId) : undefined;
      const label = trigger ? `${trigger.projectName} · ${trigger.title}` : milestone?.title ?? milestoneId;
      const elapsed = nowMs - sentMs;

      if (elapsed >= REMIND_AFTER_MS) {
        const recipients = trigger?.recipientIds ?? decisionRecipients(db, project?.ownerId);
        if (recipients.length > 0) {
          intents.push(
            ...crisisIntents(
              "crisis_remind",
              milestoneId,
              date,
              recipients,
              "긴급 결정 재촉",
              `${label} — 아직 결정이 없습니다. 웹에서 결정해 주세요.`,
            ),
          );
        }
      }
      if (elapsed >= ESCALATE_AFTER_MS) {
        const esc = escalationRecipients(db, project?.ownerId);
        if (esc.length > 0) {
          intents.push(
            ...crisisIntents(
              "crisis_esc",
              milestoneId,
              date,
              esc,
              "긴급 결정 에스컬레이션",
              `${label} — 4시간 넘게 미결정입니다. 관리자·대표 확인이 필요합니다.`,
            ),
          );
        }
      }
    }

    if (intents.length === 0) return empty;
    return await enqueueAndSend(db, intents, now);
  } catch (error) {
    console.error("[que-notify] scanCrisisTriggers 실패(무시)", error);
    return empty;
  }
}

// ── OS-2b 외부 변경 접수 SLA 스캔(부록 C) ──────────────────────────────────────
// impactDeadline(접수+24h) 기준: 12h 전 재촉(change_remind, 담당 PM+admin), 초과 시 에스컬레이션
// (change_esc, admin·대표). 크라이시스 인프라(수신자 계산·dedup·enqueueAndSend) 재사용.
// dedup 접두 `<kind>:<changeRequestId>:<KST날짜>` + 수신자 개별화(marker에 recipient 덧붙임).

const CHANGE_REMIND_BEFORE_MS = 12 * 60 * 60 * 1000; // 마감 12h 전부터 재촉

/** 변경 대응 SLA DM intent 묶음(수신자별 개별 행). */
function changeRequestIntents(
  kind: "change_remind" | "change_esc",
  changeRequestId: string,
  date: string,
  recipientIds: string[],
  title: string,
  text: string,
): NotificationIntent[] {
  const deeplink = `${appBaseUrl()}/daily`;
  return recipientIds.map((rid) => ({
    kind,
    entityType: "change_request",
    entityId: changeRequestId,
    marker: `${date}:${rid}`,
    recipient: rid,
    payload: {
      title,
      text,
      deeplinkPath: "/daily",
      tone: "red",
      actions: [
        { actionId: "change:open", label: "변경 대응 보기", value: changeRequestId, url: deeplink, style: "primary" },
      ],
    },
  }));
}

/**
 * 외부 변경 SLA 스캔·발송(크론용). 평일 게이트·Bot Token 게이트(크라이시스와 동일).
 * 진행 중(종결 전) 변경 요청만 대상. 12h 전 재촉, 마감 초과 에스컬레이션. dedup은 kind·CR·날짜당 1회.
 */
export async function scanChangeRequestSla(db: MockQueDb, now: Date): Promise<DispatchCounts> {
  const empty: DispatchCounts = { enqueued: 0, sent: 0, held: 0 };
  if (!personalDigestEnabled()) return empty; // 개인 DM — Bot Token 게이트
  const day = kstDayOfWeek(now);
  if (day === 0 || day === 6) return empty; // 평일만
  try {
    const date = todayKey(now);
    const intents: NotificationIntent[] = [];
    for (const cr of db.changeRequests) {
      // SLA는 영향 분석 전(stage=received)에만 — 분석 완료 건에 허위 재촉·에스컬레이션 금지(게이트 High-1).
      const slaState = changeRequestSlaState(cr, now, CHANGE_REMIND_BEFORE_MS);
      if (!slaState) continue;
      const project = db.projects.find((p) => p.id === cr.projectId);
      const label = `${project?.name ?? "-"} · ${cr.title}`;

      if (slaState === "esc") {
        // 마감 초과 — admin·대표 에스컬레이션.
        const esc = escalationRecipients(db, project?.ownerId);
        if (esc.length > 0) {
          intents.push(
            ...changeRequestIntents(
              "change_esc",
              cr.id,
              date,
              esc,
              "외부 변경 SLA 초과",
              `${label} — 영향 분석 마감(24h)을 넘겼습니다. 관리자·대표 확인이 필요합니다.`,
            ),
          );
        }
      } else {
        // 마감 12h 전 — 담당 PM + admin 재촉.
        const recipients = decisionRecipients(db, project?.ownerId);
        if (recipients.length > 0) {
          intents.push(
            ...changeRequestIntents(
              "change_remind",
              cr.id,
              date,
              recipients,
              "외부 변경 영향 분석 재촉",
              `${label} — 영향 분석 마감이 12시간 이내입니다. 분석·재협의를 진행해 주세요.`,
            ),
          );
        }
      }
    }
    if (intents.length === 0) return empty;
    return await enqueueAndSend(db, intents, now);
  } catch (error) {
    console.error("[que-notify] scanChangeRequestSla 실패(무시)", error);
    return empty;
  }
}
