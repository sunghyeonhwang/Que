import "server-only";

import {
  buildDeadlineIntents,
  buildStatusChangeIntents,
  dedupKeyFor,
  messageFor,
  type MockQueDb,
  type NotificationContext,
  type NotificationIntent,
  type NotificationOutboxEntry,
  type StatusDetail,
  type TaskStatus,
} from "@que/core";
import { getStandupData } from "@/lib/team-data";
import {
  deadlineThresholdHours,
  notificationsEnabled,
  personalDigestEnabled,
  quietHoursConfig,
  webhookEnabled,
} from "./config";
import { buildPersonalDigestIntents } from "./personal-digest";
import { postToSlack } from "./slack";
import { postDmToSlack, resolveSlackUserId } from "./slack-bot";

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
// 스탠드업 다이제스트 발송 시각(KST 시). 크론이 */10이라 이 시(hour) 첫 실행 1건만 dedup으로 발송된다.
// 방해금지 기본 창(22-8) 밖의 아침 시각으로 둬 자정 발송·야간 발송을 막는다.
const STANDUP_HOUR_KST = 9;
// 개인 DM 브리핑 발송 창(KST 분 단위). 9:50~10:30 — 크론(*/10) 지연을 흡수하되 하루 1회는 dedup으로 강제.
// standup의 hour 게이트와 달리 분 단위 창을 쓰는 이유: 9:50 정시 크론이 밀려도 창 안 첫 실행이 발송.
const DIGEST_WINDOW_START_MIN = 9 * 60 + 50; // 09:50
const DIGEST_WINDOW_END_MIN = 10 * 60 + 30; // 10:30

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
  // enqueueAndSend는 팀채널(status/deadline) 전용 경로 — Webhook 크레덴셜로 게이트한다.
  if (!webhookEnabled() || intents.length === 0) return counts;
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
 * 팀 데일리 스탠드업 다이제스트 — 하루 1회 아침(STANDUP_HOUR_KST). dedup_key
 * `standup:team:<YYYY-MM-DD(KST)>`로 중복 차단. 크론이 10분마다라 발송 시(hour)에만 게이트를 열고,
 * 그 시의 첫 실행 1건만 dedup으로 발송된다(나머지·다른 시각 실행은 no-op=false).
 * 시간창 게이트로 자정·야간(방해금지) 발송을 막는다.
 */
export async function postStandupDigest(db: MockQueDb, now: Date): Promise<boolean> {
  if (!webhookEnabled()) return false; // 팀채널 다이제스트 — Webhook 게이트
  if (kstHour(now) !== STANDUP_HOUR_KST) return false;
  const dateKey = kstDateKey(now);
  // payload 없이 dedup 키만 먼저 확인 — 이미 오늘 발송했으면 getStandupData 로드를 아낀다.
  const probe: NotificationIntent = {
    kind: "standup",
    entityType: "team",
    entityId: "team",
    marker: dateKey,
    payload: { title: "", text: "", deeplinkPath: "/team", tone: "violet" },
  };
  const key = dedupKeyFor(probe);
  if (db.notificationOutbox.some((e) => e.dedupKey === key)) return false;

  const rows = await getStandupData(now);
  const sum = (pick: (r: (typeof rows)[number]) => unknown[]) =>
    rows.reduce((acc, r) => acc + pick(r).length, 0);
  const done = sum((r) => r.yesterdayDone);
  const carried = sum((r) => r.yesterdayUnfinished);
  const today = sum((r) => r.todayPlanned);
  const blocked = sum((r) => r.blocked);

  const intent: NotificationIntent = {
    ...probe,
    payload: {
      title: "데일리 스탠드업",
      text: `어제 완료 ${done} · 이월 ${carried} · 오늘 예정 ${today} · 막힘 ${blocked}`,
      deeplinkPath: "/team",
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

/** 개인 브리핑 발송 결과 요약(크론 응답용). */
export interface PersonalDigestCounts {
  enqueued: number;
  sent: number;
  failed: number;
}

/**
 * 개인 DM 데일리 브리핑 — active 유저별 하루 1회 아침(9:50~10:30 KST 창). Bot Token 게이트.
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
