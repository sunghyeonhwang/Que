import { createMockDb, type MockQueDb } from "@que/core";

// mock 단계의 인메모리 DB. dev 서버의 모듈 리로드에도 상태가 유지되도록
// globalThis에 싱글톤으로 둔다. Phase B(API 계층)에서 실제 저장소로 교체한다.
const store = globalThis as unknown as { __queDb?: MockQueDb };

export function getDb(): MockQueDb {
  store.__queDb ??= createMockDb();
  // 체크인 스케줄러 — 모든 접근 경로(페이지/서버 액션/API)에서 빠짐없이 동작하도록
  // 여기서 lazy 실행한다 (멱등, O(tasks)). 배포 후 Vercel Cron으로 전환 예정.
  store.__queDb.syncCheckIns(new Date());
  return store.__queDb;
}
