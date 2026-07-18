import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// DayBlocks(todo.griff.co.kr) 개인 데이터 서버 저장 — 블록(db_blocks) + 하루 회고(db_day_reviews).
// meeting-summary.ts·webauthn.ts·tokens.ts와 같은 선례다: 이 두 테이블은 core 도메인 스냅샷 밖이라
// SupabaseQueDb.persist/load를 절대 타지 않고, 전용 admin 클라이언트로 직조회/직쓰기만 한다.
//
// 보안: DayBlocks는 Supabase SDK에 직접 접근하지 않는다. 반드시 Que API(PAT Bearer·본인 스코프 강제)를
// 통해서만 이 함수들에 닿는다. userId는 항상 인증된 본인(라우트가 ctx.user.id로 강제)만 넘어온다.
//
// payload/snapshot의 내부 구조는 DayBlocks 레포가 정본이다 — 서버는 소유·날짜·시각만 알고, 내용은
// 방어적으로만 읽는다(getYesterdaySeeSummary 참고). mock/dev(키 없음)에서는 라우트가 501로 비활성한다.

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SECRET_KEY = process.env.SUPABASE_SECRET_KEY;
const useSupabase =
  process.env.QUE_DB === "supabase" && !!SUPABASE_URL && !!SUPABASE_SECRET_KEY;

/** 실 DB(+키)에서만 DayBlocks 저장을 활성화한다. false면 라우트가 501을 반환한다(mock/dev 비활성). */
export function isDayBlocksEnabled(): boolean {
  return useSupabase;
}

function admin(): SupabaseClient {
  return createClient(SUPABASE_URL!, SUPABASE_SECRET_KEY!, {
    auth: { persistSession: false },
  });
}

// ── 블록(db_blocks) ────────────────────────────────────────────────────────────

/** 저장/반환용 블록 형태(API 계약). payload 구조는 DayBlocks 정본이라 unknown으로 통과시킨다. */
export interface BlockRow {
  id: string;
  dateKey: string;
  payload: unknown;
  updatedAt: string;
}

/** 본인 블록을 날짜 범위(from~to, 둘 다 포함)로 조회한다. */
export async function getBlocks(
  userId: string,
  from: string,
  to: string,
): Promise<BlockRow[]> {
  const client = admin();
  const { data, error } = await client
    .from("db_blocks")
    .select("id,date_key,payload,updated_at")
    .eq("user_id", userId)
    .gte("date_key", from)
    .lte("date_key", to)
    .order("date_key", { ascending: true });
  if (error) throw error;
  return (data ?? []).map((r) => ({
    id: r.id as string,
    dateKey: r.date_key as string,
    payload: r.payload,
    updatedAt: r.updated_at as string,
  }));
}

/** upsert 입력 블록. updatedAt은 선택(없으면 서버 시각). */
export interface BlockInput {
  id: string;
  dateKey: string;
  payload: unknown;
  updatedAt?: string;
}

/** upsert 결과 — 저장된 id 목록과 거부된 건(사유 포함). */
export interface UpsertBlocksResult {
  saved: string[];
  rejected: { id: string; reason: string }[];
}

/**
 * 본인 소유로 블록을 bulk upsert 한다. id는 클라이언트(DayBlocks)가 생성하므로 **타 사용자 행 탈취**를
 * 막는다: upsert(onConflict id)는 소유자를 덮어쓸 수 있으니, 먼저 해당 id들의 기존 소유자를 조회해
 * **다른 사용자 소유면 그 건을 거부**하고 결과에 표기한다(TOCTOU 경합 창은 소규모 팀 규모에서 무시 가능).
 */
