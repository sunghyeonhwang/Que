"use server";

import { emailForUser } from "@que/core";
import { getCurrentUser } from "@/lib/current-user";
import { changeOwnPassword } from "@/lib/auth/password";

export type ChangePasswordState = { error?: string; success?: boolean };

/** 설정 > 보안: 본인 비밀번호 변경. 현재 비밀번호 확인 후 교체한다. */
export async function changePasswordAction(
  _prev: ChangePasswordState,
  formData: FormData,
): Promise<ChangePasswordState> {
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
  return { success: true };
}
