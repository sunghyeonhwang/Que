import "server-only";
import { randomBytes } from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { hashToken } from "@/lib/api/auth";

// 개인 액세스 토큰(PAT) 발급/목록/폐기 — MCP·CLI 인증용. SECRET_KEY로 personal_access_tokens에 직접 write.
// (PAT 테이블은 core 스냅샷 DB 밖이라 password.ts처럼 전용 직접-Supabase 모듈이 맞다.)
// 평문 토큰은 발급 순간 1회만 반환하고, DB엔 SHA-256 해시(api/auth.ts의 hashToken 재사용)만 저장한다.

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SECRET_KEY = process.env.SUPABASE_SECRET_KEY;
const useSupabase =
  process.env.QUE_DB === "supabase" && !!SUPABASE_URL && !!SUPABASE_SECRET_KEY;

const NOT_SUPPORTED = "이 환경에서는 토큰을 발급할 수 없습니다.";
const MAX_ACTIVE = 10;
const LABEL_MAX = 60;

function admin(): SupabaseClient {
  return createClient(SUPABASE_URL!, SUPABASE_SECRET_KEY!, {
    auth: { persistSession: false },
  });
}

export interface PatRow {
  /** 폐기 식별자(SHA-256 해시 — 평문 아님, 이걸로는 인증 불가). */
  tokenHash: string;
  label: string;
  createdAt: string;
}

/** 고엔트로피 무작위 토큰. 접두 que_pat_ + 192bit hex. */
function generatePat(): string {
  return `que_pat_${randomBytes(24).toString("hex")}`;
}

export async function issuePat(input: {
  userId: string;
  label: string;
}): Promise<{ ok: true; token: string } | { ok: false; error: string }> {
  if (!useSupabase) return { ok: false, error: NOT_SUPPORTED };
  const label = input.label.trim();
  if (!label) return { ok: false, error: "토큰을 구분할 라벨을 입력해주세요." };
  if (label.length > LABEL_MAX) return { ok: false, error: "라벨이 너무 길어요." };

  const client = admin();
  const { count } = await client
    .from("personal_access_tokens")
    .select("token_hash", { count: "exact", head: true })
    .eq("user_id", input.userId)
    .is("revoked_at", null);
  if ((count ?? 0) >= MAX_ACTIVE) {
    return {
      ok: false,
      error: `활성 토큰은 최대 ${MAX_ACTIVE}개까지예요. 안 쓰는 토큰을 폐기하고 다시 시도해주세요.`,
    };
  }

  const token = generatePat();
  const { error } = await client
    .from("personal_access_tokens")
    .insert({ token_hash: hashToken(token), user_id: input.userId, label });
  if (error) return { ok: false, error: "토큰 발급에 실패했어요. 잠시 후 다시 시도해주세요." };
  return { ok: true, token };
}

export async function listPats(userId: string): Promise<PatRow[]> {
  if (!useSupabase) return [];
  const client = admin();
  const { data } = await client
    .from("personal_access_tokens")
    .select("token_hash,label,created_at")
    .eq("user_id", userId)
    .is("revoked_at", null)
    .order("created_at", { ascending: false });
  return (data ?? []).map((r) => ({
    tokenHash: r.token_hash as string,
    label: (r.label as string | null) ?? "(라벨 없음)",
    createdAt: r.created_at as string,
  }));
}

export async function revokePat(input: {
  userId: string;
  tokenHash: string;
}): Promise<{ ok: boolean }> {
  if (!useSupabase) return { ok: false };
  const client = admin();
  // user_id 스코프 — 남의 토큰은 해시를 알아도 폐기 불가.
  const { error } = await client
    .from("personal_access_tokens")
    .update({ revoked_at: new Date().toISOString() })
    .eq("token_hash", input.tokenHash)
    .eq("user_id", input.userId)
    .is("revoked_at", null);
  return { ok: !error };
}
