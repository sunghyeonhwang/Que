"use server";

import { getCurrentUser } from "@/lib/current-user";
import { adminResetPassword } from "@/lib/auth/password";

export type ResetPasswordState = { tempPassword?: string; error?: string };

/** 관리자 전용: 팀원 비밀번호를 임시값으로 재설정. 임시 비밀번호를 1회 반환한다. */
export async function adminResetPasswordAction(
  _prev: ResetPasswordState,
  formData: FormData,
): Promise<ResetPasswordState> {
  const me = await getCurrentUser();
  const targetId = String(formData.get("targetId") ?? "");
  if (!targetId) return { error: "대상 계정이 지정되지 않았습니다." };

  const res = await adminResetPassword({ actorRole: me.role, targetId });
  if (!res.ok) return { error: res.error };
  return { tempPassword: res.tempPassword };
}
