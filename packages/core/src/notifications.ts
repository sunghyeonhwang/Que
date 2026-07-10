import type { StatusDetail, Task, TaskStatus } from "./domain";
import { helpUserIdsOf } from "./rules";

// 알림 규칙 계층 (순수 함수) — 웹/MCP/CLI가 공유한다.
// "보낼/안 보낼 알림"의 판정을 여기 한 곳에서 강제해 세 채널이 동일하게 동작한다.
// 부수효과 없음: intent(발송 의도)를 만들 뿐, 적재(enqueue)·발송(Slack POST)은 어댑터/웹 계층이 한다.
//
// 색 의미 고정(CLAUDE.md·alerts-data.ts AlertTone과 동일): red=문제, amber=마감/주의, violet=회의록.

/** 발송 톤. apps/web의 AlertTone과 값이 동일하다(계층 분리를 위해 core에 미러 정의).
 *  blue=예정/정보(개인 데일리 브리핑) — CLAUDE.md 상태색 의미 고정과 일치. */
export type NotificationTone = "red" | "amber" | "violet" | "blue";

/** 알림 종류. 아웃박스 kind 컬럼·dedup_key 접두와 일치.
 *  standup은 팀 데일리 다이제스트(하루 1회) 전용 — status/deadline과 달리 순수 규칙 함수가 아니라
 *  web dispatch가 직접 intent를 만든다(getStandupData가 web 계층). dedup만 아웃박스로 강제한다.
 *  personal_digest는 개인 DM 데일리 브리핑(하루 1회, 아침 9:50 KST) — recipient=Que userId를 담아
 *  발송 직전 Bot Token으로 Slack member ID를 해석한다. dedup_key `personal_digest:<userId>:<date>`.
 *  task_created는 할일 생성 즉시 담당자에게 보내는 개인 DM(Phase 3) — recipient=assigneeId.
 *  dedup_key `task_created:<taskId>`로 **task 1건당 평생 1회**(재시도·중복 훅 방지, marker 무시).
 *  checkin_prompt는 미응답 체크인 재촉 DM(C-2) — recipient=assigneeId, 버튼(payload.actions)으로
 *  Slack에서 바로 응답한다. dedup_key `checkin_prompt:<checkInId>:<KST날짜>`로 체크인·날짜당 1회. */
export type NotificationKind =
  | "issue"
  | "on_hold"
  | "deadline"
  | "standup"
  | "personal_digest"
  | "task_created"
  | "checkin_prompt";

/** 아웃박스 status 컬럼. */
export type NotificationStatus = "pending" | "held" | "sent" | "skipped" | "failed";

export interface NotificationPayload {
  title: string;
  text: string;
  /** 딥링크 경로(예: "/now"). 베이스 URL 주입은 web 계층. */
  deeplinkPath: string;
  tone: NotificationTone;
  /** (선택) 요약 1줄(text) 뒤에 붙일 상세 목록 mrkdwn 본문. personal_digest v2만 채운다.
   *  아웃박스 payload(jsonb) 패스스루라 스키마/마이그레이션 무관. 없으면 기존 1줄 동작. */
  detail?: string;
  /** (선택) 인터랙티브 버튼(C-2 checkin_prompt). Slack actions block으로 렌더 — actionId가
   *  응답 라우팅 키, value가 대상 id(체크인 id). jsonb 패스스루라 스키마/마이그레이션 무관. */
  actions?: { actionId: string; label: string; value: string; style?: "primary" | "danger" }[];
}

/**
 * 발송 의도(저장 안 함). 어댑터가 dedupKeyFor로 유일키를 뽑아 아웃박스에 적재한다.
 * dedupKey를 중복 저장하지 않고 marker만 담아, dedupKeyFor가 결정적으로 재구성한다.
 */
export interface NotificationIntent {
  kind: NotificationKind;
  /** 대상 종류. status/deadline은 "task", standup 다이제스트는 "team", personal_digest는 "user". */
  entityType: string;
  entityId: string;
  /** kind별 이벤트 유일성 마커. status계열=전이 시각/변경로그id, deadline=마감 버킷(YYYY-MM-DD),
   *  standup/personal_digest=KST 날짜 키(YYYY-MM-DD). */
  marker: string;
  /** 개인 수신자(Que userId). personal_digest만 세팅한다 — 발송 직전 Slack member ID로 해석.
   *  팀채널 계열은 undefined(단일 채널 발송). enqueueNotifications가 아웃박스 recipient로 적재한다. */
  recipient?: string;
  payload: NotificationPayload;
}

/** 아웃박스에 적재된 1행(발송 원장). DB notification_outbox와 1:1. */
export interface NotificationOutboxEntry {
  id: string;
  dedupKey: string;
  kind: NotificationKind;
  entityType: string;
  entityId: string;
  recipient?: string;
  payload: NotificationPayload;
  status: NotificationStatus;
  attempts: number;
  holdUntil?: string;
  createdAt: string;
  sentAt?: string;
}

/** 알림 텍스트 생성에 필요한 최소 컨텍스트(순수) — id→표시명 해석과 기준 시각. */
export interface NotificationContext {
  now: Date;
  /** userId → 표시명. 미상이면 id를 그대로 반환하는 폴백을 권장. */
  nameOf: (userId: string) => string;
}

/**
 * 이벤트 유일키. 재요청·크론 재실행에도 이벤트당 1건이 되도록 결정적으로 만든다.
 * DB의 dedup_key UNIQUE와 짝을 이뤄 중복 발송을 차단한다.
 */
