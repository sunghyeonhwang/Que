"use server";

import { emailForUser } from "@que/core";
import { getCurrentUser } from "@/lib/current-user";
import { changeOwnPassword } from "@/lib/auth/password";

export type ForcedChangeState = { error?: string; ok?: true };

/**
 * 첫 로그인/재설정 후 강제 비밀번호 변경. 임시 비밀번호로 확인 → 새 비밀번호로 교체 →
 * 세션을 종료하고 로그인 화면으로 보낸다(새 비밀번호로 다시 로그인).
 */
export async function forcedChangeAction(
  _prev: ForcedChangeState,
  formData: FormData,
): Promise<ForcedChangeState> {
  const user = await getCurrentUser();
  const current = String(formData.get("current") ?? "");
  const next = String(formData.get("next") ?? "");
  const confirm = String(formData.get("confirm") ?? "");

  if (!current || !next || !confirm) return { error: "모든 칸을 입력해주세요." };
  if (next !== confirm) return { error: "새 비밀번호 두 개가 서로 달라요." };

  const res = await changeOwnPassword({
    userId: user.id,
    email: emailForUser(user.id),
    currentPassword: current,
    newPassword: next,
  });
  if (!res.ok) return { error: res.error };

  // 성공 → 세션 종료는 클라이언트가 /api/auth/logout 라우트로 수행한다(같은 이름의 세션 쿠키
  // 두 변형을 서버 액션 한 응답에 못 싣는 구조적 한계 — 라우트 주석 참고). 여기서는 ok만 반환.
  return { ok: true };
}
