import "server-only";
import { randomBytes, randomUUID } from "node:crypto";
import bcrypt from "bcryptjs";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import {
  canManageUsers,
  createUserInputSchema,
  updateUserProfileInputSchema,
  userRoleSchema,
  type ChangeVia,
  type CreateUserInput,
  type UpdateUserProfileInput,
  type UserRole,
} from "@que/core";

// 직원 관리(항목 19) 전용 쓰기 경로 — 추가/비활성/복구. password.ts·tokens.ts와 같은 선례로
// SECRET_KEY(service_role급)로 users 테이블에 직접 write한다. (SupabaseQueDb.persist는 users를
// write-back하지 않으므로 — auth 컬럼 보호 — 사용자 편집은 이 전용 경로로만 우회한다.)
// 업무 영향 변경은 change_logs(entity_type='user')에 via와 함께 직접 기록한다.
//
// 락아웃 방지:
//  - hard delete 없음. 비활성은 active=false 플래그로만(복구 가능).
//  - 비활성 차단: 열린 작업(ACTIVE) 또는 활성 반복 템플릿이 있으면 개수와 함께 거부한다.
//  - 자기 자신 비활성 금지(관리자 스스로 잠기는 것 방지).
//  - 초기 비밀번호는 자동 임시비번 1회 + must_change_password=true(관리자 직접 지정 없음).

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SECRET_KEY = process.env.SUPABASE_SECRET_KEY;
const useSupabase =
  process.env.QUE_DB === "supabase" && !!SUPABASE_URL && !!SUPABASE_SECRET_KEY;

const BCRYPT_ROUNDS = 10;
const NOT_SUPPORTED = "이 환경에서는 직원을 관리할 수 없습니다.";
const NOT_AUTHORIZED = "권한이 없습니다.";

/** 진행 흐름에 남아 있는(취소/병합/완료가 아닌) 작업 상태 — 비활성 차단 판정용. */
const OPEN_TASK_STATUSES = [
  "scheduled",
  "in_progress",
  "needs_reschedule",
  "on_hold",
  "issue",
] as const;

/** 아바타 색 팔레트(시드 8명과 동일 계열). 미사용색을 새 직원에게 제안한다. */
const AVATAR_PALETTE = [
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
];

export interface Actor {
  id: string;
  role: UserRole;
}

function admin(): SupabaseClient {
  return createClient(SUPABASE_URL!, SUPABASE_SECRET_KEY!, {
    auth: { persistSession: false },
  });
}

// 혼동 문자를 뺀 읽기 쉬운 임시 비밀번호(직원 생성/재설정용). password.ts의 makeTempPassword와 동일 정책.
const TEMP_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
function makeTempPassword(len = 10): string {
  const bytes = randomBytes(len);
  let out = "";
  for (let i = 0; i < len; i += 1) out += TEMP_ALPHABET[bytes[i] % TEMP_ALPHABET.length];
  return out;
}

/** 이메일 로컬파트 → id 슬러그. 영문/숫자만 남기고 소문자화, 비면 user. */
function slugFromEmail(email: string): string {
  const local = email.split("@")[0] ?? "";
  const slug = local
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug || "user";
}

/** change_logs에 직접 1건 기록(users는 core 스냅샷 밖이라 여기서 직접 insert). 실패해도 주 작업은 유지. */
async function logUserChange(
  client: SupabaseClient,
  entry: {
    entityId: string;
    actorId: string;
    changeType: "create" | "update";
    beforeValue?: string;
    afterValue?: string;
    reason?: string;
    via: ChangeVia;
  },
): Promise<void> {
  const { error } = await client.from("change_logs").insert({
    id: `clog-${randomUUID()}`,
    entity_type: "user",
    entity_id: entry.entityId,
    actor_id: entry.actorId,
    change_type: entry.changeType,
    before_value: entry.beforeValue ?? null,
    after_value: entry.afterValue ?? null,
    reason: entry.reason ?? null,
    via: entry.via,
    created_at: new Date().toISOString(),
  });
  // 주 작업(생성/비활성)은 이미 성공한 뒤라 여기서 실패해도 되돌리지 않지만, 조용히 소실되지 않게 남긴다.
  if (error) {
    console.error(`[users] ChangeLog(user/${entry.changeType}) 기록 실패: ${error.message}`);
  }
}

export interface CreatedUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  rank: string;
  department: string;
  avatarColor: string;
}

/**
 * 직원 추가 — 관리자만. 임시비번을 자동 생성해 1회만 평문으로 반환하고(로그/커밋 금지),
 * must_change_password=true·active=true로 INSERT 한다. email은 유니크(대소문자 무시).
 * id는 이메일 로컬파트 슬러그 + 충돌 시 접미사. avatarColor 미지정 시 미사용색을 제안한다.
 */
