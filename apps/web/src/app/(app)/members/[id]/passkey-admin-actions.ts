"use server";

import { getCurrentUser } from "@/lib/current-user";
import {
  listCredentialSummaries,
  deleteCredential,
  type CredentialSummary,
} from "@/lib/auth/webauthn";

// 관리자 전용: 팀원 패스키 조회·삭제(분실 기기 회수 등). reset-actions.ts 선례대로 서버에서 role을
// 재확인한다(클라이언트 신뢰 금지). public_key는 반환하지 않는다.

const NOT_AUTHORIZED = "권한이 없습니다.";

/** 관리자: 특정 사용자의 패스키 목록. 비관리자면 빈 배열(정보 미노출). */
export async function adminListPasskeys(userId: string): Promise<CredentialSummary[]> {
  const me = await getCurrentUser();
  if (me.role !== "admin") return [];
  const id = userId.trim();
  if (!id) return [];
  return listCredentialSummaries(id);
}

export type AdminPasskeyResult = { ok: true } | { ok: false; error: string };

/** 관리자: 특정 사용자의 패스키 삭제(userId 스코프 delete — 대상이 실제 소유자여야 삭제됨). */
export async function adminDeletePasskey(
  userId: string,
  credentialId: string,
): Promise<AdminPasskeyResult> {
  const me = await getCurrentUser();
  if (me.role !== "admin") return { ok: false, error: NOT_AUTHORIZED };
  const uid = userId.trim();
  const cid = credentialId.trim();
  if (!uid || !cid) return { ok: false, error: "대상이 지정되지 않았습니다." };
  const ok = await deleteCredential(uid, cid);
  if (!ok) return { ok: false, error: "삭제에 실패했습니다. 잠시 후 다시 시도해주세요." };
  return { ok: true };
}
