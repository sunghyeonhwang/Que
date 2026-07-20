"use server";

import { revalidatePath } from "next/cache";
import { isQueRuleError, type PaymentCategory, type PaymentStatus } from "@que/core";
import { getDb } from "@/lib/db";
import { getCurrentUser } from "@/lib/current-user";
import { notifyPaymentCreated, notifyPaymentDone } from "@/lib/notifications/dispatch";
import type { ActionResult } from "@/app/(app)/today/actions";

type Db = Awaited<ReturnType<typeof getDb>>;

// mutation과 persist를 반드시 같은 db 인스턴스에서 (글래도스 반려 회귀 — cache 정체성 의존 금지).
// afterCommit: persist 성공 직후 알림 훅(있으면). 절대 throw하지 않는 훅만 전달한다(발송 실패가 응답을 막지 않게).
async function toResult<T>(
  fn: (db: Db) => Promise<T> | T,
  afterCommit?: (db: Db, result: T) => Promise<void>,
): Promise<ActionResult> {
  try {
    const db = await getDb();
    const result = await fn(db);
    await db.persist();
    revalidatePath("/payments");
    if (afterCommit) await afterCommit(db, result);
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
  return toResult(
    (db) => db.createPaymentRequest({ actorId: user.id, via: "web" }, { ...input, dueAt }),
    // 등록 성공 직후 active 관리자(등록자 제외) 개인 DM. 훅은 절대 throw하지 않는다.
    (db, payment) => notifyPaymentCreated(db, payment.id),
  );
}

// 결제 요청 내역 수정 — 등록자 또는 관리자, 대기 상태 한정(최종 강제는 core updatePaymentRequest).
// 상태(status) 변경은 별도 updatePaymentStatusAction 소관이라 여기서 다루지 않는다.
// 옵셔널 클리어: recipientName·description은 빈 문자열("")로 넘기면 필드 제거된다.
// dueDate: 값이 있으면 YYYY-MM-DD, 빈 문자열("")이면 마감일 제거, undefined면 미변경.
export async function updatePaymentRequestAction(input: {
  paymentId: string;
  title?: string;
  recipientName?: string;
  bankName?: string;
  accountNumber?: string;
  amount?: number;
  description?: string;
  dueDate?: string; // YYYY-MM-DD | "" (제거) | undefined (미변경)
  category?: string;
}): Promise<ActionResult> {
  const { dueDate, ...rest } = input;
  let dueAt: string | undefined;
  if (dueDate !== undefined) {
    if (dueDate === "") {
      dueAt = ""; // 빈 문자열 → core에서 마감일 제거
    } else {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(dueDate)) {
        return { ok: false, error: "유효하지 않은 마감일이다 (YYYY-MM-DD)" };
      }
      const parsed = new Date(`${dueDate}T17:00:00`);
      if (Number.isNaN(parsed.getTime())) return { ok: false, error: "유효하지 않은 마감일이다" };
      dueAt = parsed.toISOString();
    }
  }

  const user = await getCurrentUser();
  return toResult((db) =>
    db.updatePaymentRequest(
      { actorId: user.id, via: "web" },
      { ...rest, ...(dueDate !== undefined ? { dueAt } : {}) },
    ),
  );
}

export async function updatePaymentStatusAction(input: {
  paymentId: string;
  to: PaymentStatus;
}): Promise<ActionResult> {
  const user = await getCurrentUser();
  return toResult(
    (db) => db.updatePaymentStatus({ actorId: user.id, via: "web" }, input),
    // 완료(done) 전환에 한해 등록자에게 개인 DM. 훅은 절대 throw하지 않는다.
    (db, payment) =>
      input.to === "done" ? notifyPaymentDone(db, payment.id) : Promise.resolve(),
  );
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
