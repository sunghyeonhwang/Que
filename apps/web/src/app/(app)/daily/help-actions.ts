"use server";

import { revalidatePath } from "next/cache";
import { isQueRuleError } from "@que/core";
import { getDb } from "@/lib/db";
import { getCurrentUser } from "@/lib/current-user";
import { kstDateKey } from "@/lib/daily-data";
import { notifyStandupHelpOffered } from "@/lib/notifications/dispatch";

// 데일리 "내가 도울게요" 원탭 서버 액션(명세 C). 막힌 팀원 카드에서 누른다.
// 동작: ⑴ taskId 있으면 core addTaskComment(일반 댓글 — 댓글 주체가 돕는 사람) ⑵ 대상자에게 Slack 개인 DM.
// 권한: 인증 필수, 본인에게는 불가. 댓글은 core 규칙대로(일반 댓글은 ChangeLog 없음, core가 강제).

export type OfferHelpResult =
  | { ok: true; commented: boolean; notified: boolean }
  | { ok: false; error: string };

/** YYYY-MM-DD 형식 검증(dedup 키 재료). 어긋나면 서버 오늘로 폴백. */
function normalizeDate(date: string | undefined, now: Date): string {
  return date && /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : kstDateKey(now);
}

/**
 * 막힌 팀원에게 도움을 제안한다. taskId가 있으면 그 작업에 일반 댓글을 남기고, 대상자에게 DM을 보낸다.
 * taskId가 없으면(자유 서술 막힘) DM만 보낸다. DM은 Bot Token 미설정·매핑 실패 시 조용히 실패(notified=false).
 * 반환값으로 UI가 토스트를 분기한다(댓글 남김/알림 발송 여부).
 */
export async function offerHelpAction(input: {
  targetUserId: string;
  taskId?: string;
  date: string;
}): Promise<OfferHelpResult> {
  const me = await getCurrentUser();
  if (input.targetUserId === me.id) {
    return { ok: false, error: "본인에게는 도움을 제안할 수 없습니다." };
  }
  const now = new Date();
  const date = normalizeDate(input.date, now);
  try {
    const db = await getDb();
    if (!db.users.some((u) => u.id === input.targetUserId)) {
      return { ok: false, error: "대상 팀원을 찾을 수 없습니다." };
    }

    let commented = false;
    let blockerSummary: string | undefined;
    if (input.taskId) {
      // 일반 댓글(helpUserIds 아님 — 돕는 사람이 주체). core가 존재/길이/권한을 강제한다.
      db.addTaskComment(
        { actorId: me.id, via: "web" },
        {
          taskId: input.taskId,
          body: "데일리 막힘을 보고 돕겠다고 나섰습니다 — 데일리 보드에서",
        },
      );
      commented = true;
      blockerSummary = db.tasks.find((t) => t.id === input.taskId)?.title;
      // DM 게이트가 꺼져 있어도 댓글은 확실히 저장한다(같은 db 인스턴스로 커밋).
      await db.persist();
    }

    // 대상자에게 개인 DM. 트랜잭셔널이라 allowlist 우회(dispatch가 강제·throw 금지). 발송 성공 여부만 받는다.
    const notified = await notifyStandupHelpOffered(
      db,
      { actorId: me.id, targetUserId: input.targetUserId, blockerSummary, date },
      now,
    );

    revalidatePath("/daily");
    return { ok: true, commented, notified };
  } catch (error) {
    if (isQueRuleError(error)) return { ok: false, error: error.message };
    throw error;
  }
}
