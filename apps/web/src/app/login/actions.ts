"use server";

import { AuthError } from "next-auth";
import { signIn } from "@/auth";

export type LoginState = { error?: string };

/** 이메일+비밀번호 로그인. 성공 시 signIn이 redirect를 throw(NEXT_REDIRECT)하므로 다시 던진다. */
export async function loginAction(
  _prev: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");
  // 로그인 후 복귀 경로 — 내부 경로("/...")만 허용(오픈 리다이렉트 방지). 기본 /home.
  // 통합 간트(/gantt)처럼 (app) 밖 화면에서 로그인으로 튕긴 사용자가 원래 화면으로 돌아가게 한다.
  const rawCallback = String(formData.get("callbackUrl") ?? "");
  // "/" 시작 + 두 번째 문자가 /·\ 아님 + 제어문자 없음 — Auth.js 기본 redirect 콜백(동일 출처 고정)과
  // 2중 방어. regex 단독 우회("/\evil", 탭 삽입)를 여기서도 차단한다(게이트 Low 반영).
  const redirectTo =
    /^\/(?![/\\])/.test(rawCallback) && !/[\x00-\x1f]/.test(rawCallback) ? rawCallback : "/home";
  try {
    await signIn("credentials", { email, password, redirectTo });
    return {};
  } catch (error) {
    if (error instanceof AuthError) {
      return { error: "이메일 또는 비밀번호가 올바르지 않습니다." };
    }
    throw error; // redirect 등 제어 흐름 예외는 그대로 전파
  }
}
