import { createHmac, timingSafeEqual } from "node:crypto";
import { isQueRuleError, type CheckInResponse } from "@que/core";
import { getDb } from "@/lib/db";
import { slackSigningSecret } from "@/lib/notifications/config";
import { notifyTaskStatusChanged } from "@/lib/notifications/dispatch";
import { resolveQueUserBySlackId } from "@/lib/notifications/slack-bot";

export const dynamic = "force-dynamic";

// Slack 인터랙티브 수신(C-2) — 체크인 재촉 DM의 버튼 클릭이 여기로 POST된다.
//
// 인증 축은 PAT(withApi)가 아니라 **Slack 요청 서명**(SLACK_SIGNING_SECRET, v0 HMAC-SHA256)이다.
// 행위자(actorId)는 버튼을 누른 Slack 유저를 users.slack_user_id 역조회로 해석한다 — 클라이언트가
// 보낸 값이 아니라 Slack이 서명해 보증하는 user.id에서 도출하므로 위조 불가. 권한(담당자만 응답)은
// core answerCheckIn이 최종 강제하고, ChangeLog에 via='slack'으로 남는다.
//
// Slack은 3초 내 200 응답을 요구한다 — 뮤테이션을 동기로 처리한 뒤(수 초 내) response_url로
// 원본 메시지를 결과 문구로 교체한다. block_actions는 Slack이 재시도하지 않으므로 멱등성 부담 없음
// (그래도 core ALREADY_ANSWERED가 이중 클릭을 거부한다).

/** 서명 타임스탬프 허용 스큐(초) — Slack 권장 5분(리플레이 방지). */
const MAX_SKEW_SEC = 300;

/** 버튼 action_id → 체크인 응답. 사유가 필요 없는 응답만 버튼으로 받는다(checkin-prompt.ts와 쌍). */
const ACTION_TO_RESPONSE: Record<string, CheckInResponse> = {
  "checkin:working": "working",
  "checkin:done": "done",
  "checkin:later": "later",
};

const RESPONSE_LABEL: Record<string, string> = {
  working: "작업중",
  done: "완료",
  later: "나중에",
};

/** Slack v0 서명 검증 — `v0=` + HMAC_SHA256(secret, `v0:<ts>:<rawBody>`), 상수시간 비교. */
function verifySlackSignature(secret: string, request: Request, rawBody: string): boolean {
  const ts = request.headers.get("x-slack-request-timestamp") ?? "";
  const given = request.headers.get("x-slack-signature") ?? "";
  const tsNum = Number(ts);
  if (!Number.isFinite(tsNum)) return false;
  if (Math.abs(Date.now() / 1000 - tsNum) > MAX_SKEW_SEC) return false; // 리플레이 방지
  const expected = `v0=${createHmac("sha256", secret).update(`v0:${ts}:${rawBody}`).digest("hex")}`;
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

/** response_url로 원본 DM을 결과 문구로 교체(또는 안내만). 실패는 로그만 — 응답 자체는 이미 커밋됨. */
async function respondToSlack(
  responseUrl: string,
  text: string,
  { replace }: { replace: boolean },
): Promise<void> {
  try {
    await fetch(responseUrl, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(
        replace
          ? { replace_original: true, text }
          : { replace_original: false, response_type: "ephemeral", text },
      ),
    });
  } catch (error) {
    console.error("[que-slack] response_url 회신 실패(무시)", error);
  }
}

interface BlockActionsPayload {
  type?: string;
  user?: { id?: string };
  actions?: { action_id?: string; value?: string }[];
  response_url?: string;
}

export async function POST(request: Request) {
  const secret = slackSigningSecret();
  if (!secret) {
    return Response.json({ error: "slack interactivity disabled" }, { status: 503 });
  }
  const rawBody = await request.text();
  if (!verifySlackSignature(secret, request, rawBody)) {
    return Response.json({ error: "invalid signature" }, { status: 401 });
  }

  // block_actions는 form-encoded `payload=<json>`으로 온다.
  const payloadRaw = new URLSearchParams(rawBody).get("payload");
  if (!payloadRaw) return new Response(null, { status: 200 }); // url_verification 등 무시
  let payload: BlockActionsPayload;
  try {
    payload = JSON.parse(payloadRaw) as BlockActionsPayload;
  } catch {
    return Response.json({ error: "malformed payload" }, { status: 400 });
  }
  if (payload.type !== "block_actions") return new Response(null, { status: 200 });

  const action = payload.actions?.[0];
  const responseUrl = payload.response_url;
  const response = action?.action_id ? ACTION_TO_RESPONSE[action.action_id] : undefined;
  const checkInId = action?.value;
  const slackUserId = payload.user?.id;
  // 우리가 만든 버튼이 아니면 무시(다른 인터랙션과 공존 가능하게 200).
  if (!response || !checkInId || !slackUserId) return new Response(null, { status: 200 });

  const actorId = await resolveQueUserBySlackId(slackUserId);
  if (!actorId) {
    if (responseUrl)
      await respondToSlack(responseUrl, "Que 계정을 찾지 못했습니다. Que 웹에서 응답해 주세요.", {
        replace: false,
      });
    return new Response(null, { status: 200 });
  }

  try {
    const db = await getDb();
    const existing = db.checkIns.find((c) => c.id === checkInId);
    const taskId = existing?.taskId;
    const from = taskId ? db.tasks.find((t) => t.id === taskId)?.status : undefined;
    const taskTitle = taskId ? (db.tasks.find((t) => t.id === taskId)?.title ?? "") : "";
    db.answerCheckIn({ actorId, via: "slack" }, { checkInId, response });
    await db.persist();
    // 상태 전이 알림 훅(웹 답변 경로와 동일) — 실패해도 응답은 유지된다.
    if (taskId && from) await notifyTaskStatusChanged(db, taskId, from);
    if (responseUrl)
      await respondToSlack(
        responseUrl,
        `✅ '${taskTitle}' 체크인에 *${RESPONSE_LABEL[response]}*(으)로 응답했습니다.` +
          (response === "later" ? " 내일 다시 물어볼게요." : ""),
        { replace: true },
      );
    return new Response(null, { status: 200 });
  } catch (error) {
    // 도메인 규칙 거부(이미 응답·담당자 아님 등)는 정상 동작 — 사유를 그대로 안내한다.
    if (isQueRuleError(error)) {
      if (responseUrl) await respondToSlack(responseUrl, `⚠️ ${error.message}`, { replace: false });
      return new Response(null, { status: 200 });
    }
    console.error("[que-slack] 체크인 응답 처리 실패", error);
    if (responseUrl)
      await respondToSlack(responseUrl, "처리 중 오류가 났습니다. Que 웹에서 응답해 주세요.", {
        replace: false,
      });
    return new Response(null, { status: 200 });
  }
}
