import { timingSafeEqual } from "node:crypto";
import { getDb } from "@/lib/db";

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

  return Response.json({
    ok: true,
    checkInsCreated,
    tasksCreated,
    at: now.toISOString(),
  });
}
