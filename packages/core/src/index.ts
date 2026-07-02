// @que/core — 도메인 타입, 검증 스키마, 권한 규칙, 데이터 접근 계층.
// 웹(apps/web), MCP 서버, CLI가 모두 이 패키지를 통해서만 데이터에 접근한다.

export * from "./domain";
export * from "./labels";
export * from "./rules";
export { USERS, DEFAULT_USER_ID, findUser } from "./mock/users";
export { MOCK_PATS, MOCK_PAT_PREFIX, resolvePat } from "./mock/tokens";
export { createSeed, type QueSeed } from "./data/seed";
export { createMockDb, MockQueDb, type QueDb } from "./data/mock-db";
