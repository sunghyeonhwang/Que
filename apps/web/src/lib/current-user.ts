import { cookies } from "next/headers";
import { DEFAULT_USER_ID, findUser, type User } from "@que/core";

export const USER_COOKIE = "que-user";

/** mock 로그인: 쿠키의 사용자를 읽고, 없으면 기본 사용자(황성현)로 취급한다. */
export async function getCurrentUser(): Promise<User> {
  const store = await cookies();
  const id = store.get(USER_COOKIE)?.value;
  return findUser(id) ?? findUser(DEFAULT_USER_ID)!;
}
