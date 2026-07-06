"use server";

import { revalidatePath } from "next/cache";
import { isQueRuleError, type PaymentCategory, type PaymentStatus } from "@que/core";
import { getDb } from "@/lib/db";
import { getCurrentUser } from "@/lib/current-user";
import type { ActionResult } from "@/app/(app)/today/actions";

type Db = Awaited<ReturnType<typeof getDb>>;

// mutation과 persist를 반드시 같은 db 인스턴스에서 (글래도스 반려 회귀 — cache 정체성 의존 금지).
async function toResult(fn: (db: Db) => Promise<unknown> | unknown): Promise<ActionResult> {
  try {
    const db = await getDb();
    await fn(db);
    await db.persist();
    revalidatePath("/payments");
    return { ok: true };
  } catch (error) {
    if (isQueRuleError(error)) return { ok: false, error: error.message };
    throw error;
  }
}

export async function createPaymentRequestAction(input: {
  title: string;
  recipientName?: string;
  bankName: string;
  accountNumber: string;
  amount: number;
  description?: string;
  dueDate?: string; // YYYY-MM-DD
  category: string;
}): Promise<ActionResult> {
  let dueAt: string | undefined;
  if (input.dueDate) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(input.dueDate)) {
      return { ok: false, error: "유효하지 않은 마감일이다 (YYYY-MM-DD)" };
    }
    const parsed = new Date(`${input.dueDate}T17:00:00`);
    if (Number.isNaN(parsed.getTime())) return { ok: false, error: "유효하지 않은 마감일이다" };
    dueAt = parsed.toISOString();
  }

  const user = await getCurrentUser();
  return toResult((db) =>
    db.createPaymentRequest({ actorId: user.id, via: "web" }, { ...input, dueAt }),
  );
}

export async function updatePaymentStatusAction(input: {
  paymentId: string;
  to: PaymentStatus;
}): Promise<ActionResult> {
  const user = await getCurrentUser();
  return toResult((db) => db.updatePaymentStatus({ actorId: user.id, via: "web" }, input));
}

// 결제 분류(카테고리) 관리 — 관리자 전용. 권한 최종 강제는 core mutation(canManagePaymentCategory).
// getCurrentUser로 actor를 확정하고, 페이지도 비관리자를 막는다(3중 게이트).
export async function createPaymentCategoryAction(input: {
  name: string;
}): Promise<ActionResult> {
  const user = await getCurrentUser();
  return toResult((db) => db.createPaymentCategory({ actorId: user.id, via: "web" }, input));
}

export async function updatePaymentCategoryAction(input: {
  categoryId: string;
  name?: string;
  status?: PaymentCategory["status"];
}): Promise<ActionResult> {
  const user = await getCurrentUser();
  return toResult((db) => db.updatePaymentCategory({ actorId: user.id, via: "web" }, input));
}

export async function reorderPaymentCategoriesAction(input: {
  orderedIds: string[];
}): Promise<ActionResult> {
  const user = await getCurrentUser();
  return toResult((db) => db.reorderPaymentCategories({ actorId: user.id, via: "web" }, input));
}