export async function upsertBlocks(
  userId: string,
  blocks: BlockInput[],
): Promise<UpsertBlocksResult> {
  const client = admin();
  const rejected: { id: string; reason: string }[] = [];

  // 1) 들어온 id들의 기존 소유자 확인(탈취 방지).
  const ids = blocks.map((b) => b.id);
  const { data: existing, error: selErr } = await client
    .from("db_blocks")
    .select("id,user_id")
    .in("id", ids);
  if (selErr) throw selErr;
  const ownerById = new Map<string, string>();
  for (const row of existing ?? []) {
    ownerById.set(row.id as string, row.user_id as string);
  }

  // 2) 남의 소유 id는 거부, 나머지는 본인 소유로 upsert 준비.
  const nowIso = new Date().toISOString();
  const toUpsert = blocks.filter((b) => {
    const owner = ownerById.get(b.id);
    if (owner && owner !== userId) {
      rejected.push({ id: b.id, reason: "다른 사용자 소유 id" });
      return false;
    }
    return true;
  });

  if (toUpsert.length === 0) return { saved: [], rejected };

  const rows = toUpsert.map((b) => ({
    id: b.id,
    user_id: userId,
    date_key: b.dateKey,
    payload: b.payload,
    // 클라 updatedAt이 유효한 시각이면 존중, 아니면 서버 시각(구조·순서는 DayBlocks가 관리).
    updated_at: b.updatedAt && !Number.isNaN(Date.parse(b.updatedAt)) ? b.updatedAt : nowIso,
  }));
  const { error: upErr } = await client.from("db_blocks").upsert(rows, { onConflict: "id" });
  if (upErr) throw upErr;

  return { saved: toUpsert.map((b) => b.id), rejected };
}

/** 본인 소유 블록만 삭제한다(user_id 조건 포함 — 남의 행은 건드리지 못한다). 삭제 개수 반환. */
export async function deleteBlocks(userId: string, ids: string[]): Promise<number> {
  const client = admin();
  const { data, error } = await client
    .from("db_blocks")
    .delete()
    .eq("user_id", userId)
    .in("id", ids)
    .select("id");
  if (error) throw error;
  return (data ?? []).length;
}

// ── 하루 회고(db_day_reviews) ──────────────────────────────────────────────────

/** 회고 반환 형태(API 계약). snapshot 구조는 DayBlocks 정본. */
export interface DayReviewRow {
  dateKey: string;
  snapshot: unknown;
  updatedAt: string;
}

/** 본인 하루 회고를 날짜 범위(from~to, 둘 다 포함)로 조회한다. */
export async function getDayReviews(
  userId: string,
  from: string,
  to: string,
): Promise<DayReviewRow[]> {
  const client = admin();
  const { data, error } = await client
    .from("db_day_reviews")
    .select("date_key,snapshot,updated_at")
    .eq("user_id", userId)
    .gte("date_key", from)
    .lte("date_key", to)
    .order("date_key", { ascending: true });
  if (error) throw error;
  return (data ?? []).map((r) => ({
    dateKey: r.date_key as string,
    snapshot: r.snapshot,
    updatedAt: r.updated_at as string,
  }));
}

/** upsert 입력 회고. */
export interface DayReviewInput {
  dateKey: string;
  snapshot: unknown;
}

/**
 * 본인 하루 회고를 bulk upsert 한다. PK가 (user_id, date_key)라 upsert가 **구조적으로 본인 밖을
 * 건드릴 수 없다**(user_id를 항상 본인으로 고정) — 블록과 달리 별도 탈취 방지 로직이 필요 없다.
 * 저장된 dateKey 목록을 반환한다.
 */
export async function upsertDayReviews(
  userId: string,
  reviews: DayReviewInput[],
): Promise<string[]> {
  const client = admin();
  const nowIso = new Date().toISOString();
  const rows = reviews.map((r) => ({
    user_id: userId,
    date_key: r.dateKey,
    snapshot: r.snapshot,
    updated_at: nowIso,
  }));
  const { error } = await client
    .from("db_day_reviews")
    .upsert(rows, { onConflict: "user_id,date_key" });
  if (error) throw error;
  return reviews.map((r) => r.dateKey);
}

// ── See → 데일리 체크인 연계 ────────────────────────────────────────────────────

/** KST(Asia/Seoul, instrumentation.ts에서 TZ 고정) 로컬 날짜 키. daily-data.ts의 kstDateKey와 동일 술어를
 *  의도적으로 인라인한다 — 무거운 daily-data 체인을 API 라우트(dayblocks.ts 재사용)로 끌어들이지 않기 위함. */
function kstDateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** 값에서 첫 번째 비공백 문자열 필드를 관대하게 뽑는다(DayBlocks 스키마 미상 → 흔한 이름들 방어 탐색).
 *  AI 프롬프트에 삽입되는 값이라 위생 필수: 개행·제어문자를 공백으로 접고 60자 절단 — 서버는
 *  payload 내용을 검증하지 않으므로 초장문/개행 제목의 프롬프트 오염 차단(글래도스 게이트 조건). */
