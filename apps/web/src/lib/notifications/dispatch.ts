import "server-only";

import {
  buildDeadlineIntents,
  buildStatusChangeIntents,
  dedupKeyFor,
  messageFor,
  TASK_STATUS_LABELS,
  type MockQueDb,
  type NotificationContext,
  type NotificationIntent,
  type NotificationOutboxEntry,
  type StatusDetail,
  type Task,
  type TaskStatus,
} from "@que/core";
import { getStandupData } from "@/lib/team-data";
import { generateTeamSummary } from "@/lib/standup-summary";
import { buildWeeklyAgenda } from "@/lib/meeting-agenda";
import {
  appBaseUrl,
  deadlineThresholdHours,
  digestRecipientAllowlist,
  notificationsEnabled,
  personalDigestEnabled,
  quietHoursConfig,
  slackInteractiveEnabled,
  webhookEnabled,
} from "./config";
import { buildCheckinPromptIntents } from "./checkin-prompt";
import { buildPersonalDigestIntents } from "./personal-digest";
import { postToSlack } from "./slack";
import { postDmToSlack, resolveSlackUserId } from "./slack-bot";
import { absentUserIdsToday } from "@/lib/away";

// Slack 알림 오케스트레이터 (B-1, web 계층). core 규칙(무엇을 보낼지)과 어댑터(어떻게 보낼지)를 잇는다.
//
// 불변식:
//  - 각 진입점은 자기 채널 크레덴셜로 가드한다: 팀채널(status/deadline/standup)=webhookEnabled(SLACK_WEBHOOK_URL),
//    개인 DM 브리핑=personalDigestEnabled(SLACK_BOT_TOKEN). drainOutbox만 either 게이트 후 항목별로 채널을 가른다.
//  - enqueueAndSend/notifyTaskStatusChanged는 절대 throw하지 않는다 — 발송 실패가 작업 변경/응답을 막지 않는다.
//  - enqueue(아웃박스 적재)는 발송 전에 persist해 커밋한다(발송 실패해도 크론 drainOutbox가 재시도).
//  - mutation과 persist는 반드시 같은 db 인스턴스(호출부가 넘긴 db로만 작업).

const KST_OFFSET_MS = 9 * 60 * 60 * 1000;
const MAX_ATTEMPTS = 5;
// 스탠드업 오픈 시각(KST 시, 기획 §5 재편: 9→10). 크론이 */10이라 이 시(hour) 첫 실행 1건만 dedup으로 발송.
// 방해금지 기본 창(22-8) 밖의 아침 시각으로 둬 자정 발송·야간 발송을 막는다.
const STANDUP_HOUR_KST = 10;
// 개인 DM 브리핑 발송 창(KST 분 단위). 기획 §5 재편: 9:50~10:30 → **9:30~10:00**(브리핑 읽고 체크인 준비 순서).
// standup의 hour 게이트와 달리 분 단위 창을 쓰는 이유: 정시 크론이 밀려도 창 안 첫 실행이 발송.
const DIGEST_WINDOW_START_MIN = 9 * 60 + 30; // 09:30
const DIGEST_WINDOW_END_MIN = 10 * 60; // 10:00
// 미제출 재촉 DM 발송 창(KST 분). 10:40~11:00 — 팀 요약(11:00) 직전에 미제출자만 재촉.
const STANDUP_REMIND_WINDOW_START_MIN = 10 * 60 + 40; // 10:40
const STANDUP_REMIND_WINDOW_END_MIN = 11 * 60; // 11:00
// 팀 요약 컷오프 시각(KST 시). 이 시각 도달 시 미제출자가 있어도 생성(전원 제출 즉시와 '먼저 오는 쪽' §8-2).
const STANDUP_SUMMARY_HOUR_KST = 11;
// 주간 통합 회의 아젠다 게시 창(KST 분). 월요일 10:10~10:30 — 회의(10:40) 전에 팀채널에 아젠다 예고.
// (2026-07-13 사용자 확정 리듬: 10:00 스탠드업 오픈 → 10:10 아젠다 → 10:40 회의. 창 끝을 회의에 붙이지
//  않는 이유: 크론 지연 시 회의 직전 발송을 막고 최소 10분 리드타임을 확보한다 — 글래도스 판정.)
const WEEKLY_AGENDA_DAY_KST = 1; // 월요일(0=일)
const WEEKLY_AGENDA_WINDOW_START_MIN = 10 * 60 + 10; // 10:10
const WEEKLY_AGENDA_WINDOW_END_MIN = 10 * 60 + 30; // 10:30

/** 발송 결과 요약(크론 응답·호출부 로깅용). */
export interface DispatchCounts {
  enqueued: number;
  sent: number;
  held: number;
}

function notificationContext(db: MockQueDb, now: Date): NotificationContext {
  const names = new Map(db.users.map((u) => [u.id, u.name]));
  return { now, nameOf: (id) => names.get(id) ?? id };
}

/** now의 KST 벽시계 시(hour, 0-23). */
function kstHour(now: Date): number {
  return new Date(now.getTime() + KST_OFFSET_MS).getUTCHours();
}

/** now의 KST 벽시계 분(자정 이후 누적 분, 0-1439). 개인 브리핑 발송 창 판정용. */
function kstMinuteOfDay(now: Date): number {
  const d = new Date(now.getTime() + KST_OFFSET_MS);
  return d.getUTCHours() * 60 + d.getUTCMinutes();
}

/** now의 KST 날짜 키(YYYY-MM-DD). standup dedup에 쓴다. */
function kstDateKey(now: Date): string {
  return new Date(now.getTime() + KST_OFFSET_MS).toISOString().slice(0, 10);
}

