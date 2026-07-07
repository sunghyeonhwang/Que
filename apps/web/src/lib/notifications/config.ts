import "server-only";

// Slack 알림 환경 게이트 (B-1). 발송/적재(dispatch·cron)가 켤지 말지를 이 헬퍼로 판정한다.
//
// ⚠️ 게이트 정책: SLACK_WEBHOOK_URL이 미설정이면 알림 경로 자체를 비활성한다 — enqueue도 하지 않는다.
//    (Sentry의 enabled:!!dsn과 동일 사상.) 이렇게 해야 나중에 URL을 추가했을 때, 그동안 쌓였을
//    옛 알림이 한꺼번에 쏟아지지 않는다. dispatch 훅은 반드시 notificationsEnabled()로 먼저 가드한다.

/** 팀 채널 Incoming Webhook URL. 미설정/공백이면 undefined. (시크릿 — Vercel env 전용, 클라이언트 노출 금지.) */
export function slackWebhookUrl(): string | undefined {
  const url = process.env.SLACK_WEBHOOK_URL?.trim();
  return url ? url : undefined;
}

/** 알림 경로 활성 여부. false면 enqueue·발송을 모두 건너뛴다. */
export function notificationsEnabled(): boolean {
  return slackWebhookUrl() !== undefined;
}

/** 딥링크 베이스 URL. 미설정이면 프로덕션 도메인. (하드코딩 금지 — env 우선.) */
export function appBaseUrl(): string {
  const url = process.env.QUE_APP_URL?.trim();
  return url ? url.replace(/\/+$/, "") : "https://que.griff.co.kr";
}

/**
 * 방해금지(quiet hours) 창 — KST 기준 [start, end) 시(hour). start>end면 자정을 넘는다(예: 22-8).
 * env `QUE_QUIET_HOURS`(기본 "22-8"). "off"/"none"/빈값/잘못된 형식이면 null(방해금지 없음).
 * start===end면 창 없음(null)으로 본다.
 */
export function quietHoursConfig(): { start: number; end: number } | null {
  const raw = (process.env.QUE_QUIET_HOURS ?? "22-8").trim().toLowerCase();
  if (!raw || raw === "off" || raw === "none") return null;
  const m = raw.match(/^(\d{1,2})\s*-\s*(\d{1,2})$/);
  if (!m) return null;
  const start = Number(m[1]);
  const end = Number(m[2]);
  if (!Number.isInteger(start) || !Number.isInteger(end)) return null;
  if (start < 0 || start > 23 || end < 0 || end > 23) return null;
  if (start === end) return null;
  return { start, end };
}
