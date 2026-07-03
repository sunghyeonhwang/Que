import { redirect } from "next/navigation";
import { findUser, type User } from "@que/core";
import { auth } from "@/auth";

/** 실 로그인: Auth.js 세션에서 사용자를 읽는다. 세션이 없으면 로그인 화면으로 보낸다.
 *  이 함수를 부르는 모든 (app) 페이지·레이아웃이 자동으로 인증 게이트를 통과한다. */
export async function getCurrentUser(): Promise<User> {
  const session = await auth();
  const id = session?.user?.id;
  if (!id) redirect("/login");

  // avatarColor는 정적 로스터에서, name·role은 세션(=DB) 값을 우선한다.
  const base = findUser(id);
  if (!base) redirect("/login"); // 로스터에 없는 사용자 → 재로그인 유도
  return {
    ...base,
    name: session.user.name ?? base.name,
    role: session.user.role ?? base.role,
  };
}
