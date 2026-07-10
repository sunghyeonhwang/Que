"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/current-user";
import { getDb } from "@/lib/db";
import { getAlerts } from "@/lib/alerts-data";

// 알림 읽음 처리 액션 — C-3a 알림 센터. core markAlertsRead(멱등 upsert, 본인 것만) 경유.
// 업무 데이터가 아니라 ChangeLog 없음(core 주석 참조). 읽음은 뱃지·강조에만 영향.

export interface AlertActionResult {
  ok: boolean;
  error?: string;
}

async function mark(alertIds: string[]): Promise<AlertActionResult> {
  const user = await getCurrentUser();
  const db = await getDb();
  db.markAlertsRead({ actorId: user.id, via: "web" }, { alertIds });
  await db.persist();
  revalidatePath("/notifications");
  revalidatePath("/", "layout"); // 상단바 종 뱃지(레이아웃에서 로드) 갱신
  return { ok: true };
}

/** 알림 1건(또는 여러 건) 읽음. */
export async function markAlertsReadAction(alertIds: string[]): Promise<AlertActionResult> {
  if (alertIds.length === 0 || alertIds.length > 100) return { ok: false, error: "잘못된 요청" };
  return mark(alertIds);
}

/** 현재 떠 있는 알림 전체 읽음 — 서버가 현재 알림 목록을 다시 계산해 그 id만 마크한다. */
export async function markAllAlertsReadAction(): Promise<AlertActionResult> {
  const user = await getCurrentUser();
  const { items } = await getAlerts(user, new Date(), { all: true });
  const unread = items.filter((i) => !i.read).map((i) => i.id);
  if (unread.length === 0) return { ok: true };
  return mark(unread);
}
