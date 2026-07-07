import "server-only";

import { createClient } from "@supabase/supabase-js";
import { emailForUser, type SlackMessage } from "@que/core";
import { appBaseUrl, slackBotToken } from "./config";

// Slack Bot(개인 DM) 발송 어댑터 — Slack Phase 2. SDK 없이 Web API를 fetch로만 호출한다(서버리스 친화).
//
// 핵심: 아웃박스 recipient엔 Que userId만 저장하고, 발송 직전 여기서 Slack member ID로 해석한다.
//   1) users.slack_user_id 캐시가 있으면 그대로 사용.
//   2) 없으면 email(users.email 직조회 → 폴백 emailForUser)로 Slack users.lookupByEmail(Bot Token).
//   3) 성공하면 users.slack_user_id에 backfill(전용 직접 UPDATE — persist는 users를 write-back하지 않으므로).
// ⚠️ slack_user_id·email은 도메인 User에 넣지 않는다(supabase-db load에서 삭제). 여기서만 직조회한다.
//
// Slack Web API는 논리 오류도 HTTP 200 + { ok:false, error }로 준다 — 반드시 body.ok를 확인하고 실패면 throw.
// 실패(비ok/네트워크/타임아웃)는 호출부(dispatch.sendEntry)가 outbox status=failed로 흡수해 크론이 재시도한다.

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SECRET_KEY = process.env.SUPABASE_SECRET_KEY;
const useSupabase =
  process.env.QUE_DB === "supabase" && !!SUPABASE_URL && !!SUPABASE_SECRET_KEY;

const TIMEOUT_MS = 5000;
const SLACK_API = "https://slack.com/api";

const TONE_COLOR: Record<SlackMessage["tone"], string> = {
  red: "#e33030",
  amber: "#f59e0b",
  violet: "#7c3aed",
  blue: "#2563eb",
};

/** 관리자 전용 직접 쿼리용 클라이언트. supabase 모드가 아니면 null. */
function adminClient() {
  if (!useSupabase) return null;
  return createClient(SUPABASE_URL!, SUPABASE_SECRET_KEY!, {
    auth: { persistSession: false },
  });
}

/** Slack Web API 공통 호출. Bot Token Bearer + 타임아웃. body.ok=false면 throw. */
async function slackApi<T extends { ok: boolean; error?: string }>(
  method: string,
  token: string,
  body: Record<string, unknown>,
): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(`${SLACK_API}/${method}`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${token}`,
        "content-type": "application/json; charset=utf-8",
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    if (!res.ok) throw new Error(`Slack ${method} HTTP ${res.status}`);
    const json = (await res.json()) as T;
    if (!json.ok) throw new Error(`Slack ${method} 오류: ${json.error ?? "unknown"}`);
    return json;
  } finally {
    clearTimeout(timer);
  }
}

/** DB users.email 직조회(관리자 전용 컬럼). 없으면 폴백 유도 이메일(emailForUser). */
async function emailFor(queUserId: string): Promise<string> {
  const client = adminClient();
  if (client) {
    const { data } = await client
      .from("users")
      .select("email")
      .eq("id", queUserId)
      .maybeSingle();
    const email = (data as { email?: string } | null)?.email;
    if (email) return email;
  }
  return emailForUser(queUserId);
}

/** users.slack_user_id 캐시 조회. 없거나 mock 모드면 undefined. */
async function cachedSlackId(queUserId: string): Promise<string | undefined> {
  const client = adminClient();
  if (!client) return undefined;
  const { data } = await client
    .from("users")
    .select("slack_user_id")
    .eq("id", queUserId)
    .maybeSingle();
  const id = (data as { slack_user_id?: string } | null)?.slack_user_id;
  return id ? id : undefined;
}

/** 해석 성공 시 users.slack_user_id에 backfill(전용 직접 UPDATE). persist가 users를 안 건드리므로 여기서. */
async function backfillSlackId(queUserId: string, slackUserId: string): Promise<void> {
  const client = adminClient();
  if (!client) return;
  await client.from("users").update({ slack_user_id: slackUserId }).eq("id", queUserId);
}

/**
 * Que userId → Slack member ID. 캐시 → email lookup → backfill 순.
 * Bot Token 미설정이거나 매핑 실패면 undefined(호출부가 skip/failed 처리).
 */
export async function resolveSlackUserId(queUserId: string): Promise<string | undefined> {
  const token = slackBotToken();
  if (!token) return undefined;

  const cached = await cachedSlackId(queUserId);
  if (cached) return cached;

  const email = await emailFor(queUserId);
  const res = await slackApi<{ ok: boolean; error?: string; user?: { id: string } }>(
    "users.lookupByEmail",
    token,
    { email },
  );
  const slackUserId = res.user?.id;
  if (!slackUserId) return undefined;
  // best-effort 캐시 — 실패해도 발송은 진행(다음 발송에서 다시 lookup).
  try {
    await backfillSlackId(queUserId, slackUserId);
  } catch (error) {
    console.error("[que-notify] slack_user_id backfill 실패(무시)", queUserId, error);
  }
  return slackUserId;
}

/**
 * 개인 DM 발송. conversations.open으로 DM 채널을 열고 chat.postMessage로 보낸다.
 * 딥링크는 QUE_APP_URL + deeplinkPath. 실패(비ok/타임아웃)면 throw(호출부가 markFailed).
 */
export async function postDmToSlack(slackUserId: string, msg: SlackMessage): Promise<void> {
  const token = slackBotToken();
  if (!token) throw new Error("SLACK_BOT_TOKEN 미설정 — 개인 DM 발송 비활성");

  const opened = await slackApi<{ ok: boolean; error?: string; channel?: { id: string } }>(
    "conversations.open",
    token,
    { users: slackUserId },
  );
  const channel = opened.channel?.id;
  if (!channel) throw new Error("Slack conversations.open: 채널 없음");

  const url = `${appBaseUrl()}${msg.deeplinkPath}`;
  await slackApi<{ ok: boolean; error?: string }>("chat.postMessage", token, {
    channel,
    text: msg.text, // 알림/폴백 텍스트
    attachments: [
      {
        color: TONE_COLOR[msg.tone],
        blocks: [
          {
            type: "section",
            text: { type: "mrkdwn", text: `${msg.text}\n<${url}|Que에서 열기>` },
          },
        ],
      },
    ],
  });
}
