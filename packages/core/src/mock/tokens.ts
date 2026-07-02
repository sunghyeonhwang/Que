import type { User } from "../domain";
import { USERS, findUser } from "./users";

// ⚠️ mock 전용 Personal Access Token.
// 실서비스에서는 설정 화면에서 무작위 토큰을 발급/폐기한다 (que-mcp-cli-plan.md).
// mock 단계에서는 로컬 개발 편의를 위해 결정적 토큰을 쓴다 — 절대 배포 환경에 두지 말 것.

export const MOCK_PAT_PREFIX = "que_pat_";

/** 사용자별 mock 토큰. CLI/MCP 로컬 설정에서 참조한다. */
export const MOCK_PATS: Record<string, string> = Object.fromEntries(
  USERS.map((user) => [`${MOCK_PAT_PREFIX}${user.id}`, user.id]),
);

/** Bearer 토큰 → 사용자. 없으면 undefined. */
export function resolvePat(token: string | undefined | null): User | undefined {
  if (!token) return undefined;
  const userId = MOCK_PATS[token];
  return userId ? findUser(userId) : undefined;
}