/** now가 KST 기준 주말(토·일)인지 — 스탠드업 계열 알림 주말 게이트(§8-5). */
export function isKstWeekend(now: Date): boolean {
  const day = new Date(now.getTime() + KST_OFFSET_MS).getUTCDay(); // 0=일, 6=토
  return day === 0 || day === 6;
}

/** now의 KST 요일(0=일..6=토). 주간 아젠다 월요일 게이트용. */
function kstDayOfWeek(now: Date): number {
  return new Date(now.getTime() + KST_OFFSET_MS).getUTCDay();
}

/** now의 KST 분(자정 이후 누적 분, 0-1439). 재촉 창 판정용(kstMinuteOfDay 재사용). */
function kstMinute(now: Date): number {
  return kstMinuteOfDay(now);
}

/** ISO(마일스톤 dueAt 등)의 KST 날짜 키(YYYY-MM-DD). 파싱 실패 시 빈 문자열. */
function kstDateKeyOfIso(iso: string): string {
  const ms = Date.parse(iso);
  if (Number.isNaN(ms)) return "";
  return new Date(ms + KST_OFFSET_MS).toISOString().slice(0, 10);
}

function inQuietHours(now: Date, quiet: { start: number; end: number }): boolean {
  const h = kstHour(now);
  return quiet.start < quiet.end
    ? h >= quiet.start && h < quiet.end
    : h >= quiet.start || h < quiet.end; // 자정을 넘는 창(예: 22-8)
}

/** 방해금지 창이 끝나는 다음 시각(= end시 KST). 발송 보류 알림의 hold_until. */
function quietWindowEnd(now: Date, quiet: { start: number; end: number }): Date {
  const shifted = new Date(now.getTime() + KST_OFFSET_MS); // KST 벽시계를 UTC 필드로
  const wallMs = Date.UTC(
    shifted.getUTCFullYear(),
    shifted.getUTCMonth(),
    shifted.getUTCDate(),
    quiet.end,
    0,
    0,
    0,
  );
  let releaseMs = wallMs - KST_OFFSET_MS; // 실제 UTC로 환산
  if (releaseMs <= now.getTime()) releaseMs += 24 * 60 * 60 * 1000; // 이미 지났으면 다음 날
  return new Date(releaseMs);
}

/** 발송 지점(단일). 개인 수신자(recipient/personal_digest)면 Bot DM, 아니면 팀채널 Webhook으로 분기. */
async function sendEntry(db: MockQueDb, entry: NotificationOutboxEntry): Promise<boolean> {
  try {
    if (entry.kind === "personal_digest" || entry.recipient) {
      // recipient(Que userId)를 발송 직전 Slack member ID로 해석 — 캐시→email lookup→backfill.
      const slackId = await resolveSlackUserId(entry.recipient ?? entry.entityId);
      if (!slackId) {
        // 매핑 실패: failed로 남겨 크론이 재시도(매핑이 나중에 채워질 수 있음). throw는 안 함.
        db.markFailed(entry.id);
        console.error("[que-notify] Slack 사용자 매핑 실패", entry.recipient ?? entry.entityId);
        return false;
      }
      await postDmToSlack(slackId, messageFor(entry));
    } else {
      await postToSlack(messageFor(entry));
    }
    db.markNotificationSent(entry.id);
    return true;
  } catch (error) {
    db.markFailed(entry.id);
    console.error("[que-notify] Slack 발송 실패", entry.dedupKey, error);
    return false;
  }
}

/**
 * intent들을 아웃박스에 적재하고, 방해금지 창 밖이면 즉시 발송을 시도한다. **절대 throw하지 않는다.**
 * - 방해금지 창 안: held로 적재(holdUntil=창 종료 시각) 후 return — 발송은 크론 drainOutbox가 창 종료 후.
 * - 창 밖: enqueue → persist(적재 커밋) → 각 신규 항목 best-effort 발송 → persist(sent/failed 반영).
 * persist는 넘겨받은 db로만 한다(같은 인스턴스 규칙).
 */
export async function enqueueAndSend(
  db: MockQueDb,
  intents: NotificationIntent[],
  now: Date = new Date(),
): Promise<DispatchCounts> {
  const counts: DispatchCounts = { enqueued: 0, sent: 0, held: 0 };
  if (intents.length === 0) return counts;
  // 채널별 게이트: 개인 DM(recipient/personal_digest)=Bot Token, 팀채널(status/deadline)=Webhook.
  // 한쪽만 설정돼도 다른 채널이 헛되이 죽지 않게, 이 배치가 실제로 필요로 하는 채널만 요구한다.
  const isDm = (i: NotificationIntent) => i.kind === "personal_digest" || i.recipient !== undefined;
  if (intents.some((i) => !isDm(i)) && !webhookEnabled()) return counts;
  if (intents.some(isDm) && !personalDigestEnabled()) return counts;
  try {
    const quiet = quietHoursConfig();
    if (quiet && inQuietHours(now, quiet)) {
      const held = db.enqueueNotifications(intents, {
        holdUntil: quietWindowEnd(now, quiet).toISOString(),
      });
      counts.held = held.length;
      if (held.length > 0) await db.persist();
      return counts;
    }
    const created = db.enqueueNotifications(intents);
    counts.enqueued = created.length;
    if (created.length === 0) return counts; // 전부 dedup됨(같은 이벤트 재요청)
    await db.persist(); // 적재를 먼저 커밋 — 발송 실패해도 크론이 재시도
    for (const entry of created) {
      if (await sendEntry(db, entry)) counts.sent += 1;
    }
    await db.persist(); // sent/failed 상태 반영
  } catch (error) {
    // enqueueAndSend는 어떤 경우에도 호출부(작업 변경/응답)를 실패시키지 않는다.
    console.error("[que-notify] enqueueAndSend 실패(무시)", error);
  }
  return counts;
}

