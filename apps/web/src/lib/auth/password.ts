import "server-only";
import { randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import {
  LOGIN_LOCK_MINUTES,
  LOGIN_LOCK_THRESHOLD,
  validateNewPassword,
} from "@/lib/auth/policy";

// 비밀번호 쓰기 작업(본인 변경 · 관리자 재설정). SECRET_KEY로 users 테이블에 직접 UPDATE한다.
// (supabase-db는 users write-back을 금지하므로 여기서 별도 처리한다.)
// 실 DB(QUE_DB=supabase)에서만 동작한다 — mock/dev 환경에선 안내 메시지로 거부.

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SECRET_KEY = process.env.SUPABASE_SECRET_KEY;
const useSupabase =
  process.env.QUE_DB === "supabase" && !!SUPABASE_URL && !!SUPABASE_SECRET_KEY;

const BCRYPT_ROUNDS = 10;
const NOT_SUPPORTED = "이 환경에서는 비밀번호를 변경할 수 없습니다.";

export type PasswordResult = { ok: true } | { ok: false; error: string };

function admin(): SupabaseClient {
  return createClient(SUPABASE_URL!, SUPABASE_SECRET_KEY!, {
    auth: { persistSession: false },
  });
}

// 혼동 문자를 뺀 읽기 쉬운 임시 비밀번호(관리자 재설정용).
const TEMP_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
function makeTempPassword(len = 10): string {
  const bytes = randomBytes(len);
  let out = "";
  for (let i = 0; i < len; i += 1) out += TEMP_ALPHABET[bytes[i] % TEMP_ALPHABET.length];
  return out;
}

/**
 * 본인 비밀번호 변경. 현재 비밀번호를 확인한 뒤 새 비밀번호로 교체하고,
 * 임시 비밀번호 상태(must_change_password)와 실패 카운터를 해제한다.
 */
export async function changeOwnPassword(input: {
  userId: string;
  email?: string;
  currentPassword: string;
  newPassword: string;
}): Promise<PasswordResult> {
  if (!useSupabase) return { ok: false, error: NOT_SUPPORTED };
  const { userId, email, currentPassword, newPassword } = input;

  const client = admin();
  const { data, error } = await client
    .from("users")
    .select("password_hash,locked_until")
    .eq("id", userId)
    .maybeSingle();
  if (error || !data?.password_hash) return { ok: false, error: "계정을 확인할 수 없습니다." };

  // 로그인과 같은 잠금을 공유 — 세션 탈취자가 폼으로 현재 비밀번호를 무제한 추측하지 못하게.
  if (data.locked_until && new Date(data.locked_until as string) > new Date())
    return { ok: false, error: "시도가 너무 많아 잠시 잠겼어요. 잠시 후 다시 시도해주세요." };

  const currentOk = await bcrypt.compare(currentPassword, data.password_hash as string);
  if (!currentOk) {
    await client.rpc("register_login_failure", {
      p_user_id: userId,
      p_threshold: LOGIN_LOCK_THRESHOLD,
      p_lock_minutes: LOGIN_LOCK_MINUTES,
    });
    return { ok: false, error: "현재 비밀번호가 올바르지 않습니다." };
  }

  if (newPassword === currentPassword)
    return { ok: false, error: "새 비밀번호가 지금 쓰는 비밀번호와 같아요." };

  const policyError = validateNewPassword(newPassword, { email });
  if (policyError) return { ok: false, error: policyError };

  const hash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);
  const { error: upErr } = await client
    .from("users")
    .update({
      password_hash: hash,
      password_changed_at: new Date().toISOString(),
      must_change_password: false,
      failed_login_attempts: 0,
      locked_until: null,
    })
    .eq("id", userId);
  if (upErr) return { ok: false, error: "비밀번호를 저장하지 못했습니다. 잠시 후 다시 시도해주세요." };

  return { ok: true };
}

/**
 * 관리자가 팀원의 비밀번호를 임시값으로 재설정한다(잊었을 때).
 * 임시 비밀번호를 반환하며(호출부가 관리자에게 1회 표시), 다음 로그인 때 변경을 강제한다.
 */
export async function adminResetPassword(input: {
  actorRole: "admin" | "member";
  targetId: string;
}): Promise<{ ok: true; tempPassword: string } | { ok: false; error: string }> {
  if (input.actorRole !== "admin") return { ok: false, error: "권한이 없습니다." };
  if (!useSupabase) return { ok: false, error: NOT_SUPPORTED };

  const client = admin();
  const { data, error } = await client
    .from("users")
    .select("id")
    .eq("id", input.targetId)
    .maybeSingle();
  if (error || !data) return { ok: false, error: "대상 계정을 찾을 수 없습니다." };

  const tempPassword = makeTempPassword();
  const hash = await bcrypt.hash(tempPassword, BCRYPT_ROUNDS);
  const { error: upErr } = await client
    .from("users")
    .update({
      password_hash: hash,
      must_change_password: true,
      password_changed_at: null,
      failed_login_attempts: 0,
      locked_until: null,
    })
    .eq("id", input.targetId);
  if (upErr) return { ok: false, error: "재설정에 실패했습니다. 잠시 후 다시 시도해주세요." };

  return { ok: true, tempPassword };
}
