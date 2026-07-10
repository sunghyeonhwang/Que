import { timingSafeEqual } from "node:crypto";
import { getDb } from "@/lib/db";
import { notificationsEnabled } from "@/lib/notifications/config";
import {
  drainOutbox,
  postCheckinPrompts,
  postPersonalDigests,
  postStandupDigest,
  scanDeadlines,
} from "@/lib/notifications/dispatch";

export const dynamic = "force-dynamic";

// 체크인·반복업무 스케줄러 Cron 진입점.
// Vercel Cron이 주기적으로 GET 호출 → core 스케줄러를 실행해 정시에 체크인/반복 Task 생성.
// 사용자 트래픽과 분리(요청 경로 lazy 실행의 "아무도 접속 안 하면 안 생김" 문제 해소).
// 인증 축은 사용자 PAT(withApi)가 아니라 CRON_SECRET — Vercel Cron이 자동으로 Bearer로 붙인다.

function authorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  // 미설정이면 무조건 거부 — 빈 문자열이 "헤더 없음"으로 우회 통과하지 않게.
  if (!secret) return false;
  const provided = request.headers.get("authorization") ?? "";
  const expected = `Bearer ${secret}`;
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false; // timingSafeEqual은 길이 같아야 함
  return timingSafeEqual(a, b);
}

export async function GET(request: Request) {
  if (!authorized(request)) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  const now = new Date();
  const db = await getDb(); // 같은 인스턴스로 sync→persist (라우트 경계 캐시 정체성 주의)
  const checkInsCreated = db.syncCheckIns(now).length;
  const tasksCreated = db.syncRecurringTemplates(now).length;
  await db.persist();

  // Slack 알림 드레인/스캔/스탠드업/개인브리핑. 기존 sync와 분리된 try/catch — 알림 실패가 sync를 깨지 않는다.
  // 게이트: 팀채널=SLACK_WEBHOOK_URL, 개인DM=SLACK_BOT_TOKEN. 둘 다 미설정이면 notificationsEnabled()=false로 블록 skip.
  // 한쪽만 설정돼도 각 함수가 자기 크레덴셜로 개별 판정 → 설정된 채널만 동작(다른 쪽 조용히 no-op).
  let notifications:
    | {
        deadlineEnqueued: number;
        deadlineSent: number;
        released: number;
        drainedSent: number;
        drainedFailed: number;
        standupSent: boolean;
        digestEnqueued: number;
        digestSent: number;
        digestFailed: number;
        checkinPromptEnqueued: number;
        checkinPromptSent: number;
      }
    | { error: true }
    | { skipped: true } = { skipped: true };
  if (notificationsEnabled()) {
    try {
      const deadline = await scanDeadlines(db, now);
      const drained = await drainOutbox(db, now);
      const standupSent = await postStandupDigest(db, now);
      // 개인 DM 브리핑 — Bot Token 게이트 + 9:50~10:30 KST 창. 자체 try/catch로 sync·팀채널과 격리.
      const digest = await postPersonalDigests(db, now);
      // 체크인 재촉 DM(C-2) — Bot Token+Signing Secret 게이트, dedup이 체크인·날짜당 1회로 제한.
      const checkinPrompt = await postCheckinPrompts(db, now);
      notifications = {
        deadlineEnqueued: deadline.enqueued,
        deadlineSent: deadline.sent,
        released: drained.released,
        drainedSent: drained.sent,
        drainedFailed: drained.failed,
        standupSent,
        digestEnqueued: digest.enqueued,
        digestSent: digest.sent,
        digestFailed: digest.failed,
        checkinPromptEnqueued: checkinPrompt.enqueued,
        checkinPromptSent: checkinPrompt.sent,
      };
    } catch (error) {
      console.error("[que-cron] 알림 처리 실패(무시)", error);
      notifications = { error: true };
    }
  }

  return Response.json({
    ok: true,
    checkInsCreated,
    tasksCreated,
    notifications,
    at: now.toISOString(),
  });
}
