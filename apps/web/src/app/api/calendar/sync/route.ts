import { MockGoogleCalendarProvider, defaultMockGoogleEvents } from "@que/core";
import { apiError, withApi } from "@/lib/api/respond";
import { getDb } from "@/lib/db";

// 회사 캘린더 동기화 트리거 — 관리자 전용. 지금은 mock Google 제공자를 쓰고,
// env(OAuth) 도착 후 GoogleCalendarProvider로 교체하면 실 연동이 된다.
// 배포 후에는 이 엔드포인트를 Vercel Cron이 주기적으로 호출하는 그림.
export async function POST(request: Request) {
  return withApi(request, async ({ user }) => {
    if (user.role !== "admin") {
      return apiError(403, "NOT_AUTHORIZED", "회사 캘린더 동기화는 관리자만 실행할 수 있다");
    }
    const now = new Date();
    const rangeStart = new Date(now);
    rangeStart.setDate(rangeStart.getDate() - 7);
    const rangeEnd = new Date(now);
    rangeEnd.setDate(rangeEnd.getDate() + 30);

    const provider = new MockGoogleCalendarProvider(defaultMockGoogleEvents(now));
    const db = await getDb();
    const result = await db.syncExternalCalendar(provider, rangeStart, rangeEnd);
    await db.persist();
    return Response.json({ provider: provider.name, ...result });
  });
}
