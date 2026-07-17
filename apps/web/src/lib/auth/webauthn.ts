import "server-only";
import { randomUUID } from "node:crypto";
import { cookies } from "next/headers";
import { SignJWT, jwtVerify } from "jose";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { isoBase64URL } from "@simplewebauthn/server/helpers";
import type { AuthenticatorTransportFuture } from "@simplewebauthn/server";

// 패스키(WebAuthn) 로그인 — 이메일+비밀번호와 공존하는 "추가" 옵션.
// PAT(tokens.ts)·비밀번호(password.ts)와 같은 선례로 SECRET_KEY(service_role급) 직조회를 쓴다.
// webauthn_credentials / webauthn_login_nonces 는 core 도메인 스냅샷 밖이라 supabase-db.persist를
// 절대 타지 않는다(add-webauthn-credentials.sql 주석 참고).
//
// 흐름 요약:
//  등록  : (인증된 세션) options 발급 → 챌린지를 서명 쿠키에 담음 → 사용자가 기기로 서명 →
//          verify 라우트가 쿠키 챌린지로 검증 → webauthn_credentials INSERT.
//  로그인: (비인증) options 발급 → 챌린지 쿠키(userId 없음) → 사용자가 기기로 서명 →
//          verify 라우트가 credential id로 DB 조회·counter 검증 → 원타임 로그인 토큰(60s) 발급 →
//          Auth.js "passkey" 프로바이더가 그 토큰을 받아 jti 논스를 소진(재사용 차단)하고 세션 생성.

// ── Supabase 게이트(SSO/PAT 선례) ─────────────────────────────────────────────
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SECRET_KEY = process.env.SUPABASE_SECRET_KEY;
const useSupabase =
  process.env.QUE_DB === "supabase" && !!SUPABASE_URL && !!SUPABASE_SECRET_KEY;

/** 실 DB(+키)에서만 패스키를 활성화한다. false면 라우트가 501을 반환한다(mock/dev 비활성). */
export function isWebauthnEnabled(): boolean {
  return useSupabase;
}

function admin(): SupabaseClient {
  return createClient(SUPABASE_URL!, SUPABASE_SECRET_KEY!, {
    auth: { persistSession: false },
  });
}

// ── RP(Relying Party) 설정 — 고정 허용 목록(보안). 요청 host로 origin을 파생하지 않는다 ──────
// rpID는 프로덕션에서 상위 도메인 griff.co.kr(서브도메인 전체 커버). 로컬은 localhost.
// expectedOrigin은 화이트리스트 배열만 허용한다.
const RP_NAME = "Que";
const PROD_RP_ID = "griff.co.kr";
const PROD_ORIGINS = [
  "https://que.griff.co.kr",
  "https://gant.griff.co.kr",
  "https://view.griff.co.kr",
];
const DEV_RP_ID = "localhost";
const DEV_ORIGINS = ["http://localhost:3000"];

function isLocalHost(host: string | null): boolean {
  if (!host) return false;
  const h = host.split(":")[0]?.toLowerCase();
  return h === "localhost" || h === "127.0.0.1";
}

/** dev/prod RP를 고른다. host로 origin을 만들지 않고, dev 판정에만 참고한다.
 *  프로덕션(NODE_ENV==="production")에서는 host를 무시하고 prod RP를 고정한다 —
 *  요청 Host 헤더를 localhost로 위조해 RP를 dev로 다운그레이드하는 것을 차단한다(글래도스 권고).
 *  따라서 localhost 분기는 **비프로덕션에서만** 유효하다(프로덕션 로컬 빌드도 prod RP로 처리). */
export function resolveRp(host: string | null): {
  rpName: string;
  rpID: string;
  expectedOrigin: string[];
} {
  const dev = process.env.NODE_ENV !== "production" && isLocalHost(host);
  return dev
    ? { rpName: RP_NAME, rpID: DEV_RP_ID, expectedOrigin: DEV_ORIGINS }
    : { rpName: RP_NAME, rpID: PROD_RP_ID, expectedOrigin: PROD_ORIGINS };
}

// ── 챌린지 서명 쿠키 ──────────────────────────────────────────────────────────
// jose HS256(AUTH_SECRET)로 서명한 httpOnly 쿠키에 챌린지를 담는다(서버 상태 불필요·서명 위변조 방지).
const CHALLENGE_COOKIE = "que_webauthn_challenge";
const CHALLENGE_MAX_AGE = 300; // 5분
const CHALLENGE_AUD = "que-webauthn-challenge";

function secretKey(): Uint8Array {
  const s = process.env.AUTH_SECRET;
  if (!s) throw new Error("AUTH_SECRET 미설정");
  return new TextEncoder().encode(s);
}

interface ChallengePayload {
  challenge: string;
  /** 등록 흐름에만 존재(세션 사용자). 로그인 흐름은 없음. */
  userId?: string;
}

