import { cookies } from "next/headers";
import { DEFAULT_USER_ID, findUser, type User } from "@que/core";
import { isMockAuthAllowed, MOCK_AUTH_BLOCKED_MESSAGE } from "@/lib/mock-auth-guard";

export const USER_COOKIE = "que-user";

/** mock 로그인: 쿠키의 사용자를 읽고, 없으면 기본 사용자(황성현)로 취급한다.
 *  production에서는 명시적 옵트인 없이 동작하지 않는다 (실수 공개 배포 방지 fail-safe). */
export async function getCurrentUser(): Promise<User> {
  // cookies()를 가드보다 먼저 호출한다 — 페이지를 dynamic으로 전환시켜
  // 빌드 시점 프리렌더에서는 이 코드가 실행되지 않게 하고(빌드 통과),
  // 실제 요청(런타임)에서만 가드가 동작한다.
  const store = await cookies();
  if (!isMockAuthAllowed()) {
    throw new Error(MOCK_AUTH_BLOCKED_MESSAGE);
  }
  const id = store.get(USER_COOKIE)?.value;
  return findUser(id) ?? findUser(DEFAULT_USER_ID)!;
}
