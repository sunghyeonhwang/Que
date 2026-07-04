import bcrypt from "bcryptjs";
import { createClient } from "@supabase/supabase-js";
import { USERS, emailForUser, DEV_PASSWORD, type UserRole } from "@que/core";
import { isMockAuthAllowed } from "@/lib/mock-auth-guard";
import { LOGIN_LOCK_MINUTES, LOGIN_LOCK_THRESHOLD } from "@/lib/auth/policy";

// 이메일+비밀번호 검증. Auth.js Credentials provider의 authorize()에서만 호출한다.
// password_hash는 여기서만 읽고 절대 도메인 User/세션 밖으로 내보내지 않는다.
// 브루트포스 방어: 연속 실패 누적 → 잠금(locked_until). 서버리스 다중 인스턴스에서도
// 상태가 쪼개지지 않게 in-memory가 아니라 users 테이블 컬럼으로 관리한다.

export interface AuthUser {
  id: string;
  name: string;
  role: UserRole;
  /** 임시 비밀번호 상태 — 참이면 로그인 후 변경을 강제한다. */
  mustChangePassword: boolean;
}

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SECRET_KEY = process.env.SUPABASE_SECRET_KEY;
const useSupabase =
  process.env.QUE_DB === "supabase" && !!SUPABASE_URL && !!SUPABASE_SECRET_KEY;

export async function verifyCredentials(
  email: string,
  password: string,
): Promise<AuthUser | null> {
  const e = email.trim().toLowerCase();
  if (!e || !password) return null;

  if (useSupabase) {
    // 실 DB: SECRET_KEY(service_role급)로 직접 조회 → bcrypt 대조 + 잠금 처리.
    const client = createClient(SUPABASE_URL!, SUPABASE_SECRET_KEY!, {
      auth: { persistSession: false },
    });
    const { data, error } = await client
      .from("users")
      .select("id,name,role,password_hash,must_change_password,failed_login_attempts,locked_until")
      .ilike("email", e) // 와일드카드 없는 ilike = 대소문자 무시 정확 일치
      .limit(1)
      .maybeSingle();
    if (error || !data || !data.password_hash) return null;

    const now = new Date();
    // 잠금 중이면 비밀번호가 맞아도 거부(브루트포스 방어).
    if (data.locked_until && new Date(data.locked_until as string) > now) return null;

    const ok = await bcrypt.compare(password, data.password_hash as string);
    if (!ok) {
      // 실패 누적 — 원자적 단일 UPDATE(RPC). 동시 요청에도 카운터가 언더카운트되지 않는다.
      // 임계 도달 시 잠그고 카운터 리셋(잠금 해제 후 다시 N번 기회).
      await client.rpc("register_login_failure", {
        p_user_id: data.id as string,
        p_threshold: LOGIN_LOCK_THRESHOLD,
        p_lock_minutes: LOGIN_LOCK_MINUTES,
      });
      return null;
    }

    // 성공: 실패 카운터/잠금이 남아 있으면 정리.
    if (((data.failed_login_attempts as number) ?? 0) > 0 || data.locked_until) {
      await client
        .from("users")
        .update({ failed_login_attempts: 0, locked_until: null })
        .eq("id", data.id as string);
    }
    return {
      id: data.id as string,
      name: data.name as string,
      role: data.role as UserRole,
      mustChangePassword: !!data.must_change_password,
    };
  }

  // 로컬 mock/dev: 정적 로스터의 파생 이메일 + 공용 개발 비밀번호.
  // ⚠️ fail-close: 배포(production)에서 QUE_ALLOW_MOCK_AUTH 옵트인 없이는 mock 폴백을 차단한다.
  if (!isMockAuthAllowed()) return null;
  if (password !== DEV_PASSWORD) return null;
  const user = USERS.find((u) => emailForUser(u.id).toLowerCase() === e);
  return user
    ? { id: user.id, name: user.name, role: user.role, mustChangePassword: false }
    : null;
}
