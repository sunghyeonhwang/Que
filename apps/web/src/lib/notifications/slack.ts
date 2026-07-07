import "server-only";

import type { SlackMessage } from "@que/core";
import { appBaseUrl, slackWebhookUrl } from "./config";

// Slack Incoming Webhook 발송 어댑터 (B-1). SDK 없이 fetch만 쓴다(서버리스 친화).
// 실패(HTTP 비200/네트워크/타임아웃)면 throw — 호출부(dispatch)가 outbox status=failed로 흡수한다.
// tone → attachment color 매핑은 CLAUDE.md 상태색 의미 고정과 일치(red=문제, amber=마감/주의, violet=회의록).

const TONE_COLOR: Record<SlackMessage["tone"], string> = {
  red: "#e33030",
  amber: "#f59e0b",
  violet: "#7c3aed",
};

const TIMEOUT_MS = 5000;

/** SlackMessage 1건을 팀 채널 Webhook으로 발송. 딥링크는 QUE_APP_URL + deeplinkPath로 만든다. */
export async function postToSlack(msg: SlackMessage): Promise<void> {
  const webhook = slackWebhookUrl();
  // 게이트 정책상 호출부가 notificationsEnabled()로 먼저 막지만, 어댑터도 방어적으로 확인한다.
  if (!webhook) throw new Error("SLACK_WEBHOOK_URL 미설정 — Slack 발송 비활성");

  const url = `${appBaseUrl()}${msg.deeplinkPath}`;
  const payload = {
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
  };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(webhook, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    if (!res.ok) {
      throw new Error(`Slack webhook HTTP ${res.status}`);
    }
  } finally {
    clearTimeout(timer);
  }
}