/**
 * 작업 상태 전이 알림 훅. persist **성공 직후** 호출한다(변경 전 status = fromStatus를 넘길 것).
 * issue/on_hold 전환만 core buildStatusChangeIntents가 통과시킨다(그 외·재진입은 no-op). throw하지 않는다.
 */
export async function notifyTaskStatusChanged(
  db: MockQueDb,
  taskId: string,
  fromStatus: TaskStatus,
  detail?: StatusDetail,
  now: Date = new Date(),
): Promise<void> {
  if (!webhookEnabled()) return; // 팀채널 발송 — Webhook 게이트
  const task = db.tasks.find((t) => t.id === taskId);
  if (!task) return;
  const ctx = notificationContext(db, now);
  const intents = buildStatusChangeIntents(ctx, task, fromStatus, task.status, detail);
  await enqueueAndSend(db, intents, now);
}

/** 우선순위 한글 라벨(DM 표시용). core에 별도 라벨맵이 없어 여기서 정의(상태색 의미와 무관). */
const PRIORITY_LABELS: Record<Task["priority"], string> = {
  low: "낮음",
  normal: "보통",
  high: "높음",
};

/** ISO → KST 벽시계 "YYYY-MM-DD HH:mm". 값이 없으면 "-"(DM 필드 폴백). */
function formatKstDateTime(iso?: string): string {
  if (!iso) return "-";
  const ms = Date.parse(iso);
  if (Number.isNaN(ms)) return "-";
  const d = new Date(ms + KST_OFFSET_MS);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getUTCFullYear()}-${p(d.getUTCMonth() + 1)}-${p(d.getUTCDate())} ${p(d.getUTCHours())}:${p(d.getUTCMinutes())}`;
}

/**
 * 할일 생성 DM(task_created) intent. 사용자 지정 필드(클라이언트·프로젝트·상태·우선순위·제목·시작일·마감일)
 * + Que 딥링크(/projects?task=<id> — projects/page.tsx가 읽는 searchParam). recipient=assigneeId.
 */
function buildTaskCreatedIntent(db: MockQueDb, task: Task): NotificationIntent {
  const project = db.projectOf(task);
  const client = db.clientOf(project);
  const lines = [
    `클라이언트: ${client?.name ?? "-"}`,
    `프로젝트: ${project?.name ?? "-"}`,
    `상태: ${TASK_STATUS_LABELS[task.status]}`,
    `우선순위: ${PRIORITY_LABELS[task.priority]}`,
    `제목: ${task.title}`,
    `시작일: ${formatKstDateTime(task.startAt)}`,
    `마감일: ${formatKstDateTime(task.endAt)}`,
  ];
  return {
    kind: "task_created",
    entityType: "task",
    entityId: task.id,
    marker: task.id, // dedupKeyFor가 task_created는 marker를 무시(taskId만으로 평생 1회)
    recipient: task.assigneeId, // 발송 직전 Slack member ID로 해석
    payload: {
      title: "새 작업 배정",
      text: lines.join("\n"),
      deeplinkPath: `/projects?task=${task.id}`,
      tone: "blue", // 예정/정보
    },
  };
}

/**
 * 할일 생성 알림 훅. **persist 성공 직후** 담당자에게 개인 DM(task_created)을 보낸다. **절대 throw하지 않는다.**
 * 게이트: Bot Token(personalDigestEnabled). 억제 조건:
 *  - 담당자 없음(도메인상 없을 수 없지만 방어) → no-op
 *  - 반복 템플릿 회차 자동 생성분(source=recurring_template) → no-op(아침 개인 브리핑이 커버 · 결정 ③)
 *  - digestRecipientAllowlist 밖 수신자 → no-op(personal_digest와 동일한 단계적 롤아웃 게이트)
 * 본인이 본인에게 할당한 생성도 발송한다(결정 ②). 방해금지(22-8) 창 안이면 enqueueAndSend가 hold(창 종료 후 발송).
 */
export async function notifyTaskCreated(
  db: MockQueDb,
  taskId: string,
  now: Date = new Date(),
): Promise<void> {
  if (!personalDigestEnabled()) return; // 개인 DM — Bot Token 게이트
  try {
    const task = db.tasks.find((t) => t.id === taskId);
    if (!task || !task.assigneeId) return;
    if (task.source === "recurring_template") return; // 템플릿 자동 생성분 억제(결정 ③)
    const allow = digestRecipientAllowlist();
    if (allow && !allow.includes(task.assigneeId)) return; // 단계적 롤아웃 게이트
    await enqueueAndSend(db, [buildTaskCreatedIntent(db, task)], now);
  } catch (error) {
    // 발송 로직 실패가 작업 생성을 되돌리지 않게 흡수한다(dispatch 기존 원칙).
    console.error("[que-notify] notifyTaskCreated 실패(무시)", error);
  }
}

/**
 * 데일리 "내가 도울게요" 도움 제안 DM(명세 C). **막힌 당사자(targetUserId)에게 개인 DM.** **절대 throw하지 않는다.**
 * 게이트: Bot Token(personalDigestEnabled). dedup `standup_help:<date>:<targetUserId>:<actorId>`(같은 날·조합당 평생 1회).
 * ⚠️ digestRecipientAllowlist를 **적용하지 않는다** — 당사자 간 직접 액션인 트랜잭셔널 알림이라 반드시 도달해야 한다
 *    (결제 DM notifyPaymentCreated/Done과 동일 결정 · enqueueAndSend가 allowlist를 보지 않으므로 그대로 우회).
 * 방해금지(22-8) 창 안이면 enqueueAndSend가 hold(창 종료 후 발송). 반환: 발송 성공 여부(토스트 분기용).
 */
export async function notifyStandupHelpOffered(
  db: MockQueDb,
  input: { actorId: string; targetUserId: string; blockerSummary?: string; date: string },
  now: Date = new Date(),
): Promise<boolean> {
  if (!personalDigestEnabled()) return false; // 개인 DM — Bot Token 게이트
  try {
    const nameOf = (id: string) => db.users.find((u) => u.id === id)?.name ?? id;
    const lines = [`${nameOf(input.actorId)} 님이 데일리 막힘을 보고 돕겠다고 나섰습니다.`];
    if (input.blockerSummary) lines.push(`막힘: ${input.blockerSummary}`);
    const intent: NotificationIntent = {
      kind: "standup_help",
      entityType: "user",
      entityId: input.targetUserId,
      // dedupKeyFor(standup_help)가 marker를 그대로 유일키로 쓴다 → <날짜>:<대상>:<제안자>.
      marker: `${input.date}:${input.targetUserId}:${input.actorId}`,
      recipient: input.targetUserId, // 발송 직전 Slack member ID로 해석
      payload: {
        title: "도움 제안",
        text: lines.join("\n"),
        deeplinkPath: "/daily",
        tone: "blue", // 예정/정보(도움은 긍정 신호)
      },
    };
    const counts = await enqueueAndSend(db, [intent], now);
    return counts.sent > 0;
  } catch (error) {
    console.error("[que-notify] notifyStandupHelpOffered 실패(무시)", error);
    return false;
  }
}

/** 금액 원화 콤마 포맷("1,234,000원"). 결제 DM 표시용(계좌번호와 무관 — 금액만). */
function formatWon(amount: number): string {
  return `${Math.round(amount).toLocaleString("ko-KR")}원`;
}

/**
 * 결제 요청 등록 DM(payment_created) 훅. **persist 성공 직후** 호출한다. **절대 throw하지 않는다.**
 * 수신자: **active 관리자(role=admin) 전원** — 각자 개인 DM. 등록자가 관리자면 **본인도 기록성 DM을 받는다**
 *   (2026-07-14 사용자 확정 — "관리자전원". 본인 행동 알림을 원한 것이 이 확장의 발단이라 본인 제외를 두지 않는다).
 * 게이트: Bot Token(personalDigestEnabled). dedup `payment_created:<paymentId>:<recipientId>`(결제·수신자당 평생 1회).
 * ⚠️ digestRecipientAllowlist(QUE_DIGEST_RECIPIENTS)를 **적용하지 않는다** — 프로덕션이 대표만 허용이라도
 *    결제 알림은 등록자·관리자에게 반드시 도달해야 한다는 사용자 결정(2026-07-14). 개인 브리핑 단계적
 *    롤아웃 게이트와 목적이 다른 **트랜잭셔널 알림**이라 allowlist를 우회한다.
 * ⚠️ 계좌번호는 payload에 절대 담지 않는다(마스킹 규칙 — Slack 계좌 유출 방지). 금액·제목·분류·요청자·마감일만.
 * 방해금지(22-8) 창 안이면 enqueueAndSend가 hold(창 종료 후 발송).
 */
export async function notifyPaymentCreated(
  db: MockQueDb,
  paymentId: string,
  now: Date = new Date(),
): Promise<void> {
  if (!personalDigestEnabled()) return; // 개인 DM — Bot Token 게이트
  try {
    const payment = db.paymentRequests.find((p) => p.id === paymentId);
    if (!payment) return;
    const nameOf = (id: string) => db.users.find((u) => u.id === id)?.name ?? id;
    const lines = [
      `제목: ${payment.title}`,
      `분류: ${payment.category}`,
      `금액: ${formatWon(payment.amount)}`,
      `요청자: ${nameOf(payment.requesterId)}`,
      `마감일: ${formatKstDateTime(payment.dueAt)}`,
    ];
    const admins = db.users.filter((u) => u.role === "admin" && u.active !== false);
    const intents: NotificationIntent[] = admins.map((admin) => ({
      kind: "payment_created",
      entityType: "payment_request",
      entityId: payment.id,
      marker: admin.id, // recipient로 dedup(수신자 개별화) — marker는 폴백 재료
      recipient: admin.id, // 발송 직전 Slack member ID로 해석
      payload: {
        title: "새 결제 요청",
        text: lines.join("\n"),
        deeplinkPath: "/payments",
        tone: "blue", // 정보성(NotificationTone에 green 없음)
      },
    }));
    if (intents.length === 0) return; // 등록자 외 active 관리자 없음
    await enqueueAndSend(db, intents, now);
  } catch (error) {
    // 발송 로직 실패가 결제 등록을 되돌리지 않게 흡수한다(dispatch 기존 원칙).
    console.error("[que-notify] notifyPaymentCreated 실패(무시)", error);
  }
}

/**
 * 결제 완료 DM(payment_done) 훅. **persist 성공 직후** 호출한다(status가 done으로 바뀐 뒤). **절대 throw하지 않는다.**
 * 수신자: **등록자(requesterId) + active 관리자 전원**(중복 제거 — 등록자가 관리자면 1건만). 처리자 본인 제외 없음
 *   (2026-07-14 사용자 확정 — 대표가 직접 완료 처리하고도 DM을 원한 것이 이 요청의 발단).
 * 게이트: Bot Token(personalDigestEnabled). dedup `payment_done:<paymentId>:<lastChangedAt ISO>:<recipientId>`
 *   (완료 이벤트·수신자당 1회, 재완료 시 재발송).
 * ⚠️ digestRecipientAllowlist를 적용하지 않는다(트랜잭셔널 — notifyPaymentCreated와 동일 결정).
 * ⚠️ 계좌번호는 payload에 절대 담지 않는다. 제목·금액·처리자·완료 시각만.
 * 방해금지(22-8) 창 안이면 enqueueAndSend가 hold(창 종료 후 발송).
 */
export async function notifyPaymentDone(
  db: MockQueDb,
  paymentId: string,
  now: Date = new Date(),
): Promise<void> {
  if (!personalDigestEnabled()) return; // 개인 DM — Bot Token 게이트
  try {
    const payment = db.paymentRequests.find((p) => p.id === paymentId);
    if (!payment) return;
    const nameOf = (id: string) => db.users.find((u) => u.id === id)?.name ?? id;
    const changedAt = payment.lastChangedAt ?? now.toISOString();
    const handler = payment.lastChangedBy ? nameOf(payment.lastChangedBy) : "-";
    const lines = [
      `제목: ${payment.title}`,
      `금액: ${formatWon(payment.amount)}`,
      `처리자: ${handler}`,
      `완료 시각: ${formatKstDateTime(changedAt)}`,
    ];
    // 등록자 + active 관리자 전원(중복 제거). 등록자가 비활성/부재여도 등록자 본인은 반드시 포함.
    const recipientIds = [
      ...new Set([
        ...(payment.requesterId ? [payment.requesterId] : []),
        ...db.users.filter((u) => u.role === "admin" && u.active !== false).map((u) => u.id),
      ]),
    ];
    const intents: NotificationIntent[] = recipientIds.map((rid) => ({
      kind: "payment_done",
      entityType: "payment_request",
      entityId: payment.id,
      marker: changedAt, // 완료 이벤트(lastChangedAt ISO)당 1회 — recipient로 개별화, 재완료 시 재발송
      recipient: rid, // 발송 직전 Slack member ID로 해석
      payload: {
        title: "결제 완료",
        text: lines.join("\n"),
        deeplinkPath: "/payments",
        tone: "blue", // 정보성(NotificationTone에 green 없음)
      },
    }));
    if (intents.length === 0) return;
    await enqueueAndSend(db, intents, now);
  } catch (error) {
    console.error("[que-notify] notifyPaymentDone 실패(무시)", error);
  }
}

/**
 * 크론 드레인. held 중 창이 끝난 것을 pending으로 풀고, pending + 재시도 가능한 failed를 전량 발송한다.
 * attempts 상한(MAX_ATTEMPTS) 초과 failed는 재시도하지 않는다(무한 재시도 방지).
 */
export async function drainOutbox(
  db: MockQueDb,
  now: Date,
): Promise<{ released: number; sent: number; failed: number }> {
  if (!notificationsEnabled()) return { released: 0, sent: 0, failed: 0 };
  const released = db.releaseHeldNotifications(now).length;
  // 각 항목은 자기 채널 크레덴셜이 켜져 있어야 발송한다 — 한쪽만 설정 시 다른 채널 항목을
  // 헛되이 failed로 만들지 않게(재시도 폭주 방지). personal_digest/recipient=Bot, 그 외=Webhook.
  const channelReady = (e: NotificationOutboxEntry): boolean =>
    e.kind === "personal_digest" || e.recipient ? personalDigestEnabled() : webhookEnabled();
  const targets = [
    ...db.pendingNotifications(),
    ...db.notificationOutbox.filter((e) => e.status === "failed" && e.attempts < MAX_ATTEMPTS),
  ].filter(channelReady);
  let sent = 0;
  let failed = 0;
  for (const entry of targets) {
    if (await sendEntry(db, entry)) sent += 1;
    else failed += 1;
  }
  if (released > 0 || targets.length > 0) await db.persist();
  return { released, sent, failed };
}

/** 마감 임박(기본 24h) 스캔 → 적재/발송. 크론용. */
export async function scanDeadlines(db: MockQueDb, now: Date): Promise<DispatchCounts> {
  if (!webhookEnabled()) return { enqueued: 0, sent: 0, held: 0 }; // 팀채널 발송 — Webhook 게이트
  const ctx = notificationContext(db, now);
  const intents = buildDeadlineIntents(ctx, db.tasks, deadlineThresholdHours());
  return enqueueAndSend(db, intents, now);
}

/**
 * 팀채널 "스탠드업 오픈" 게시 — 하루 1회 10:00(STANDUP_HOUR_KST). dedup_key `standup:team:<KST날짜>`.
 * 기획 §5 재편: 9→10시로 이동 + 내용 개편(오늘 마감 마일스톤 · 어제 요약 한 줄 + /daily 딥링크).
 * 크론이 10분마다라 발송 시(hour)에만 게이트를 열고, 그 시 첫 실행 1건만 dedup으로 발송된다.
 */
export async function postStandupDigest(db: MockQueDb, now: Date): Promise<boolean> {
  if (!webhookEnabled()) return false; // 팀채널 게시 — Webhook 게이트
  if (kstHour(now) !== STANDUP_HOUR_KST) return false;
  const dateKey = kstDateKey(now);
  // payload 없이 dedup 키만 먼저 확인 — 이미 오늘 발송했으면 getStandupData 로드를 아낀다.
  const probe: NotificationIntent = {
    kind: "standup",
    entityType: "team",
    entityId: "team",
    marker: dateKey,
    payload: { title: "", text: "", deeplinkPath: "/daily", tone: "violet" },
  };
  const key = dedupKeyFor(probe);
  if (db.notificationOutbox.some((e) => e.dedupKey === key)) return false;

  // 어제 요약 한 줄(getStandupData의 yesterday는 now 기준 어제).
  const rows = await getStandupData(now);
  const sum = (pick: (r: (typeof rows)[number]) => unknown[]) =>
    rows.reduce((acc, r) => acc + pick(r).length, 0);
  const done = sum((r) => r.yesterdayDone);
  const carried = sum((r) => r.yesterdayUnfinished);

  // 오늘 마감 마일스톤(KST) — 제목·위험 라벨. 최대 5개 표시.
  const RISK: Record<string, string> = { at_risk: "주의", late: "지연", on_track: "" };
  const dueToday = db.milestones.filter((m) => kstDateKeyOfIso(m.dueAt) === dateKey);
  const milestoneLine =
    dueToday.length > 0
      ? "오늘 마감 마일스톤: " +
        dueToday
          .slice(0, 5)
          .map((m) => (RISK[m.riskStatus] ? `${m.title}(${RISK[m.riskStatus]})` : m.title))
          .join(", ") +
        (dueToday.length > 5 ? ` 외 ${dueToday.length - 5}건` : "")
      : "오늘 마감 마일스톤 없음";

  const intent: NotificationIntent = {
    ...probe,
    payload: {
      title: "스탠드업이 열렸습니다",
      text: `${milestoneLine}\n어제 완료 ${done} · 이월 ${carried} — 오늘 체크인을 남겨 주세요.`,
      deeplinkPath: "/daily",
      tone: "violet",
    },
  };
  const created = db.enqueueNotifications([intent]);
  if (created.length === 0) return false; // 동시 크론 등으로 방금 적재됨
  await db.persist();
  await sendEntry(db, created[0]);
  await db.persist();
  return true;
}

/**
 * 개인 DM "초안으로 시작" — 10:00 스탠드업 오픈 시 아직 미제출인 활성 유저에게. Bot Token 게이트.
 * 버튼(url=/daily 딥링크)으로 바로 체크인 화면을 연다. dedup `standup_open:<userId>:<KST날짜>`.
 * allowlist(QUE_DIGEST_RECIPIENTS)를 존중(개인 DM 계열 공통 롤아웃 게이트). 방해금지 창은 enqueueAndSend가 흡수.
 */
export async function postStandupOpenPrompts(db: MockQueDb, now: Date): Promise<DispatchCounts> {
  const empty: DispatchCounts = { enqueued: 0, sent: 0, held: 0 };
  if (!personalDigestEnabled()) return empty; // 개인 DM — Bot Token 게이트
  if (kstHour(now) !== STANDUP_HOUR_KST) return empty;
  try {
    const dateKey = kstDateKey(now);
    const submitted = new Set(db.standupEntriesByDate(dateKey).map((e) => e.userId));
    const allow = digestRecipientAllowlist();
    const deeplink = `${appBaseUrl()}/daily`;
    const intents: NotificationIntent[] = db.users
      .filter((u) => u.active !== false && !submitted.has(u.id))
      .filter((u) => !allow || allow.includes(u.id))
      .map((u) => ({
        kind: "standup_open",
        entityType: "user",
        entityId: u.id,
        marker: dateKey,
        recipient: u.id,
        payload: {
          title: "데일리 스탠드업",
          text: "오늘 스탠드업이 열렸습니다. 초안으로 빠르게 시작해 보세요.",
          deeplinkPath: "/daily",
          tone: "violet",
          actions: [
            { actionId: "standup:open_draft", label: "초안으로 시작", value: dateKey, url: deeplink, style: "primary" },
          ],
        },
      }));
    return await enqueueAndSend(db, intents, now);
  } catch (error) {
    console.error("[que-notify] postStandupOpenPrompts 실패(무시)", error);
    return empty;
  }
}

/**
 * 미제출 재촉 DM "지금 작성" — 10:40~11:00 창, 당일 체크인 없는 활성 유저에게만. Bot Token 게이트.
 * dedup `standup_remind:<userId>:<KST날짜>`(유저·날짜당 1회). 버튼 url=/daily 딥링크. allowlist 존중.
 */
export async function postStandupReminders(db: MockQueDb, now: Date): Promise<DispatchCounts> {
  const empty: DispatchCounts = { enqueued: 0, sent: 0, held: 0 };
  if (!personalDigestEnabled()) return empty; // 개인 DM — Bot Token 게이트
  const minute = kstMinute(now);
  if (minute < STANDUP_REMIND_WINDOW_START_MIN || minute >= STANDUP_REMIND_WINDOW_END_MIN)
    return empty;
  try {
    const dateKey = kstDateKey(now);
    const submitted = new Set(db.standupEntriesByDate(dateKey).map((e) => e.userId));
    const allow = digestRecipientAllowlist();
    // (명세 A) 오늘 부재자(자리비움·외부 일정)는 재촉하지 않는다 — 발송 후 억제가 아니라 **아예 스킵**
    // (dedup 키는 그대로: 스킵이라 아웃박스에 적재조차 안 함 → 복귀 후 다른 창에서 재적재 가능).
    const absent = absentUserIdsToday(db, now);
    const deeplink = `${appBaseUrl()}/daily`;
    const intents: NotificationIntent[] = db.users
      .filter((u) => u.active !== false && !submitted.has(u.id))
      .filter((u) => !absent.has(u.id)) // 부재자 스킵
      .filter((u) => !allow || allow.includes(u.id))
      .map((u) => ({
        kind: "standup_remind",
        entityType: "user",
        entityId: u.id,
        marker: dateKey,
        recipient: u.id,
        payload: {
          title: "스탠드업 체크인 미제출",
          text: "아직 오늘 스탠드업 체크인이 없습니다. 11시 팀 요약 전에 남겨 주세요.",
          deeplinkPath: "/daily",
          tone: "amber",
          actions: [
            { actionId: "standup:remind_write", label: "지금 작성", value: dateKey, url: deeplink, style: "primary" },
          ],
        },
      }));
    return await enqueueAndSend(db, intents, now);
  } catch (error) {
    console.error("[que-notify] postStandupReminders 실패(무시)", error);
    return empty;
  }
}

/**
 * 팀채널 AI 팀 요약 게시(기획 §3②·§8-2) — **⑴전원 제출 즉시 ⑵11:00 컷오프 중 먼저 오는 쪽**.
 * Webhook 게이트. dedup `standup_summary:team:<KST날짜>`로 날짜당 1회. 이미 게시했으면 스킵.
 * 요약이 아직 없으면 generateTeamSummary(pro→flash)로 생성(admin 재생성분이 있으면 그대로 재사용해 게시).
 * 최소 1명은 제출돼 있어야 생성한다(전무면 요약할 게 없어 스킵).
 * @returns 게시 여부 + 생성에 쓴 모델(생성 없이 게시만 했으면 기존 요약 모델).
 */
export async function postStandupTeamSummary(
  db: MockQueDb,
  now: Date,
): Promise<{ posted: boolean; model?: "flash" | "pro" }> {
  if (!webhookEnabled()) return { posted: false }; // 팀채널 게시 — Webhook 게이트
  const dateKey = kstDateKey(now);

  // 이미 게시했으면(아웃박스 dedup 존재) 스킵 — 값비싼 AI 요약 생성/조회를 아낀다.
  const probe: NotificationIntent = {
    kind: "standup_summary",
    entityType: "team",
    entityId: "team",
    marker: dateKey,
    payload: { title: "", text: "", deeplinkPath: "/daily", tone: "violet" },
  };
  const key = dedupKeyFor(probe);
  if (db.notificationOutbox.some((e) => e.dedupKey === key)) return { posted: false };

  // 트리거: (전원 제출 & 스탠드업 오픈 이후) 또는 11:00 컷오프 도달 — 먼저 오는 쪽.
  const activeUsers = db.users.filter((u) => u.active !== false);
  const entries = db.standupEntriesByDate(dateKey);
  if (entries.length === 0) return { posted: false }; // 제출 전무 — 요약할 게 없다
  const allSubmitted =
    activeUsers.length > 0 && activeUsers.every((u) => entries.some((e) => e.userId === u.id));
  const hour = kstHour(now);
  const cutoffReached = hour >= STANDUP_SUMMARY_HOUR_KST;
  const earlyComplete = allSubmitted && hour >= STANDUP_HOUR_KST;
  if (!earlyComplete && !cutoffReached) return { posted: false };

  try {
    // 요약이 아직 없으면 생성(admin 재생성분이 있으면 재사용). generateTeamSummary가 저장·persist까지 한다.
    let summary = db.standupTeamSummaryByDate(dateKey);
    if (!summary) {
      summary = await generateTeamSummary(db, now);
    }

    const missing = activeUsers.filter(
      (u) => !summary!.submittedUserIds.includes(u.id),
    );
    const header = missing.length > 0 ? `제출 ${entries.length}/${activeUsers.length} · ${missing.length}인 미제출` : `전원 제출(${activeUsers.length}인)`;

    // (명세 E) 막힘 있는 제출자를 Slack 멘션(<@U…>)으로. AI 본문 파싱에 의존하지 않고 standup_entries의
    // 막힘 보유자 목록에서 **결정적으로** 뽑는다(막힘서술 또는 blockedTaskIds). slack_user_id 매핑이 없으면
    // 이름 텍스트로 폴백(resolveSlackUserId가 undefined면 이름). "도울 사람"은 entries에서 결정적으로
    // 산출할 근거가 없어 생략한다(요약 본문 파싱 금지 원칙). 게시 트리거·시각·dedup은 무변경.
    const nameOf = (id: string) => db.users.find((u) => u.id === id)?.name ?? id;
    const blockerHolders = entries.filter(
      (e) => (e.blockerText && e.blockerText.trim()) || (e.blockedTaskIds && e.blockedTaskIds.length > 0),
    );
    let text = header;
    if (blockerHolders.length > 0) {
      const mentions = await Promise.all(
        blockerHolders.map(async (e) => {
          const slackId = await resolveSlackUserId(e.userId);
          return slackId ? `<@${slackId}>` : nameOf(e.userId);
        }),
      );
      text = `${header}\n막힘 있는 팀원: ${mentions.join(" ")}`;
    }

    const intent: NotificationIntent = {
      ...probe,
      payload: {
        title: "데일리 스탠드업 팀 요약",
        text,
        deeplinkPath: "/daily",
        tone: "violet",
        detail: summary.content,
      },
    };
    const created = db.enqueueNotifications([intent]);
    if (created.length === 0) return { posted: false, model: summary.model }; // 방금 적재됨
    await db.persist();
    await sendEntry(db, created[0]);
    await db.persist();
    return { posted: true, model: summary.model };
  } catch (error) {
    console.error("[que-notify] postStandupTeamSummary 실패(무시)", error);
    return { posted: false };
  }
}

/**
 * 팀채널 주간 통합 회의 아젠다 게시(기획 §1-f "회의 전") — 월요일 09:00~09:30 창, 하루 1회.
 * Webhook 게이트. dedup `weekly_agenda:team:<KST날짜>`. 주말 게이트와 무관(월요일 자체 게이트).
 * buildWeeklyAgenda(withSummary)로 pro 요약문을 만들고, 실패해도 데이터 5섹션 헤더는 게시한다.
 * 요약문(있으면)을 detail로, 딥링크는 /daily(오늘 보드에서 회의 진행).
 */
export async function postWeeklyAgenda(db: MockQueDb, now: Date): Promise<boolean> {
  if (!webhookEnabled()) return false; // 팀채널 게시 — Webhook 게이트
  if (kstDayOfWeek(now) !== WEEKLY_AGENDA_DAY_KST) return false;
  const minute = kstMinuteOfDay(now);
  if (minute < WEEKLY_AGENDA_WINDOW_START_MIN || minute >= WEEKLY_AGENDA_WINDOW_END_MIN) return false;

  const dateKey = kstDateKey(now);
  const probe: NotificationIntent = {
    kind: "weekly_agenda",
    entityType: "team",
    entityId: "team",
    marker: dateKey,
    payload: { title: "", text: "", deeplinkPath: "/daily", tone: "violet" },
  };
  const key = dedupKeyFor(probe);
  if (db.notificationOutbox.some((e) => e.dedupKey === key)) return false;

  try {
    const agenda = await buildWeeklyAgenda(db, now, { withSummary: true });
    // 요약 실패 시 5섹션 건수 헤더로 폴백(데이터 섹션은 항상 동작).
    const counts = [
      `마감 마일스톤 ${agenda.thisWeek.dueMilestones.length}`,
      `위험 ${agenda.milestoneAgenda.risky.length}`,
      `결정 필요 ${agenda.decisions.length}`,
      `팀 라운드 ${agenda.teamRound.length}인`,
    ].join(" · ");
    const intent: NotificationIntent = {
      ...probe,
      payload: {
        title: "주간 통합 회의 아젠다",
        text: "오늘 10시 주간 회의 사전 아젠다입니다.",
        deeplinkPath: "/daily",
        tone: "violet",
        detail: agenda.summary ?? counts,
      },
    };
    const created = db.enqueueNotifications([intent]);
    if (created.length === 0) return false;
    await db.persist();
    await sendEntry(db, created[0]);
    await db.persist();
    return true;
  } catch (error) {
    console.error("[que-notify] postWeeklyAgenda 실패(무시)", error);
    return false;
  }
}

/**
 * 체크인 재촉 DM(C-2) — 응답 대기 체크인을 담당자 개인 DM으로, 버튼과 함께.
 * 게이트: slackInteractiveEnabled(Bot Token + Signing Secret 둘 다) — 버튼을 받을 수신
 * 엔드포인트가 없으면 발송하지 않는다(죽은 버튼 방지). dedup은 체크인·날짜당 1회
 * (`checkin_prompt:<checkInId>:<KST날짜>`), 방해금지 창은 enqueueAndSend가 hold로 흡수.
 * 크론(10분 주기)마다 스캔하지만 dedup이 하루 1회로 눌러준다.
 */
export async function postCheckinPrompts(db: MockQueDb, now: Date): Promise<DispatchCounts> {
  if (!slackInteractiveEnabled()) return { enqueued: 0, sent: 0, held: 0 };
  try {
    const intents = buildCheckinPromptIntents(db, now);
    return await enqueueAndSend(db, intents, now);
  } catch (error) {
    // 재촉 DM 실패가 크론(sync·다른 알림)을 깨지 않게 흡수한다.
    console.error("[que-notify] postCheckinPrompts 실패(무시)", error);
    return { enqueued: 0, sent: 0, held: 0 };
  }
}

/** 개인 브리핑 발송 결과 요약(크론 응답용). */
export interface PersonalDigestCounts {
  enqueued: number;
  sent: number;
  failed: number;
}

/**
 * 개인 DM 데일리 브리핑 — active 유저별 하루 1회 아침(9:30~10:00 KST 창, 기획 §5 재편). Bot Token 게이트.
 * dedup_key `personal_digest:<userId>:<YYYY-MM-DD(KST)>`로 유저·날짜당 1건. 10분 주기 크론 지연을
 * 분 단위 창으로 흡수하되, 창 안 첫 실행이 적재→발송하고 이후 실행은 dedup으로 no-op이 된다.
 * 8명 순차 발송이 함수 타임아웃에 걸리지 않게 Promise.allSettled로 병렬 발송한다.
 * 빈 브리핑(전 섹션 0건) 유저는 빌더가 intent를 생략하므로 여기서 enqueue되지 않는다.
 */
export async function postPersonalDigests(
  db: MockQueDb,
  now: Date,
): Promise<PersonalDigestCounts> {
  const empty: PersonalDigestCounts = { enqueued: 0, sent: 0, failed: 0 };
  if (!personalDigestEnabled()) return empty; // 개인 DM — Bot Token 게이트
  const minutes = kstMinuteOfDay(now);
  if (minutes < DIGEST_WINDOW_START_MIN || minutes > DIGEST_WINDOW_END_MIN) return empty;

  try {
    const intents = buildPersonalDigestIntents(db, now);
    if (intents.length === 0) return empty;
    const created = db.enqueueNotifications(intents); // 유저·날짜 dedup — 이미 보낸 유저는 걸러진다
    if (created.length === 0) return empty; // 오늘분 전부 적재 완료(재실행)
    await db.persist(); // 적재를 먼저 커밋 — 발송 실패해도 크론 drainOutbox가 재시도

    const results = await Promise.allSettled(created.map((entry) => sendEntry(db, entry)));
    let sent = 0;
    let failed = 0;
    for (const r of results) {
      if (r.status === "fulfilled" && r.value) sent += 1;
      else failed += 1;
    }
    await db.persist(); // sent/failed 상태 반영
    return { enqueued: created.length, sent, failed };
  } catch (error) {
    // 개인 브리핑 실패가 크론(sync·다른 알림)을 깨지 않게 흡수한다.
    console.error("[que-notify] postPersonalDigests 실패(무시)", error);
    return empty;
  }
}