export function dedupKeyFor(intent: NotificationIntent): string {
  // task_created는 task 1건당 평생 1회 — marker 없이 taskId만으로 유일키(재시도·중복 훅 방지).
  if (intent.kind === "task_created") return `task_created:${intent.entityId}`;
  return `${intent.kind}:${intent.entityId}:${intent.marker}`;
}

const STATUS_NOTIFY: Record<string, { kind: NotificationKind; title: string; tone: NotificationTone }> = {
  issue: { kind: "issue", title: "문제 발생", tone: "red" },
  on_hold: { kind: "on_hold", title: "홀드", tone: "amber" },
};

/** 열린(진행 가능한) 상태 집합 — 마감 임박 스캔 대상. done/cancelled/merged는 제외된다. */
const OPEN_STATUSES: ReadonlySet<TaskStatus> = new Set<TaskStatus>([
  "scheduled",
  "in_progress",
  "needs_reschedule",
  "on_hold",
  "issue",
]);

/**
 * 작업 상태 전이 → 발송 의도. **issue/on_hold 전환만** 통과시킨다.
 * - done/cancelled/merged 대상: 화이트리스트에 없어 자동 제외.
 * - from===to("이미 그 상태"·재진입): 실제 전이가 아니므로 제외(빈 배열).
 * detail의 도움요청 대상(helpUserIds/helpUserId)이 있으면 텍스트에 이름을 담는다.
 */
export function buildStatusChangeIntents(
  ctx: NotificationContext,
  task: Task,
  from: TaskStatus,
  to: TaskStatus,
  detail?: StatusDetail,
): NotificationIntent[] {
  const spec = STATUS_NOTIFY[to];
  if (!spec) return []; // issue/on_hold만 알림
  if (from === to) return []; // 재진입(이미 업데이트됨) — 새 이벤트 아님

  const parts = [task.title, `담당 ${ctx.nameOf(task.assigneeId)}`];
  if (detail?.reason) parts.push(`사유 ${detail.reason}`);
  const helpIds = helpUserIdsOf(detail);
  if (helpIds.length > 0) {
    parts.push(`도움요청 ${helpIds.map((id) => ctx.nameOf(id)).join(", ")}`);
  }

  // marker: 전이 시각(task.lastChangedAt은 changeTaskStatus가 방금 세팅). 없으면 기준 시각.
  const marker = task.lastChangedAt ?? ctx.now.toISOString();

  return [
    {
      kind: spec.kind,
      entityType: "task",
      entityId: task.id,
      marker,
      payload: {
        title: spec.title,
        text: parts.join(" · "),
        deeplinkPath: "/now",
        tone: spec.tone,
      },
    },
  ];
}

/** endAt(ISO)의 날짜 버킷(YYYY-MM-DD). 크론 주기와 무관하게 마감일당 1건이 되게 하는 dedup 키 재료. */
function dueBucket(endAtIso: string): string {
  return endAtIso.slice(0, 10);
}

/**
 * 마감 임박 → 발송 의도. 조건: 열린 상태 + 마감이 지금 이후 thresholdH 이내.
 * - done/cancelled/merged: OPEN_STATUSES에 없어 제외.
 * - overdue(마감이 이미 지남): now 이전이라 제외(기한초과는 별도 신호).
 * dedup 버킷이 마감일 단위라, 크론이 여러 번 돌아도 마감일당 1건.
 */
export function buildDeadlineIntents(
  ctx: NotificationContext,
  tasks: Task[],
  thresholdHours: number,
): NotificationIntent[] {
  const nowMs = ctx.now.getTime();
  const windowMs = thresholdHours * 60 * 60 * 1000;
  const intents: NotificationIntent[] = [];
  for (const task of tasks) {
    if (!OPEN_STATUSES.has(task.status)) continue;
    if (!task.endAt) continue;
    const dueMs = Date.parse(task.endAt);
    if (Number.isNaN(dueMs)) continue;
    if (dueMs < nowMs) continue; // overdue 제외
    if (dueMs > nowMs + windowMs) continue; // 아직 임박 아님
    intents.push({
      kind: "deadline",
      entityType: "task",
      entityId: task.id,
      marker: dueBucket(task.endAt),
      payload: {
        title: "마감 임박",
        text: `${task.title} · 담당 ${ctx.nameOf(task.assigneeId)}`,
        deeplinkPath: "/now",
        tone: "amber",
      },
    });
  }
  return intents;
}

export interface SlackMessage {
  /** Slack에 넣을 본문(제목 + 요약 1줄). 딥링크 링크 구성은 web 계층이 deeplinkPath로 만든다. */
  text: string;
  deeplinkPath: string;
  tone: NotificationTone;
  /** (선택) 요약 뒤에 붙일 상세 목록 mrkdwn 본문. 발송 어댑터가 blocks에 이어 붙인다. */
  detail?: string;
  /** (선택) 인터랙티브 버튼(C-2). 발송 어댑터가 actions block으로 렌더한다. */
  actions?: NotificationPayload["actions"];
}

/** 아웃박스 페이로드 → Slack 발송용 메시지. 베이스 URL 주입은 web 계층(deeplinkPath만 넘긴다). */
export function messageFor(entry: Pick<NotificationOutboxEntry, "payload">): SlackMessage {
  const { title, text, deeplinkPath, tone, detail, actions } = entry.payload;
  return {
    text: `*${title}*\n${text}`,
    deeplinkPath,
    tone,
    detail,
    actions,
  };
}
