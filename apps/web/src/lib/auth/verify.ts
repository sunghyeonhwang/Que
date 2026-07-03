import bcrypt from "bcryptjs";
import { createClient } from "@supabase/supabase-js";
import { USERS, emailForUser, DEV_PASSWORD, type UserRole } from "@que/core";
import { isMockAuthAllowed } from "@/lib/mock-auth-guard";

// 이메일+비밀번호 검증. Auth.js Credentials provider의 authorize()에서만 호출한다.
// password_hash는 여기서만 읽고 절대 도메인 User/세션 밖으로 내보내지 않는다.

export interface AuthUser {
  id: string;
  name: string;
  role: UserRole;
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
    // 실 DB: SECRET_KEY(service_role급)로 직접 조회 → bcrypt 대조.
    const client = createClient(SUPABASE_URL!, SUPABASE_SECRET_KEY!, {
      auth: { persistSession: false },
    });
    const { data, error } = await client
      .from("users")
      .select("id,name,role,password_hash")
      .ilike("email", e) // 와일드카드 없는 ilike = 대소문자 무시 정확 일치
      .limit(1)
      .maybeSingle();
    if (error || !data || !data.password_hash) return null;
    const ok = await bcrypt.compare(password, data.password_hash as string);
    if (!ok) return null;
    return {
      id: data.id as string,
      name: data.name as string,
      role: data.role as UserRole,
    };
  }

  // 로컬 mock/dev: 정적 로스터의 파생 이메일 + 공용 개발 비밀번호.
  // ⚠️ fail-close: 배포(production)에서 QUE_ALLOW_MOCK_AUTH 옵트인 없이는 mock 폴백을 차단한다.
  // (supabase env가 하나라도 누락돼 useSupabase=false로 떨어져도 프로덕션이 공용 비번으로 열리지 않게.)
  if (!isMockAuthAllowed()) return null;
  if (password !== DEV_PASSWORD) return null;
  const user = USERS.find((u) => emailForUser(u.id).toLowerCase() === e);
  return user ? { id: user.id, name: user.name, role: user.role } : null;
}
