"use server";

import { AuthError } from "next-auth";
import { signIn } from "@/auth";

export type PasskeyLoginState = { error?: string };

/**
 * 패스키 로그인 — 브라우저가 /api/webauthn/login/verify에서 받은 원타임 토큰을 넘긴다.
 * Auth.js "passkey" 프로바이더가 토큰을 최종 검증(서명·논스 소진·active 재확인)하고 세션을 만든다.
 * 성공 시 signIn이 redirect(NEXT_REDIRECT)를 throw하므로 그대로 다시 던진다(= 비밀번호 로그인과 동일 경로).
 * callbackUrl은 loginAction과 같은 규칙으로 내부 경로만 허용(오픈 리다이렉트 방지, 기본 /home).
 */
export async function passkeyLoginAction(
  token: string,
  callbackUrl?: string,
): Promise<PasskeyLoginState> {
  const rawCallback = String(callbackUrl ?? "");
  const redirectTo =
    /^\/(?![/\\])/.test(rawCallback) && !/[\x00-\x1f]/.test(rawCallback) ? rawCallback : "/home";
  try {
    await signIn("passkey", { token, redirectTo });
    return {};
  } catch (error) {
    if (error instanceof AuthError) {
      return { error: "패스키 로그인에 실패했습니다. 비밀번호로 로그인해 주세요." };
    }
    throw error; // redirect 등 제어 흐름 예외는 그대로 전파
  }
}