/** 챌린지를 서명 쿠키로 심는다. 등록은 userId 포함, 로그인은 생략. */
export async function setChallengeCookie(payload: ChallengePayload): Promise<void> {
  const token = await new SignJWT({ challenge: payload.challenge, userId: payload.userId })
    .setProtectedHeader({ alg: "HS256" })
    .setAudience(CHALLENGE_AUD)
    .setIssuedAt()
    .setExpirationTime(`${CHALLENGE_MAX_AGE}s`)
    .sign(secretKey());

  const store = await cookies();
  store.set(CHALLENGE_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: CHALLENGE_MAX_AGE,
  });
}

/** 쿠키의 챌린지를 검증해 반환하고 쿠키를 즉시 삭제한다(1회용). 없거나 위조면 null. */
export async function readAndClearChallenge(): Promise<ChallengePayload | null> {
  const store = await cookies();
  const raw = store.get(CHALLENGE_COOKIE)?.value;
  // 검증 성공 여부와 무관하게 쿠키는 항상 소거한다(재사용 방지).
  store.delete(CHALLENGE_COOKIE);
  if (!raw) return null;
  try {
    const { payload } = await jwtVerify(raw, secretKey(), { audience: CHALLENGE_AUD });
    const challenge = typeof payload.challenge === "string" ? payload.challenge : "";
    if (!challenge) return null;
    const userId = typeof payload.userId === "string" ? payload.userId : undefined;
    return { challenge, userId };
  } catch {
    return null;
  }
}

// ── 원타임 로그인 토큰(패스키 verify → Auth.js 교환) ──────────────────────────
const LOGIN_TOKEN_AUD = "que-passkey-login";
const LOGIN_TOKEN_MAX_AGE = 60; // 60초

/** 패스키 검증 성공 직후 발급하는 단명 토큰. Auth.js "passkey" 프로바이더가 이걸로 세션을 만든다. */
export async function issueLoginToken(userId: string): Promise<string> {
  return new SignJWT({})
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(userId)
    .setAudience(LOGIN_TOKEN_AUD)
    .setJti(randomUUID())
    .setIssuedAt()
    .setExpirationTime(`${LOGIN_TOKEN_MAX_AGE}s`)
    .sign(secretKey());
}

/** 로그인 토큰 검증(aud·exp). 성공 시 {userId, jti}. authorize()에서 사용. */
export async function verifyLoginToken(
  token: string,
): Promise<{ userId: string; jti: string } | null> {
  try {
    const { payload } = await jwtVerify(token, secretKey(), { audience: LOGIN_TOKEN_AUD });
    const userId = typeof payload.sub === "string" ? payload.sub : "";
    const jti = typeof payload.jti === "string" ? payload.jti : "";
    if (!userId || !jti) return null;
    return { userId, jti };
  } catch {
    return null;
  }
}

/** 로그인 논스 소진 — jti를 PK로 insert. 충돌(이미 사용됨)이면 false(리플레이 거부).
 *  삽입 전에 5분 지난 논스를 opportunistic delete로 정리한다(전용 크론 불필요). */
export async function consumeLoginNonce(jti: string): Promise<boolean> {
  if (!useSupabase) return false;
  const client = admin();
  const cutoff = new Date(Date.now() - 5 * 60 * 1000).toISOString();
  await client.from("webauthn_login_nonces").delete().lt("created_at", cutoff);
  const { error } = await client.from("webauthn_login_nonces").insert({ jti });
  // 23505 = unique_violation = 이미 사용된 토큰. 그 외 오류도 안전하게 거부한다.
  return !error;
}

// ── base64url 헬퍼(저장 일관성) ───────────────────────────────────────────────
// simplewebauthn v13은 Uint8Array<ArrayBuffer>(brand: Uint8Array_)를 요구한다 — 일반 Uint8Array로
// 넓히면 credential.publicKey 대입에서 타입 에러가 나므로 시그니처를 그 형태로 고정한다.
/** COSE publicKey(Uint8Array) → base64url 문자열(DB 저장용). */
export function publicKeyToBase64url(key: Uint8Array<ArrayBuffer>): string {
  return isoBase64URL.fromBuffer(key, "base64url");
}
/** DB의 base64url publicKey → Uint8Array(verify 입력용). */
export function base64urlToPublicKey(str: string): Uint8Array<ArrayBuffer> {
  return isoBase64URL.toBuffer(str, "base64url");
}

// ── 사용자/자격증명 조회·쓰기 ─────────────────────────────────────────────────
export interface AuthUserInfo {
  id: string;
  name: string;
  email: string;
  active: boolean;
}

/** 등록 옵션 생성·로그인 활성 검증용 최소 사용자 정보. 없거나 오류면 null. */
export async function getUserAuthInfo(userId: string): Promise<AuthUserInfo | null> {
  if (!useSupabase) return null;
  const client = admin();
  const { data, error } = await client
    .from("users")
    .select("id,name,email,active")
    .eq("id", userId)
    .maybeSingle();
  if (error || !data) return null;
  return {
    id: data.id as string,
    name: data.name as string,
    email: ((data.email as string | null) ?? "") || (data.id as string),
    active: (data.active as boolean | null) ?? true,
  };
}