export async function createUser(input: {
  actor: Actor;
  via: ChangeVia;
  data: CreateUserInput;
}): Promise<{ ok: true; user: CreatedUser; tempPassword: string } | { ok: false; error: string }> {
  if (!canManageUsers(input.actor)) return { ok: false, error: NOT_AUTHORIZED };
  if (!useSupabase) return { ok: false, error: NOT_SUPPORTED };

  const parsed = createUserInputSchema.safeParse(input.data);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues.map((i) => i.message).join(", ") };
  }
  const { name, email, role, rank } = parsed.data;
  const department = parsed.data.department ?? "";

  const client = admin();

  // 이메일 중복 사전 체크(유니크 인덱스가 최종 방어지만, 친절한 메시지를 위해 먼저 본다).
  const { data: dup } = await client
    .from("users")
    .select("id")
    .ilike("email", email)
    .limit(1)
    .maybeSingle();
  if (dup) return { ok: false, error: "이미 등록된 이메일입니다." };

  // 기존 id/색을 읽어 충돌 없는 슬러그와 미사용색을 정한다.
  const { data: existing } = await client.from("users").select("id,avatar_color");
  const ids = new Set((existing ?? []).map((r) => r.id as string));
  const usedColors = new Set((existing ?? []).map((r) => r.avatar_color as string));

  let id = slugFromEmail(email);
  if (ids.has(id)) {
    let n = 2;
    while (ids.has(`${id}-${n}`)) n += 1;
    id = `${id}-${n}`;
  }

  const avatarColor =
    parsed.data.avatarColor ??
    AVATAR_PALETTE.find((c) => !usedColors.has(c)) ??
    AVATAR_PALETTE[ids.size % AVATAR_PALETTE.length];

  const tempPassword = makeTempPassword();
  const passwordHash = await bcrypt.hash(tempPassword, BCRYPT_ROUNDS);

  const { error } = await client.from("users").insert({
    id,
    name,
    role,
    avatar_color: avatarColor,
    active: true,
    rank,
    department,
    email,
    password_hash: passwordHash,
    must_change_password: true,
    password_changed_at: null,
    failed_login_attempts: 0,
    locked_until: null,
  });
  if (error) {
    // 유니크 인덱스(email) 위반 등 — 사전 체크를 통과했어도 경합 가능.
    if (error.code === "23505") return { ok: false, error: "이미 등록된 이메일입니다." };
    return { ok: false, error: "직원 추가에 실패했습니다. 잠시 후 다시 시도해주세요." };
  }

  await logUserChange(client, {
    entityId: id,
    actorId: input.actor.id,
    changeType: "create",
    afterValue: `${name} (${email}, ${role}/${rank})`,
    via: input.via,
  });

  return {
    ok: true,
    user: { id, name, email, role, rank, department, avatarColor },
    tempPassword,
  };
}

/**
 * 직원 비활성(deactivate) — 관리자만. 열린 작업(ACTIVE) 또는 활성 반복 템플릿이 있으면
 * 개수와 함께 거부한다(먼저 재배정/정리해야 함). 자기 자신은 비활성할 수 없다. hard delete 아님.
 */
export async function deactivateUser(input: {
  actor: Actor;
  via: ChangeVia;
  targetId: string;
}): Promise<
  | { ok: true }
  | { ok: false; error: string; openTasks?: number; activeTemplates?: number }
> {
  if (!canManageUsers(input.actor)) return { ok: false, error: NOT_AUTHORIZED };
  if (!useSupabase) return { ok: false, error: NOT_SUPPORTED };
  if (input.targetId === input.actor.id) {
    return { ok: false, error: "본인 계정은 비활성할 수 없습니다." };
  }

  const client = admin();
  const { data: target, error: tErr } = await client
    .from("users")
    .select("id,name,active")
    .eq("id", input.targetId)
    .maybeSingle();
  if (tErr || !target) return { ok: false, error: "대상 계정을 찾을 수 없습니다." };
  if (target.active === false) return { ok: false, error: "이미 비활성된 계정입니다." };

  // 열린 작업 수 — 담당자(assignee) 기준.
  const { count: openTasks } = await client
    .from("tasks")
    .select("id", { count: "exact", head: true })
    .eq("assignee_id", input.targetId)
    .in("status", OPEN_TASK_STATUSES as unknown as string[]);
  // 활성 반복 템플릿 수 — 담당자 기준(끄지 않으면 회차 Task가 계속 생성됨).
  const { count: activeTemplates } = await client
    .from("recurring_templates")
    .select("id", { count: "exact", head: true })
    .eq("assignee_id", input.targetId)
    .eq("active", true);

  const openN = openTasks ?? 0;
  const tmplN = activeTemplates ?? 0;
  if (openN > 0 || tmplN > 0) {
    return {
      ok: false,
      error:
        `열린 작업 ${openN}건, 활성 반복 템플릿 ${tmplN}건이 남아 있어 비활성할 수 없습니다. ` +
        "재배정하거나 정리한 뒤 다시 시도해주세요.",
      openTasks: openN,
      activeTemplates: tmplN,
    };
  }

  const { error } = await client
    .from("users")
    .update({ active: false })
    .eq("id", input.targetId);
  if (error) return { ok: false, error: "비활성에 실패했습니다. 잠시 후 다시 시도해주세요." };

  await logUserChange(client, {
    entityId: input.targetId,
    actorId: input.actor.id,
    changeType: "update",
    beforeValue: "active",
    afterValue: "inactive",
    reason: `${target.name} 비활성`,
    via: input.via,
  });
  return { ok: true };
}

