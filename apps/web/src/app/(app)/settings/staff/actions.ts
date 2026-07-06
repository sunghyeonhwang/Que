"use server";

import { revalidatePath } from "next/cache";
import { canManageUsers, type CreateUserInput } from "@que/core";
import { getCurrentUser } from "@/lib/current-user";
import {
  createUser,
  deactivateUser,
  reactivateUser,
  type CreatedUser,
} from "@/lib/auth/users";
import { adminResetPassword } from "@/lib/auth/password";

// 직원 관리(항목 19) 서버 액션 — 전부 관리자 전용.
// actor는 세션에서 확정하고 canManageUsers로 게이트한다(페이지 redirect + 탭 숨김과 함께 3중).
// 임시비번은 액션 반환값(tempPassword)으로만 전달한다 — URL/쿠키/로그 금지.
// 명단/버튼 제어 데이터는 getManagedUsers가 서버에서 재조회하도록 /settings/staff를 revalidate.

const NOT_AUTHORIZED = "권한이 없습니다.";

export type CreateStaffResult =
  | { ok: true; user: CreatedUser; tempPassword: string }
  | { ok: false; error: string };

/** 직원 추가 — 임시비번을 1회만 반환한다(화면 표시용, 어디에도 저장 금지). */
export async function createStaffAction(data: CreateUserInput): Promise<CreateStaffResult> {
  const actor = await getCurrentUser();
  if (!canManageUsers(actor)) return { ok: false, error: NOT_AUTHORIZED };

  const res = await createUser({
    actor: { id: actor.id, role: actor.role },
    via: "web",
    data,
  });
  if (!res.ok) return res;

  revalidatePath("/settings/staff");
  return res;
}

export type DeactivateStaffResult =
  | { ok: true }
  | { ok: false; error: string; openTasks?: number; activeTemplates?: number };

/** 직원 비활성 — 열린 작업/활성 템플릿이 있으면 개수와 함께 거부. 본인 비활성 금지(서버가 강제). */
export async function deactivateStaffAction(targetId: string): Promise<DeactivateStaffResult> {
  const actor = await getCurrentUser();
  if (!canManageUsers(actor)) return { ok: false, error: NOT_AUTHORIZED };

  const res = await deactivateUser({
    actor: { id: actor.id, role: actor.role },
    via: "web",
    targetId,
  });
  if (res.ok) revalidatePath("/settings/staff");
  return res;
}

export type ReactivateStaffResult = { ok: true } | { ok: false; error: string };

/** 직원 복구 — 비활성 계정을 다시 활성으로 되돌린다. */
export async function reactivateStaffAction(targetId: string): Promise<ReactivateStaffResult> {
  const actor = await getCurrentUser();
  if (!canManageUsers(actor)) return { ok: false, error: NOT_AUTHORIZED };

  const res = await reactivateUser({
    actor: { id: actor.id, role: actor.role },
    via: "web",
    targetId,
  });
  if (res.ok) revalidatePath("/settings/staff");
  return res;
}

export type ResetStaffPasswordResult =
  | { ok: true; tempPassword: string }
  | { ok: false; error: string };

/** 비번 재설정 — adminResetPassword 재사용. 임시비번을 1회만 반환한다. */
export async function resetStaffPasswordAction(
  targetId: string,
): Promise<ResetStaffPasswordResult> {
  const actor = await getCurrentUser();
  if (!canManageUsers(actor)) return { ok: false, error: NOT_AUTHORIZED };

  return adminResetPassword({ actorRole: actor.role, targetId });
}
