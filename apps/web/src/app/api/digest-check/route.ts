import { timingSafeEqual } from "node:crypto";
import { messageFor, type NotificationIntent } from "@que/core";
import { getDb } from "@/lib/db";
import { digestRecipientAllowlist, personalDigestEnabled } from "@/lib/notifications/config";
import { buildPersonalDigestIntents, kstDateKey } from "@/lib/notifications/personal-digest";
import { postDmToSlack, resolveSlackUserId } from "@/lib/notifications/slack-bot";

// ⚠️ 임시: 개인 DM 브리핑 활성화 검증용. CRON_SECRET 인증. 9:50 발송 창을 무시하고 지금
// 허용목록(QUE_DIGEST_RECIPIENTS) 대상에게 실 다이제스트 DM을 즉시 보낸다. 빈 브리핑 유저도
// "예정 항목 없음(테스트)" DM을 받아 매핑·발송을 확인한다. 검증 후 제거한다(다음 커밋).
export const dynamic = "force-dynamic";

function authorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const provided = request.headers.get("authorization") ?? "";
  const a = Buffer.from(provided);
  const b = Buffer.from(`Bearer ${secret}`);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export async function GET(request: Request) {
  if (!authorized(request)) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }
  if (!personalDigestEnabled()) {
    return Response.json({ error: "SLACK_BOT_TOKEN 미설정" }, { status: 400 });
  }

  const now = new Date();
  const db = await getDb();
  const dateKey = kstDateKey(now);

  // 발송 대상 = 허용목록(없으면 전체 active). 임박·마일스톤 유무와 무관하게 테스트 DM을 보내려고
  // buildPersonalDigestIntents(빈 유저 생략)의 결과를 userId로 매핑해두고, 대상 전원을 순회한다.
  const targets =
    digestRecipientAllowlist() ??
    db.users.filter((u) => u.active !== false).map((u) => u.id);
  const intentByUser = new Map(
    buildPersonalDigestIntents(db, now).map((i) => [i.recipient ?? i.entityId, i]),
  );

  const results: Array<Record<string, unknown>> = [];
  for (const userId of targets) {
    try {
      const slackId = await resolveSlackUserId(userId);
      if (!slackId) {
        results.push({ userId, mapped: false, sent: false });
        continue;
      }
      const intent: NotificationIntent = intentByUser.get(userId) ?? {
        kind: "personal_digest",
        entityType: "user",
        entityId: userId,
        marker: dateKey,
        recipient: userId,
        payload: {
          title: "오늘의 브리핑 (테스트)",
          text: "오늘 예정된 항목이 없습니다. (연동 테스트 메시지)",
          deeplinkPath: "/today",
          tone: "blue",
        },
      };
      await postDmToSlack(slackId, messageFor(intent));
      results.push({ userId, mapped: true, sent: true });
    } catch (error) {
      // resolveSlackUserId(lookupByEmail)·postDmToSlack 실패를 유저별로 노출(500 방지, 원인 확인용).
      results.push({ userId, sent: false, error: String(error) });
    }
  }

  return Response.json({ ok: true, tested: results, at: now.toISOString() });
}