function pickString(obj: Record<string, unknown>, keys: string[]): string | null {
  for (const k of keys) {
    const v = obj[k];
    if (typeof v !== "string") continue;
    const clean = v.replace(/[\r\n\t -]+/g, " ").replace(/\s+/g, " ").trim();
    if (!clean) continue;
    return clean.length > 60 ? `${clean.slice(0, 60)}…` : clean;
  }
  return null;
}

/** 블록 payload에서 완료 여부를 관대하게 판정한다(흔한 불리언·status 방어 탐색). 알 수 없으면 false. */
function isBlockDone(obj: Record<string, unknown>): boolean {
  for (const k of ["done", "completed", "checked", "isDone", "complete"]) {
    if (obj[k] === true) return true;
  }
  const status = obj["status"];
  if (typeof status === "string" && ["done", "completed", "complete"].includes(status.toLowerCase())) {
    return true;
  }
  return false;
}

/**
 * 어제(달력 어제) 본인 See 회고가 있으면, 그날 블록의 실행률·밀린 항목을 1줄 요약해 반환한다.
 * 데일리 체크인 AI 개인 초안의 **선택적 재료**다 — 없으면 null(프롬프트 비대 금지, 조회 실패는 조용히 무시).
 *
 * 날짜 선택: 달력 어제부터 최대 3일 역탐색(월요일이면 일→토→금까지)해, **회고 스냅샷이 존재하는 가장
 * 최근 날**을 고른다. 영업일 산술이 아니라 단순 달력 역탐색(3일 상한)이다.
 *
 * 방어적 파싱: snapshot·payload 구조는 DayBlocks 정본이라 기대 필드가 없으면 조용히 스킵한다.
 * 회고는 있으나 그날 블록에서 유의미한 계획(제목 있는 블록)을 못 뽑으면 null(억지 요약 금지).
 */
export async function getYesterdaySeeSummary(userId: string, now: Date): Promise<string | null> {
  if (!useSupabase) return null;
  try {
    // 달력 어제부터 3일치 후보 날짜 키(가까운 순).
    const base = new Date(now);
    base.setHours(12, 0, 0, 0); // 자정 경계 흔들림 방지(KST 고정, DST 없음)
    const candidates: string[] = [];
    for (let i = 1; i <= 3; i += 1) {
      const d = new Date(base);
      d.setDate(d.getDate() - i);
      candidates.push(kstDateKey(d));
    }

    const client = admin();
    // 회고가 존재하는 가장 최근 후보 날을 고른다.
    const { data: reviews, error: revErr } = await client
      .from("db_day_reviews")
      .select("date_key")
      .eq("user_id", userId)
      .in("date_key", candidates)
      .order("date_key", { ascending: false })
      .limit(1);
    if (revErr || !reviews || reviews.length === 0) return null;
    const dateKey = reviews[0].date_key as string;

    // 그날 블록으로 계획/실행/밀린 항목 산정.
    const { data: blocks, error: blkErr } = await client
      .from("db_blocks")
      .select("payload")
      .eq("user_id", userId)
      .eq("date_key", dateKey);
    if (blkErr || !blocks) return null;

    let planned = 0;
    let done = 0;
    const unfinished: string[] = [];
    for (const b of blocks) {
      const payload = b.payload;
      if (!payload || typeof payload !== "object") continue; // 방어: 객체가 아니면 스킵
      const obj = payload as Record<string, unknown>;
      const title = pickString(obj, ["title", "text", "label", "content", "name"]);
      if (!title) continue; // 제목(계획)으로 해석 못 하면 계획으로 세지 않는다
      planned += 1;
      if (isBlockDone(obj)) {
        done += 1;
      } else if (unfinished.length < 3) {
        unfinished.push(title);
      }
    }
    if (planned === 0) return null; // 유의미한 계획이 없으면 무추가

    const tail = unfinished.length > 0 ? `, 밀린 것: ${unfinished.join(", ")}` : "";
    return `어제 개인 시간 회고: 계획 ${planned}건 중 ${done}건 실행${tail}`;
  } catch (e) {
    // 테이블 부재·네트워크 등 — 초안 생성은 기존대로 진행(조용히 무시).
    console.error("[que-dayblocks] 어제 See 요약 실패(무시)", e);
    return null;
  }
}
