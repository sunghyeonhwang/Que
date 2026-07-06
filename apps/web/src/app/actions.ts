"use server";

import { signOut } from "@/auth";

/**
 * 로그아웃. Auth.js 세션(쿠키)만 정리하고, 화면 이동은 호출부(클라이언트)가 한다.
 * 서버 액션에서 signOut을 redirect(throw NEXT_REDIRECT)로 쓰면, 호출부가 await를
 * try/catch로 감쌀 때 그 프레임워크 예외가 "실제 오류"로 잡혀 오류 토스트가 뜬다.
 * → redirect:false로 예외 없이 세션만 지우고, 클라이언트가 /login으로 이동한다.
 */
export async function logout() {
  await signOut({ redirect: false });
}
