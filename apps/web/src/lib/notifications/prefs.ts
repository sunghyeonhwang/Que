import "server-only";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { NotificationIntent, NotificationKind } from "@que/core";

// 알림 개인 설정 — 리듬성(정기) 개인 DM만 개인이 끌 수 있게 하는 muted 목록.
// core 도메인 밖(notification_prefs 테이블 직조회 · webauthn/PAT 선례). SupabaseQueDb.persist를
// 절대 타지 않는다(add-notification-prefs.sql 격리 주석 참고).
//
// 3분류(dispatch·config가 발송하는 21종 기준):
//  ⑴ MUTABLE   = 개인이 끌 수 있음 — 리듬성(정기 발송) 개인 DM. 아래 MUTABLE_KINDS가 정본(화이트리스트).
//  ⑵ ALWAYS_ON = 트랜잭셔널 개인 DM — 당사자가 응답해야 업무가 진행되는 신호(끄면 업무가 깨진다).
//     task_created / crisis / crisis_remind / crisis_esc / change_remind / change_esc /
//     payment_created / payment_done / standup_help / meeting_note. → MUTABLE_KINDS 밖이라 필터 대상 아님.
//  ⑶ CHANNEL   = 팀채널 웹훅 게시(개인 설정 무의미 — recipient 없음).
//     issue / on_hold / deadline / standup / standup_summary / weekly_preview / weekly_agenda.
//     (weekly_preview는 이름과 달리 개인 DM이 아니라 entityId="team" 팀채널 게시 → CHANNEL.)
//
// 판정 기준(애매한 kind): "당사자가 응답해야 업무가 진행되는가" → 그렇다=ALWAYS_ON.

/** 끌 수 있는 알림 1종의 메타(UI가 그대로 소비 — 라벨·설명). */
export interface MutableKindMeta {
  kind: NotificationKind;
  label: string;
  description: string;
}

/**
 * 개인이 끌 수 있는 알림(정본 화이트리스트). 리듬성(정기 발송) 개인 DM만.
 * 저장·조회·발송 필터가 모두 이 목록으로 검증한다 — 이 밖의 kind는 조용히 무시된다(조작 방어).
 */
export const MUTABLE_KINDS: readonly MutableKindMeta[] = [
  {
    kind: "personal_digest",
    label: "아침 개인 브리핑",
    description: "매일 아침, 오늘 할 일·마감·회의를 정리해 보내는 DM입니다.",
  },
  {
    kind: "standup_open",
    label: "스탠드업 오픈 안내",
    description: "매일 오전 10시, 데일리 스탠드업이 열렸다고 알리는 DM입니다.",
  },
  {
    kind: "standup_remind",
    label: "스탠드업 미제출 재촉",
    description: "오전 10시 40분, 아직 오늘 체크인을 남기지 않았을 때 오는 재촉 DM입니다.",
  },
  {
    kind: "checkin_prompt",
    label: "응답 대기 체크인 재촉",
    description: "응답을 기다리는 체크인이 있을 때, 담당자에게 오는 재촉 DM입니다.",
  },
] as const;

const MUTABLE_KIND_SET: ReadonlySet<string> = new Set(MUTABLE_KINDS.map((m) => m.kind));

/** 이 kind가 개인이 끌 수 있는(MUTABLE) 종류인가. ALWAYS_ON·CHANNEL은 false. */
export function isMutableKind(kind: string): boolean {
  return MUTABLE_KIND_SET.has(kind);
}

// ── Supabase 게이트(webauthn/PAT 선례) ────────────────────────────────────────
// mock/dev(QUE_DB!=="supabase" 또는 키 부재)에서는 기능이 비활성 — 아무도 못 끄고(빈 Set),
// 발송 필터도 전량 통과시킨다(기능 무해 비활성). 실 DB에서만 개인 설정이 동작한다.
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SECRET_KEY = process.env.SUPABASE_SECRET_KEY;
const useSupabase =
  process.env.QUE_DB === "supabase" && !!SUPABASE_URL && !!SUPABASE_SECRET_KEY;

/** 알림 개인 설정 기능 활성 여부(실 DB + 키). false면 아무도 알림을 끌 수 없다(무해). */
export function notificationPrefsEnabled(): boolean {
  return useSupabase;
}

function admin(): SupabaseClient {
  return createClient(SUPABASE_URL!, SUPABASE_SECRET_KEY!, {
    auth: { persistSession: false },
  });
}