/** 직원 복구(reactivate) — 관리자만. 비활성 계정을 다시 active로 되돌린다. */
export async function reactivateUser(input: {
  actor: Actor;
  via: ChangeVia;
  targetId: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!canManageUsers(input.actor)) return { ok: false, error: NOT_AUTHORIZED };
  if (!useSupabase) return { ok: false, error: NOT_SUPPORTED };

  const client = admin();
  const { data: target, error: tErr } = await client
    .from("users")
    .select("id,name,active")
    .eq("id", input.targetId)
    .maybeSingle();
  if (tErr || !target) return { ok: false, error: "대상 계정을 찾을 수 없습니다." };
  if (target.active !== false) return { ok: false, error: "이미 활성 상태인 계정입니다." };

  const { error } = await client
    .from("users")
    .update({ active: true })
    .eq("id", input.targetId);
  if (error) return { ok: false, error: "복구에 실패했습니다. 잠시 후 다시 시도해주세요." };

  await logUserChange(client, {
    entityId: input.targetId,
    actorId: input.actor.id,
    changeType: "update",
    beforeValue: "inactive",
    afterValue: "active",
    reason: `${target.name} 복구`,
    via: input.via,
  });
  return { ok: true };
}

/**
 * 권한(role) 변경 — 관리자만. member↔admin 승격/강등.
 * 가드(서버 최종 강제, 순서대로): 관리자만 → 유효한 role → 본인 role 변경 금지 → 대상 존재/활성 →
 * (강등이면) 마지막 활성 admin 강등 금지. 무변경(동일 role)은 조용히 성공 처리한다.
 */
export async function updateUserRole(input: {
  actor: Actor;
  via: ChangeVia;
  targetId: string;
  role: UserRole;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!canManageUsers(input.actor)) return { ok: false, error: NOT_AUTHORIZED };
  if (!useSupabase) return { ok: false, error: NOT_SUPPORTED };

  // role은 클라이언트 직렬화 값 — TS 타입만 믿지 않고 런타임 검증한다.
  const parsedRole = userRoleSchema.safeParse(input.role);
  if (!parsedRole.success) return { ok: false, error: "올바른 권한 값이 아닙니다." };
  const role = parsedRole.data;

  if (input.targetId === input.actor.id) {
    return { ok: false, error: "본인 권한은 변경할 수 없습니다." };
  }

  const client = admin();
  const { data: target, error: tErr } = await client
    .from("users")
    .select("id,name,role,active")
    .eq("id", input.targetId)
    .maybeSingle();
  if (tErr || !target) return { ok: false, error: "대상 계정을 찾을 수 없습니다." };
  if (target.active === false) return { ok: false, error: "비활성 계정은 편집할 수 없습니다." };

  const before = target.role as UserRole;
  if (before === role) return { ok: true }; // 무변경 — 조용히 성공.

  // 강등(admin→member): 마지막 활성 admin이 잠기지 않게 막는다(비활성 admin은 카운트 제외).
  if (before === "admin" && role === "member") {
    const { count: activeAdmins } = await client
      .from("users")
      .select("id", { count: "exact", head: true })
      .eq("role", "admin")
      .eq("active", true);
    if ((activeAdmins ?? 0) <= 1) {
      return { ok: false, error: "마지막 활성 관리자는 강등할 수 없습니다." };
    }
  }

  const { error } = await client
    .from("users")
    .update({ role })
    .eq("id", input.targetId);
  if (error) return { ok: false, error: "권한 변경에 실패했습니다. 잠시 후 다시 시도해주세요." };

  await logUserChange(client, {
    entityId: input.targetId,
    actorId: input.actor.id,
    changeType: "update",
    beforeValue: `role=${before}`,
    afterValue: `role=${role}`,
    reason: `${target.name} 권한 변경`,
    via: input.via,
  });
  return { ok: true };
}