/** 패스키 로그인 성공 후 Auth.js 세션에 넣을 사용자(verify.ts AuthUser와 동일 shape).
 *  active 재확인 포함 — 비활성 계정은 null. role은 항상 DB 현재값을 신뢰한다. */
export async function loadPasskeySessionUser(userId: string): Promise<{
  id: string;
  name: string;
  role: "admin" | "member";
  mustChangePassword: boolean;
} | null> {
  if (!useSupabase) return null;
  const client = admin();
  const { data, error } = await client
    .from("users")
    .select("id,name,role,active,must_change_password")
    .eq("id", userId)
    .maybeSingle();
  if (error || !data || data.active === false) return null;
  return {
    id: data.id as string,
    name: data.name as string,
    role: data.role as "admin" | "member",
    mustChangePassword: !!data.must_change_password,
  };
}

export interface StoredCredential {
  id: string;
  userId: string;
  publicKey: string; // base64url
  counter: number;
  transports: AuthenticatorTransportFuture[];
}

function parseTransports(csv: string | null): AuthenticatorTransportFuture[] {
  if (!csv) return [];
  return csv
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean) as AuthenticatorTransportFuture[];
}

/** 로그인 verify용 — credential id로 단건 조회. 없으면 null. */
export async function getCredentialById(id: string): Promise<StoredCredential | null> {
  if (!useSupabase) return null;
  const client = admin();
  const { data, error } = await client
    .from("webauthn_credentials")
    .select("id,user_id,public_key,counter,transports")
    .eq("id", id)
    .maybeSingle();
  if (error || !data) return null;
  return {
    id: data.id as string,
    userId: data.user_id as string,
    publicKey: data.public_key as string,
    counter: Number(data.counter ?? 0),
    transports: parseTransports(data.transports as string | null),
  };
}

/** 등록 시 excludeCredentials 구성용 — 사용자의 기존 자격증명 id/transports. */
export async function listCredentialTransports(
  userId: string,
): Promise<{ id: string; transports: AuthenticatorTransportFuture[] }[]> {
  if (!useSupabase) return [];
  const client = admin();
  const { data } = await client
    .from("webauthn_credentials")
    .select("id,transports")
    .eq("user_id", userId);
  return (data ?? []).map((r) => ({
    id: r.id as string,
    transports: parseTransports(r.transports as string | null),
  }));
}

/** 등록 성공 시 자격증명 INSERT. 중복 id(23505) 등 실패는 false. */
export async function insertCredential(input: {
  id: string;
  userId: string;
  publicKey: string; // base64url
  counter: number;
  transports: AuthenticatorTransportFuture[];
  deviceName: string;
}): Promise<boolean> {
  if (!useSupabase) return false;
  const client = admin();
  const { error } = await client.from("webauthn_credentials").insert({
    id: input.id,
    user_id: input.userId,
    public_key: input.publicKey,
    counter: input.counter,
    transports: input.transports.length ? input.transports.join(",") : null,
    device_name: input.deviceName,
  });
  return !error;
}

/** 로그인 성공 시 서명 카운터·마지막 사용 시각 갱신(리플레이 방지 핵심). */
export async function updateCredentialCounter(id: string, counter: number): Promise<void> {
  if (!useSupabase) return;
  const client = admin();
  await client
    .from("webauthn_credentials")
    .update({ counter, last_used_at: new Date().toISOString() })
    .eq("id", id);
}

export interface CredentialSummary {
  id: string;
  deviceName: string;
  createdAt: string;
  lastUsedAt: string | null;
}

/** 관리 화면 표시용 목록(public_key 미노출). userId 스코프. */
export async function listCredentialSummaries(userId: string): Promise<CredentialSummary[]> {
  if (!useSupabase) return [];
  const client = admin();
  const { data } = await client
    .from("webauthn_credentials")
    .select("id,device_name,created_at,last_used_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  return (data ?? []).map((r) => ({
    id: r.id as string,
    deviceName: (r.device_name as string | null) ?? "내 기기",
    createdAt: r.created_at as string,
    lastUsedAt: (r.last_used_at as string | null) ?? null,
  }));
}

/** 본인 소유 자격증명 삭제(userId 스코프 — 남의 것은 id를 알아도 삭제 불가). */
export async function deleteCredential(userId: string, id: string): Promise<boolean> {
  if (!useSupabase) return false;
  const client = admin();
  const { error } = await client
    .from("webauthn_credentials")
    .delete()
    .eq("id", id)
    .eq("user_id", userId);
  return !error;
}

/** 본인 소유 자격증명 라벨 변경(userId 스코프). */
export async function renameCredential(
  userId: string,
  id: string,
  deviceName: string,
): Promise<boolean> {
  if (!useSupabase) return false;
  const client = admin();
  const { error } = await client
    .from("webauthn_credentials")
    .update({ device_name: deviceName })
    .eq("id", id)
    .eq("user_id", userId);
  return !error;
}

/** device_name 정규화(trim·60자 절단·빈값 기본값). */
export function normalizeDeviceName(raw: unknown): string {
  const name = typeof raw === "string" ? raw.trim().slice(0, 60) : "";
  return name || "내 기기";
}
