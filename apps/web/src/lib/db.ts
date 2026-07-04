import { cache } from "react";
import { createMockDb, type MockQueDb } from "@que/core";
import { SupabaseQueDb } from "./supabase-db";

// 데이터 접근 진입점. 기본은 인메모리 mock(globalThis 싱글톤). env로 옵트인하면 실 Supabase DB.
// - QUE_DB=supabase + SUPABASE_URL + SUPABASE_SECRET_KEY 가 모두 있으면 Supabase 어댑터 사용.
// - 그 외(테스트/CI/키 없는 dev)는 mock — 무영향.

const store = globalThis as unknown as { __queDb?: MockQueDb };

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SECRET_KEY = process.env.SUPABASE_SECRET_KEY;
const useSupabase =
  process.env.QUE_DB === "supabase" && !!SUPABASE_URL && !!SUPABASE_SECRET_KEY;

// React cache: 서버 컴포넌트 렌더 내 여러 getDb() 호출은 한 번만 로드된다.
// 단, 서버 액션/라우트 경계에서는 캐시 정체성이 보장되지 않으므로 — mutation과 persist는
// 반드시 같은 인스턴스에서 해야 한다. 각 액션의 toResult가 db를 한 번 획득해 콜백에 넘긴다.
export const getDb = cache(async (): Promise<MockQueDb> => {
  const now = new Date();

  if (useSupabase) {
    const db = new SupabaseQueDb(SUPABASE_URL!, SUPABASE_SECRET_KEY!, now);
    await db.load();
    // 스케줄러 권위는 Vercel Cron(`/api/cron/sync`)으로 이관한다.
    // QUE_CRON_ACTIVE=1 이면 여기서 lazy 실행을 끄고(조회는 순수 load, 요청이 write를 유발 안 함),
    // 미설정이면 안전을 위해 기존 lazy 유지(Cron 등록 전 배포에서도 체크인이 끊기지 않게).
    if (process.env.QUE_CRON_ACTIVE !== "1") {
      db.syncCheckIns(now);
      db.syncRecurringTemplates(now);
      await db.persist();
    }
    return db;
  }

  store.__queDb ??= createMockDb();
  store.__queDb.syncCheckIns(now);
  store.__queDb.syncRecurringTemplates(now);
  return store.__queDb;
});