/**
 * 프로필(email·rank·department) 편집 — 관리자만. name·role·active는 이 경로 대상이 아니다.
 * 가드: 관리자만 → 입력 검증(최소1필드) → 대상 존재/활성 → email 유니크(사전 ilike + 23505) →
 * rank="대표" 부여 시 대표 단일성(다른 활성 대표 있으면 거부). 실제 바뀌는 필드만 update/기록한다.
 */
export async function updateUserProfile(input: {
  actor: Actor;
  via: ChangeVia;
  targetId: string;
  data: UpdateUserProfileInput;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!canManageUsers(input.actor)) return { ok: false, error: NOT_AUTHORIZED };
  if (!useSupabase) return { ok: false, error: NOT_SUPPORTED };

  // 서버 경계 — 넘겨받은 data도 신뢰하지 않고 재검증한다(email 정규화·최소1필드·rank enum).
  const parsed = updateUserProfileInputSchema.safeParse(input.data);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues.map((i) => i.message).join(", ") };
  }
  const data = parsed.data;

  const client = admin();
  const { data: target, error: tErr } = await client
    .from("users")
    .select("id,name,email,rank,department,active")
    .eq("id", input.targetId)
    .maybeSingle();
  if (tErr || !target) return { ok: false, error: "대상 계정을 찾을 수 없습니다." };
  if (target.active === false) return { ok: false, error: "비활성 계정은 편집할 수 없습니다." };

  const currentEmail = ((target.email as string | null) ?? "").toLowerCase();
  const currentRank = (target.rank as string | null) ?? "";
  const currentDepartment = (target.department as string | null) ?? "";

  // 실제로 바뀌는 필드만 골라낸다(무변경 필드는 update·로그에서 제외).
  const changes: { email?: string; rank?: string; department?: string } = {};
  if (data.email !== undefined && data.email !== currentEmail) changes.email = data.email;
  if (data.rank !== undefined && data.rank !== currentRank) changes.rank = data.rank;
  if (data.department !== undefined && data.department !== currentDepartment) {
    changes.department = data.department;
  }
  if (Object.keys(changes).length === 0) return { ok: true }; // 무변경 — 조용히 성공.

  // email 변경: 유니크 강제(다른 사용자와 충돌 사전 검사 + DB unique 위반 catch).
  if (changes.email !== undefined) {
    const { data: dup } = await client
      .from("users")
      .select("id")
      .ilike("email", changes.email)
      .neq("id", input.targetId)
      .limit(1)
      .maybeSingle();
    if (dup) return { ok: false, error: "이미 등록된 이메일입니다." };
  }

  // rank="대표" 부여: 대표 단일성 — 다른 활성 대표가 있으면 거부(교체는 기존 대표 강등 후 2단계).
  if (changes.rank === "대표") {
    const { data: existingCeo } = await client
      .from("users")
      .select("id,name")
      .eq("rank", "대표")
      .eq("active", true)
      .neq("id", input.targetId)
      .limit(1)
      .maybeSingle();
    if (existingCeo) {
      return {
        ok: false,
        error: `이미 대표(${existingCeo.name})가 있습니다. 기존 대표의 직급을 먼저 변경해주세요.`,
      };
    }
  }

  const { error } = await client
    .from("users")
    .update(changes)
    .eq("id", input.targetId);
  if (error) {
    if (error.code === "23505") return { ok: false, error: "이미 등록된 이메일입니다." };
    return { ok: false, error: "프로필 변경에 실패했습니다. 잠시 후 다시 시도해주세요." };
  }

  // 무엇이 바뀌었는지 before/after diff로 남긴다(변경된 필드만).
  const beforeParts: string[] = [];
  const afterParts: string[] = [];
  if (changes.email !== undefined) {
    beforeParts.push(`email=${currentEmail || "(없음)"}`);
    afterParts.push(`email=${changes.email}`);
  }
  if (changes.rank !== undefined) {
    beforeParts.push(`rank=${currentRank || "(없음)"}`);
    afterParts.push(`rank=${changes.rank}`);
  }
  if (changes.department !== undefined) {
    beforeParts.push(`department=${currentDepartment || "(없음)"}`);
    afterParts.push(`department=${changes.department || "(없음)"}`);
  }

  await logUserChange(client, {
    entityId: input.targetId,
    actorId: input.actor.id,
    changeType: "update",
    beforeValue: beforeParts.join(", "),
    afterValue: afterParts.join(", "),
    reason: `${target.name} 프로필 편집`,
    via: input.via,
  });
  return { ok: true };
}
