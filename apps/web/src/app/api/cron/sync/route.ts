import { timingSafeEqual } from "node:crypto";
import { getDb } from "@/lib/db";
import { notificationsEnabled } from "@/lib/notifications/config";
import {
  drainOutbox,
  isKstWeekend,
  postCheckinPrompts,
  postPersonalDigests,
  postStandupDigest,
  postStandupOpenPrompts,
  postStandupReminders,
  postStandupTeamSummary,
  postWeeklyAgenda,
  scanDeadlines,
} from "@/lib/notifications/dispatch";
import { postWeeklyPreview } from "@/lib/notifications/weekly-preview";
import { scanCrisisTriggers, scanChangeRequestSla } from "@/lib/notifications/crisis";

export const dynamic = "force-dynamic";
// 팀 요약(§3②)·주간 프리뷰(§1-d)가 pro(gemini)를 호출 — 수십 초 걸릴 수 있어 함수 시간 명시(기본값 의존 금지).
export const maxDuration = 60;

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
        weekend: boolean;
        standupSent: boolean;
        standupOpenSent: number;
        standupRemindSent: number;
        standupSummaryPosted: boolean;
        weeklyPreviewPosted: boolean;
        weeklyAgendaPosted: boolean;
        crisisEnqueued: number;
        crisisSent: number;
        changeSlaEnqueued: number;
        changeSlaSent: number;
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
      // 마감 임박·아웃박스 드레인은 요일 무관 상시(마감은 주말도 다가오고, 드레인은 held 방출을 막으면 안 됨).
      const deadline = await scanDeadlines(db, now);
      const drained = await drainOutbox(db, now);
      // 주간 프리뷰는 금요일 16:00 자체 게이트 — 주말 게이트와 무관해 상시 호출(내부에서 요일·시각 판정).
      const weeklyPreviewPosted = await postWeeklyPreview(db, now);
      // 주간 통합 회의 아젠다는 월요일 09:00~09:30 자체 게이트 — 상시 호출(내부에서 요일·시각·dedup 판정).
      const weeklyAgendaPosted = await postWeeklyAgenda(db, now);
      // 긴급 결정 감지·발송·에스컬레이션 — 평일 게이트·dedup·하루 3건 상한은 함수 내부. 시각 무관 상시 스캔.
      const crisis = await scanCrisisTriggers(db, now);
      // 외부 변경 SLA(OS-2b) — 12h 전 재촉·마감 초과 에스컬레이션. 평일 게이트·dedup은 함수 내부.
      const changeSla = await scanChangeRequestSla(db, now);
      // 주말 게이트(§8-5): KST 토·일이면 스탠드업 리듬(오픈/재촉/요약)·개인 브리핑을 스킵한다.
      // 마감 스캔·드레인·체크인 재촉(진행 중 작업 리듬)은 유지한다.
      const weekend = isKstWeekend(now);
      const standupSent = weekend ? false : await postStandupDigest(db, now); // 팀채널 오픈(10:00)
      const standupOpen = weekend
        ? { enqueued: 0, sent: 0, held: 0 }
        : await postStandupOpenPrompts(db, now); // 개인 DM "초안으로 시작"(10:00)
      const standupRemind = weekend
        ? { enqueued: 0, sent: 0, held: 0 }
        : await postStandupReminders(db, now); // 미제출 재촉(10:40~11:00)
      const standupSummary = weekend
        ? { posted: false }
        : await postStandupTeamSummary(db, now); // 팀 요약(전원 제출/11:00 먼저 오는 쪽)
      // 개인 DM 브리핑 — Bot Token 게이트 + 9:30~10:00 KST 창. 자체 try/catch로 sync·팀채널과 격리.
      const digest = weekend
        ? { enqueued: 0, sent: 0, failed: 0 }
        : await postPersonalDigests(db, now);
      // 체크인 재촉 DM(C-2) — Bot Token+Signing Secret 게이트, dedup이 체크인·날짜당 1회로 제한. 요일 무관.
      const checkinPrompt = await postCheckinPrompts(db, now);
      notifications = {
        deadlineEnqueued: deadline.enqueued,
        deadlineSent: deadline.sent,
        released: drained.released,
        drainedSent: drained.sent,
        drainedFailed: drained.failed,
        weekend,
        standupSent,
        standupOpenSent: standupOpen.sent,
        standupRemindSent: standupRemind.sent,
        standupSummaryPosted: standupSummary.posted,
        weeklyPreviewPosted,
        weeklyAgendaPosted,
        crisisEnqueued: crisis.enqueued,
        crisisSent: crisis.sent,
        changeSlaEnqueued: changeSla.enqueued,
        changeSlaSent: changeSla.sent,
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
