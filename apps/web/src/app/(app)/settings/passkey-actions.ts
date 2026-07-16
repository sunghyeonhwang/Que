"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/current-user";
import {
  listCredentialSummaries,
  deleteCredential,
  renameCredential,
  normalizeDeviceName,
  type CredentialSummary,
} from "@/lib/auth/webauthn";

// 설정 > 패스키: 본인 소유 자격증명 조회·삭제·이름변경. 전부 getCurrentUser 게이트 + userId 스코프.
// public_key는 어느 경로로도 반환하지 않는다(listCredentialSummaries가 제외).

/** 본인 패스키 목록(id·기기이름·생성·마지막 사용). */
export async function listMyPasskeys(): Promise<CredentialSummary[]> {
  const me = await getCurrentUser();
  return listCredentialSummaries(me.id);
}

export type PasskeyActionResult = { ok: true } | { ok: false; error: string };

/** 본인 패스키 삭제(소유 검증은 userId 스코프 delete로 강제). */
export async function deleteMyPasskey(credentialId: string): Promise<PasskeyActionResult> {
  const me = await getCurrentUser();
  const id = credentialId.trim();
  if (!id) return { ok: false, error: "대상 패스키가 없습니다." };
  const ok = await deleteCredential(me.id, id);
  if (!ok) return { ok: false, error: "삭제에 실패했습니다. 잠시 후 다시 시도해주세요." };
  revalidatePath("/settings/security");
  return { ok: true };
}

/** 본인 패스키 이름변경(trim·60자·빈값 기본값). */
export async function renameMyPasskey(
  credentialId: string,
  name: string,
): Promise<PasskeyActionResult> {
  const me = await getCurrentUser();
  const id = credentialId.trim();
  if (!id) return { ok: false, error: "대상 패스키가 없습니다." };
  const deviceName = normalizeDeviceName(name);
  const ok = await renameCredential(me.id, id, deviceName);
  if (!ok) return { ok: false, error: "이름 변경에 실패했습니다. 잠시 후 다시 시도해주세요." };
  revalidatePath("/settings/security");
  return { ok: true };
}
