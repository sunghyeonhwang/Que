"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/current-user";
import { issuePat, revokePat } from "@/lib/auth/tokens";

export type IssueTokenState = { token?: string; error?: string };

/** 설정 > 액세스 토큰: 본인 PAT 발급. 평문을 1회 반환(state.token). */
export async function issueTokenAction(
  _prev: IssueTokenState,
  formData: FormData,
): Promise<IssueTokenState> {
  const user = await getCurrentUser();
  const label = String(formData.get("label") ?? "");
  const res = await issuePat({ userId: user.id, label });
  if (!res.ok) return { error: res.error };
  revalidatePath("/settings/tokens"); // 목록에 새 토큰 반영
  return { token: res.token };
}

export type RevokeTokenState = { error?: string };

/** 본인 PAT 폐기(소프트 — revoked_at). 해당 토큰은 즉시 401. */
export async function revokeTokenAction(
  _prev: RevokeTokenState,
  formData: FormData,
): Promise<RevokeTokenState> {
  const user = await getCurrentUser();
  const tokenHash = String(formData.get("tokenHash") ?? "");
  if (!tokenHash) return { error: "대상 토큰이 없습니다." };
  const res = await revokePat({ userId: user.id, tokenHash });
  if (!res.ok) return { error: "폐기에 실패했습니다. 잠시 후 다시 시도해주세요." };
  revalidatePath("/settings/tokens");
  return {};
}
