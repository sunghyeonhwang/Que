import { canViewMeetingNote, helpUserIdsOf, latestStatusLog, type User } from "@que/core";
import { getDb } from "./db";
import { kstDateKey } from "./daily-data";
import { computeGanttRisk } from "./projects-data";
import { getTeamData } from "./team-data";
import { isAwaitingAnswer } from "./notifications/checkin-prompt";

// 알림·우선 확인 데이터 계층 — 운영 병목 신호를 모아 보여준다.
// 감시가 아니라 "어디가 막혔나 / 내가 지금 뭘 봐야 하나"를 빨리 드러내는 용도(CLAUDE.md 원칙).
//
// 두 selector로 나뉜다(홈 명세 §3·§6, 2026-07-10 "벨 개인화"):
//  - getViewerAlerts: 로그인 사용자 "본인 관련" 신호만. 상단바 벨·알림 센터(/notifications)·
//    사원 홈 우선 확인/체크인이 전부 이걸 쓴다 → 세 화면 수치가 항상 일치한다(수용 기준).
//  - getTeamPriorityItems: 관리자·대표 홈 "우선 확인"용 팀/전사 신호(병목→충돌→응답대기→선행지연).
// 조회 전용. 열람 권한 없는 회의록의 Action은 제외.

export type AlertKind =
  | "needs_review"
  | "issue"
  | "overdue"
  | "payment"
  | "help_request"
  | "schedule_risk"
  | "payment_status"
  | "checkin"
  | "standup";
export type AlertTone = "violet" | "red" | "amber" | "blue" | "green";

export interface AlertItem {
  id: string;
  kind: AlertKind;
  tone: AlertTone;
  title: string;
  description: string;
  href: string;
  /** 사용자가 읽음 처리했는지(alert_reads). 표시는 유지되고 뱃지·강조에서만 빠진다(C-3a). */
  read: boolean;
}

export interface AlertsData {
  items: AlertItem[];
  /** 뱃지용 총 개수(표시 캡과 무관한 실제 수) */
  count: number;
  /** 안읽음 수 — 상단바 종 뱃지는 이 값을 쓴다(C-3a). */
  unreadCount: number;
}

const OPEN = new Set(["scheduled", "in_progress", "needs_reschedule", "on_hold", "issue"]);
const DISPLAY_CAP = 8;

/**
 * 오늘 데일리 스탠드업을 본인이 아직 제출하지 않았는지(기획 §7 Phase 4).
 * 조건: 평일 + KST 10시 이후 + 본인 오늘 체크인 없음. 주말은 스탠드업이 없으므로 게이트한다(§8-5).
 * TZ=Asia/Seoul 고정(instrumentation)이라 now의 로컬 요일/시가 곧 KST다.
 * getViewerAlerts(벨·사원 홈)와 getTeamPriorityItems(관리자·대표 홈)가 공유해 세 화면 수치를 맞춘다.
 */
function isStandupMissing(
  db: Awaited<ReturnType<typeof getDb>>,
  userId: string,
  now: Date,
): boolean {
  const day = now.getDay(); // 0=일, 6=토
  if (day === 0 || day === 6) return false;
  if (now.getHours() < 10) return false;
  return !db.standupEntriesByDate(kstDateKey(now)).some((e) => e.userId === userId);
}

/**
 * viewer-scoped 알림 — 로그인 사용자 본인 관련 신호만 모은다(벨 개인화, 홈 명세 §3).
 * 포함: ①본인 작업 문제/홀드 ②본인 작업 기한초과 ③도움 요청 대상=나 ④선행 지연으로 밀릴 위험인
 * 내 작업(computeGanttRisk 문장) ⑤내가 올린 결제 요청의 상태 변화(승인/입금) ⑥본인 응답 대기 체크인
 * + 본인이 열람 가능한 확인 필요 Action. alert_reads 읽음 결합·정렬·표시 캡은 기존과 동일.
 */
