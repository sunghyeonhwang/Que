import { createMockDb, type MockQueDb } from "@que/core";

// mock 단계의 인메모리 DB. dev 서버의 모듈 리로드에도 상태가 유지되도록
// globalThis에 싱글톤으로 둔다. Phase B(API 계층)에서 실제 저장소로 교체한다.
const store = globalThis as unknown as { __queDb?: MockQueDb };

export function getDb(): MockQueDb {
  store.__queDb ??= createMockDb();
  return store.__queDb;
}
