import { createHash } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { resolvePat, findUser, type ChangeVia, type User } from "@que/core";
import { isMockAuthAllowed, MOCK_AUTH_BLOCKED_MESSAGE } from "@/lib/mock-auth-guard";

// API 계층 인증 — MCP 서버와 CLI가 사용하는 진입점.
// Authorization: Bearer <PAT> 로 사용자를 식별하고,
// X-Que-Via 헤더(mcp|cli, 화이트리스트)로 변경 출처를 기록한다.
//
// 두 모드:
// - Supabase(운영): personal_access_tokens에서 SHA-256 해시로 조회(무작위 토큰이라 추측 불가).
//                   → QUE_ALLOW_MOCK_AUTH 없이도 공개 배포에서 안전.
// - mock(로컬 dev): 결정적 토큰(que_pat_<id>) — 배포 가드로 production 차단.

export interface ApiContext {
  user: User;
  via: ChangeVia;
}

export class ApiAuthError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SECRET_KEY = process.env.SUPABASE_SECRET_KEY;
const useSupabase =
  process.env.QUE_DB === "supabase" && !!SUPABASE_URL && !!SUPABASE_SECRET_KEY;

/** PAT → 저장용 해시. 토큰은 고엔트로피 무작위라 SHA-256으로 충분(비밀번호가 아님). */
export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

async function resolveToken(token: string): Promise<User | undefined> {
  if (useSupabase) {
    const client = createClient(SUPABASE_URL!, SUPABASE_SECRET_KEY!, {
      auth: { persistSession: false },
    });
    const { data, error } = await client
      .from("personal_access_tokens")
      .select("user_id")
      .eq("token_hash", hashToken(token))
      .is("revoked_at", null)
      .limit(1)
      .maybeSingle();
    if (error || !data) return undefined;
    return findUser(data.user_id as string);
  }
  // 로컬 dev: 결정적 mock 토큰. 배포 환경(옵트인 없음)에서는 접근 차단.
  if (!isMockAuthAllowed()) {
    throw new ApiAuthError(503, MOCK_AUTH_BLOCKED_MESSAGE);
  }
  return resolvePat(token);
}

export async function authenticate(request: Request): Promise<ApiContext> {
  const header = request.headers.get("authorization");
  if (!header?.startsWith("Bearer ")) {
    throw new ApiAuthError(401, "Authorization: Bearer <token> 헤더가 필요하다");
  }
  const user = await resolveToken(header.slice("Bearer ".length).trim());
  if (!user) {
    throw new ApiAuthError(401, "유효하지 않은 토큰이다");
  }

  const viaHeader = request.headers.get("x-que-via");
  const via: ChangeVia = viaHeader === "mcp" ? "mcp" : "cli";

  return { user, via };
}