/** CSV → muted kind Set. **MUTABLE 화이트리스트로 필터**(조작·이월 방어 — 밖의 값은 버린다). */
function parseMuted(csv: string | null): Set<string> {
  if (!csv) return new Set();
  return new Set(
    csv
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
      .filter(isMutableKind),
  );
}

/**
 * 한 유저가 끈 알림 kind Set. mock/dev면 빈 Set(아무도 못 끔). 테이블 부재·오류도 빈 Set으로
 * **fail-open** — prefs 조회 실패 때문에 알림이 전부 죽으면 안 되므로(발송 우선).
 */
export async function getMutedKinds(userId: string): Promise<Set<string>> {
  if (!useSupabase) return new Set();
  try {
    const { data, error } = await admin()
      .from("notification_prefs")
      .select("muted_kinds")
      .eq("user_id", userId)
      .maybeSingle();
    if (error || !data) return new Set(); // 미설정/테이블 부재 → fail-open
    return parseMuted(data.muted_kinds as string | null);
  } catch {
    return new Set(); // fail-open(발송 경로가 죽지 않게)
  }
}

/**
 * 여러 유저의 muted Set 일괄 조회(발송 경로용 — 리듬성 발송은 대부분 루프라 N+1 방지).
 * 반환 맵에는 **끈 항목이 하나라도 있는 유저만** 담긴다(없는 유저는 키 부재 = 빈 Set 취급).
 * mock/dev·오류·테이블 부재는 빈 맵으로 fail-open(전량 발송 유지).
 */
export async function getMutedKindsBulk(userIds: string[]): Promise<Map<string, Set<string>>> {
  const result = new Map<string, Set<string>>();
  const ids = [...new Set(userIds)];
  if (!useSupabase || ids.length === 0) return result;
  try {
    const { data, error } = await admin()
      .from("notification_prefs")
      .select("user_id,muted_kinds")
      .in("user_id", ids);
    if (error || !data) return result; // fail-open
    for (const row of data) {
      const muted = parseMuted(row.muted_kinds as string | null);
      if (muted.size > 0) result.set(row.user_id as string, muted);
    }
    return result;
  } catch {
    return result; // fail-open
  }
}

/**
 * 본인 muted 목록 저장. **MUTABLE 화이트리스트로 필터** — 그 외 값(ALWAYS_ON·CHANNEL·미상)은
 * 조용히 제거한다(클라이언트를 신뢰하지 않는 조작 방어). 중복 제거·정렬 후 CSV로 upsert.
 * mock/dev·오류면 false(호출부가 실패 토스트). userId 스코프.
 */
export async function setMutedKinds(userId: string, kinds: string[]): Promise<boolean> {
  if (!useSupabase) return false;
  const clean = [...new Set(kinds.filter(isMutableKind))].sort();
  try {
    const { error } = await admin()
      .from("notification_prefs")
      .upsert(
        { user_id: userId, muted_kinds: clean.join(","), updated_at: new Date().toISOString() },
        { onConflict: "user_id" },
      );
    return !error;
  } catch {
    return false;
  }
}

/**
 * 개인 알림 설정 발송 필터 — 리듬성 개인 DM(MUTABLE)만 대상. 수신자가 끈 kind의 intent를 제거한다.
 * ALWAYS_ON·CHANNEL kind는 MUTABLE_KINDS 밖이라 필터를 타지 않고 그대로 통과(화이트리스트).
 * 수신자별 getMutedKindsBulk 일괄 조회로 N+1 방지. mock/dev·대상 없음·오류는 원본 그대로 반환(fail-open).
 * ⚠️ 여기서 제거된 intent는 아웃박스에 **적재조차 되지 않는다**(부재자 스킵 선례 — dedup 무오염).
 */
export async function filterMutedIntents(
  intents: NotificationIntent[],
): Promise<NotificationIntent[]> {
  if (!useSupabase || intents.length === 0) return intents;
  const recipients = new Set<string>();
  for (const i of intents) {
    if (i.recipient && isMutableKind(i.kind)) recipients.add(i.recipient);
  }
  if (recipients.size === 0) return intents; // MUTABLE DM 대상 없음 — 조회 생략
  const mutedByUser = await getMutedKindsBulk([...recipients]);
  if (mutedByUser.size === 0) return intents; // 아무도 안 끔
  return intents.filter((i) => {
    if (!i.recipient || !isMutableKind(i.kind)) return true; // ALWAYS_ON·CHANNEL 그대로
    return !mutedByUser.get(i.recipient)?.has(i.kind);
  });
}
