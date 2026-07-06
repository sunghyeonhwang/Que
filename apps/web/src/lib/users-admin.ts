import { createClient } from "@supabase/supabase-js";
import { canManageUsers, emailForUser, type UserRole } from "@que/core";
import { getDb } from "./db";

// 직원 관리(항목 19) 설정 화면용 조회 계층 — 관리자 전용. 비활성 포함 전체 명단 +
// 비활성 차단 조건(열린 작업/활성 반복 템플릿) 개수를 함께 준다(프론트가 버튼 비활성/경고에 사용).
// 명단·작업·템플릿은 core db(getDb)에서, email은 DB users.email에서 직접 읽는다(도메인 User엔 email이 없음).

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SECRET_KEY = process.env.SUPABASE_SECRET_KEY;
const useSupabase =
  process.env.QUE_DB === "supabase" && !!SUPABASE_URL && !!SUPABASE_SECRET_KEY;

/**
 * 아바타/캘린더 구분색 팔레트 — auth/users.ts의 서버 기본값 팔레트와 동일하게 유지한다.
 * 직원 추가 폼이 "미사용색"을 제안하는 데 쓴다(서버가 최종적으로 미지정 시 미사용색을 확정).
 */
export const AVATAR_PALETTE = [
  "#2563eb",
  "#16a34a",
  "#d97706",
  "#dc2626",
  "#7c3aed",
  "#0891b2",
  "#db2777",
  "#0d9488",
  "#4f46e5",
  "#ca8a04",
  "#0284c7",
  "#9333ea",
] as const;

const OPEN_TASK_STATUSES = new Set([
  "scheduled",
  "in_progress",
  "needs_reschedule",
  "on_hold",
  "issue",
]);

export interface ManagedUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  rank: string;
  department: string;
  active: boolean;
  avatarColor: string;
  /** 열린 작업 수(담당자 기준) — 0이어야 비활성 가능. */
  openTaskCount: number;
  /** 활성 반복 템플릿 수(담당자 기준) — 0이어야 비활성 가능. */
  activeTemplateCount: number;
}

/** email은 도메인 User가 아니라 DB users.email에 있으므로 별도로 조회한다(관리자 전용 화면). */
async function loadEmails(ids: string[]): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  if (useSupabase) {
    const client = createClient(SUPABASE_URL!, SUPABASE_SECRET_KEY!, {
      auth: { persistSession: false },
    });
    const { data } = await client.from("users").select("id,email");
    for (const r of data ?? []) {
      if (r.email) map.set(r.id as string, r.email as string);
    }
  }
  // 폴백: DB에 없거나 mock/dev면 id에서 유도한 이메일.
  for (const id of ids) if (!map.has(id)) map.set(id, emailForUser(id));
  return map;
}

/**
 * 직원 목록(비활성 포함) — 관리자 전용. 권한 없으면 빈 배열.
 * 각 직원의 열린 작업/활성 반복 템플릿 수를 함께 계산해 비활성 가능 여부를 프론트가 판단하게 한다.
 */
export async function getManagedUsers(actor: { role: UserRole }): Promise<ManagedUser[]> {
  if (!canManageUsers(actor)) return [];
  const db = await getDb();

  const openByUser = new Map<string, number>();
  for (const t of db.tasks) {
    if (!OPEN_TASK_STATUSES.has(t.status)) continue;
    openByUser.set(t.assigneeId, (openByUser.get(t.assigneeId) ?? 0) + 1);
  }
  const tmplByUser = new Map<string, number>();
  for (const tmpl of db.recurringTemplates) {
    if (!tmpl.active) continue;
    tmplByUser.set(tmpl.assigneeId, (tmplByUser.get(tmpl.assigneeId) ?? 0) + 1);
  }

  const emails = await loadEmails(db.users.map((u) => u.id));

  return db.users
    .map((u) => ({
      id: u.id,
      name: u.name,
      email: emails.get(u.id) ?? emailForUser(u.id),
      role: u.role,
      rank: u.rank ?? "사원",
      department: u.department ?? "",
      active: u.active !== false,
      avatarColor: u.avatarColor,
      openTaskCount: openByUser.get(u.id) ?? 0,
      activeTemplateCount: tmplByUser.get(u.id) ?? 0,
    }))
    // 활성 먼저, 그 안에서 이름순.
    .sort((a, b) => Number(b.active) - Number(a.active) || a.name.localeCompare(b.name, "ko"));
}