export async function getViewerAlerts(
  user: User,
  now: Date = new Date(),
  opts?: { all?: boolean },
): Promise<AlertsData> {
  const db = await getDb();
  // 읽음 오버레이(C-3a) — 파생 알림의 안정 id 기준. 항목이 해결되면 알림은 자연 소멸하고
  // 읽음 행만 잔존(무해). 재발(동일 id 재등장)은 읽음이 유지된다 — 뱃지는 "새로운 것" 신호.
  const readIds = new Set(db.alertReads.filter((r) => r.userId === user.id).map((r) => r.alertId));
  const nowMs = now.getTime();
  const userById = new Map(db.users.map((u) => [u.id, u]));
  const nameOf = (id: string) => userById.get(id)?.name ?? id;
  const taskById = new Map(db.tasks.map((t) => [t.id, t]));

  const viewableNoteIds = new Set(
    db.meetingNotes.filter((n) => canViewMeetingNote(user, n)).map((n) => n.id),
  );

  // 심각도 순으로 쌓는다: 문제/홀드 → 도움 요청 → 선행 지연 → 확인필요 Action → 결제 → 기한초과.
  // (기한초과가 보통 가장 많아 뒤에 둔다 — 캡에 밀려도 고신호 항목이 먼저 보이게.)
  const items: AlertItem[] = [];

  // ── 본인 작업 목록(필터 기준) ──
  const myTasks = db.tasks.filter((t) => t.assigneeId === user.id);

  // 1) 본인 작업 문제/홀드 (가장 급함)
  const blockedTaskIds = new Set<string>();
  for (const t of myTasks.filter((t) => t.status === "issue" || t.status === "on_hold")) {
    blockedTaskIds.add(t.id);
    const log = latestStatusLog(db.statusLogs, t.id, t.status);
    items.push({
      id: `${t.status === "issue" ? "issue" : "hold"}-${t.id}`,
      read: readIds.has(`${t.status === "issue" ? "issue" : "hold"}-${t.id}`),
      kind: "issue",
      tone: "red",
      title: t.status === "issue" ? "문제 발생" : "홀드",
      description: log?.reason ? `${t.title} · ${log.reason}` : t.title,
      href: "/today",
    });
  }

  // 2) 나에게 온 도움 요청 (도움 대상=나)
  for (const c of db.taskComments.filter((c) => helpUserIdsOf(c).includes(user.id))) {
    const t = taskById.get(c.taskId);
    if (!t) continue;
    items.push({
      id: `help-${c.id}`,
      read: readIds.has(`help-${c.id}`),
      kind: "help_request",
      tone: "blue",
      title: "도움 요청",
      description: `${t.title} · ${nameOf(c.authorId)}: “${c.body}”`,
      href: "/today",
    });
  }

  // 3) 선행 지연으로 밀릴 위험인 내 작업(E-9 computeGanttRisk 문장 재사용).
  //    선행 그래프는 남의 작업까지 포함해야 하므로 전체로 판정하고, 내 작업 것만 노출한다.
  const risks = computeGanttRisk(db.tasks, taskById, now.toISOString());
  for (const t of myTasks) {
    if (blockedTaskIds.has(t.id)) continue; // 이미 문제/홀드로 잡힌 건 중복 표시하지 않음
    const reason = risks.get(t.id);
    if (!reason) continue;
    items.push({
      id: `schedrisk-${t.id}`,
      read: readIds.has(`schedrisk-${t.id}`),
      kind: "schedule_risk",
      tone: "amber",
      title: "일정 주의",
      description: `${t.title} · ${reason}`,
      href: "/today",
    });
  }

  // 4) 확인 필요 Action (담당자/마감 누락으로 Task 자동생성 안 된 것 — 본인이 열람 가능한 회의록)
  for (const a of db.actionItems.filter(
    (a) => a.status === "needs_review" && viewableNoteIds.has(a.meetingNoteId),
  )) {
    items.push({
      id: `review-${a.id}`,
      read: readIds.has(`review-${a.id}`),
      kind: "needs_review",
      tone: "violet",
      title: "확인 필요",
      description: a.title,
      href: "/action",
    });
  }

  // 5) 내가 올린 결제 요청의 상태 변화 — 다른 사람이 입금(완료) 처리한 것(요청자 관점, 승인/입금).
  for (const p of db.paymentRequests.filter(
    (p) => p.requesterId === user.id && p.status === "done" && p.lastChangedBy !== user.id,
  )) {
    items.push({
      id: `paystatus-${p.id}`,
      read: readIds.has(`paystatus-${p.id}`),
      kind: "payment_status",
      tone: "green",
      title: "입금 완료",
      description: `${p.title} · ${p.category}`,
      href: "/payments",
    });
  }

  // 6) 내가 올린 결제 요청의 마감 초과 대기 건(요청자 관점).
  for (const p of db.paymentRequests.filter(
    (p) =>
      p.requesterId === user.id &&
      p.status === "waiting" &&
      p.dueAt &&
      new Date(p.dueAt).getTime() < nowMs,
  )) {
    items.push({
      id: `pay-${p.id}`,
      read: readIds.has(`pay-${p.id}`),
      kind: "payment",
      tone: "amber",
      title: "결제 마감 초과",
      description: `${p.title} · ${p.category}`,
      href: "/payments",
    });
  }

  // 7) 본인 응답 대기 자동 체크인(홈에서는 별도 '작업 상태 확인' 카드로 분리 표시 — 벨/센터는 함께 표시).
  for (const c of db.checkIns.filter(
    (c) => c.assigneeId === user.id && isAwaitingAnswer(c, now),
  )) {
    const t = taskById.get(c.taskId);
    // 이미 종결(완료/취소/병합)된 작업의 체크인은 묻지 않는다.
    if (!t || t.status === "done" || t.status === "cancelled" || t.status === "merged") continue;
    items.push({
      id: `checkin-${c.id}`,
      read: readIds.has(`checkin-${c.id}`),
      kind: "checkin",
      tone: "violet",
      title: "작업 상태 확인",
      description: `‘${t.title}’ 작업은 어떻게 진행되고 있나요?`,
      href: "/today",
    });
  }

  // 7-b) 오늘 데일리 스탠드업 미제출(기획 §7 Phase 4) — 운영 리듬 넛지(감시 아님). tone blue, href /daily.
  if (isStandupMissing(db, user.id, now)) {
    const id = `standup-${user.id}-${kstDateKey(now)}`;
    items.push({
      id,
      read: readIds.has(id),
      kind: "standup",
      tone: "blue",
      title: "스탠드업 미제출",
      description: "오늘 데일리 스탠드업 체크인을 아직 제출하지 않았습니다.",
      href: "/daily",
    });
  }

  // 8) 본인 작업 기한 초과(마감 지났는데 아직 열려 있음). 문제/홀드로 이미 잡힌 건 제외.
  for (const t of myTasks.filter(
    (t) =>
      !blockedTaskIds.has(t.id) &&
      t.endAt &&
      new Date(t.endAt).getTime() < nowMs &&
      OPEN.has(t.status),
  )) {
    items.push({
      id: `overdue-${t.id}`,
      read: readIds.has(`overdue-${t.id}`),
      kind: "overdue",
      tone: "amber",
      title: "기한 초과",
      description: t.title,
      href: "/today",
    });
  }

  const unreadCount = items.filter((i) => !i.read).length;
  // 드롭다운은 안읽음을 앞으로(캡에 밀리지 않게), 알림 센터(all)는 원래 심각도 순서 유지.
  const ordered = opts?.all ? items : [...items].sort((a, b) => Number(a.read) - Number(b.read));
  return {
    items: opts?.all ? ordered : ordered.slice(0, DISPLAY_CAP),
    count: items.length,
    unreadCount,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// 팀/전사 우선 확인(관리자·대표 홈)
// ─────────────────────────────────────────────────────────────────────────────

export type PriorityKind =
  | "issue"
  | "on_hold"
  | "help_request"
  | "conflict"
  | "awaiting_checkin"
  | "schedule_risk"
  | "standup";

export interface PriorityItem {
  id: string;
  kind: PriorityKind;
  tone: AlertTone;
  title: string;
  /** 담당·사유·맥락 한 줄. */
  description: string;
  href: string;
  /** 문제·홀드 항목의 우선 노출 필드(작업명·담당·사유·도움 대상·재확인 시각). */
  assigneeName?: string;
  reason?: string;
  helpUserNames?: string[];
  nextCheckAt?: string;
}

export interface TeamPriorityData {
  /** 정렬·캡(최대 5) 적용된 표시 목록. */
  items: PriorityItem[];
  /** 캡 이전 총수(전체 보기 링크·배지용). */
  count: number;
}

const PRIORITY_CAP = 5;
const PRIORITY_RANK: Record<PriorityKind, number> = {
  issue: 0,
  on_hold: 1,
  help_request: 2,
  conflict: 3,
  awaiting_checkin: 4,
  schedule_risk: 5,
  standup: 6,
};

/**
 * 관리자·대표 홈 '우선 확인' — 팀/전사 신호를 심각도 순으로 모은다(문제→홀드→도움 요청→일정 충돌
 * →상태 응답 대기→선행 지연). getTeamData(병목·충돌)와 computeGanttRisk(선행 지연)를 재사용한다.
 * 대표 담당 작업의 문제·홀드도 포함된다(getTeamData attention은 ceo 제외를 하지 않음).
 */
export async function getTeamPriorityItems(
  user: User,
  now: Date = new Date(),
  clientId?: string,
): Promise<TeamPriorityData> {
  const [db, team] = await Promise.all([getDb(), getTeamData(user, now, clientId)]);
  const items: PriorityItem[] = [];

  for (const a of team.attention) {
    if (a.type === "issue" || a.type === "on_hold") {
      items.push({
        id: a.taskId,
        kind: a.type,
        tone: "red",
        title: a.type === "issue" ? "문제 발생" : "홀드",
        description: `${a.title} · 담당 ${a.assigneeName}${a.detail ? ` · ${a.detail}` : ""}`,
        href: "/team",
        assigneeName: a.assigneeName,
        reason: a.detail,
        helpUserNames: a.helpUserNames,
        nextCheckAt: a.nextCheckAt,
      });
    } else if (a.type === "help_request") {
      items.push({
        id: a.taskId,
        kind: "help_request",
        tone: "blue",
        title: "도움 요청",
        description: `${a.title} · ${a.detail ?? ""}`.trim(),
        href: "/team",
        assigneeName: a.assigneeName,
        helpUserNames: a.helpUserName ? [a.helpUserName] : undefined,
      });
    } else if (a.type === "awaiting_response") {
      items.push({
        id: `await-${a.taskId}`,
        kind: "awaiting_checkin",
        tone: "violet",
        title: "상태 응답 대기",
        description: `${a.title} · 담당 ${a.assigneeName}`,
        href: "/team",
        assigneeName: a.assigneeName,
      });
    }
  }

  // 일정 충돌 — getTeamData가 계산한 사람별 겹침.
  for (const c of team.conflicts) {
    items.push({
      id: `conflict-${c.userName}-${c.overlapStartAt}`,
      kind: "conflict",
      tone: "amber",
      title: "일정 충돌",
      description: `${c.userName} · ‘${c.aTitle}’ ↔ ‘${c.bTitle}’`,
      href: "/team",
    });
  }

  // 선행 지연 일정 주의(팀 전체, computeGanttRisk 문장 재사용). 필터 스코프를 존중한다.
  const taskById = new Map(db.tasks.map((t) => [t.id, t]));
  const scoped = db.tasksForClient(clientId);
  const scopedIds = new Set(scoped.map((t) => t.id));
  const userById = new Map(db.users.map((u) => [u.id, u]));
  const risks = computeGanttRisk(db.tasks, taskById, now.toISOString());
  for (const [taskId, reason] of risks) {
    if (!scopedIds.has(taskId)) continue;
    const t = taskById.get(taskId);
    if (!t || t.status === "issue" || t.status === "on_hold") continue; // 병목으로 이미 잡힘
    items.push({
      id: `schedrisk-${taskId}`,
      kind: "schedule_risk",
      tone: "amber",
      title: "일정 주의",
      description: `${t.title} · 담당 ${userById.get(t.assigneeId)?.name ?? t.assigneeId} · ${reason}`,
      href: "/team",
      reason,
    });
  }

  // 본인 스탠드업 미제출(기획 §7 Phase 4) — 관리자·대표도 본인 체크인은 제출 대상. 팀 신호 뒤 마지막.
  if (isStandupMissing(db, user.id, now)) {
    items.push({
      id: `standup-${user.id}-${kstDateKey(now)}`,
      kind: "standup",
      tone: "blue",
      title: "스탠드업 미제출",
      description: "오늘 데일리 스탠드업 체크인을 아직 제출하지 않았습니다.",
      href: "/daily",
    });
  }

  items.sort((a, b) => PRIORITY_RANK[a.kind] - PRIORITY_RANK[b.kind]);
  return { items: items.slice(0, PRIORITY_CAP), count: items.length };
}
