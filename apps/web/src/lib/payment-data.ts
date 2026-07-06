import type { PaymentCategory, PaymentStatus, User } from "@que/core";
import { getDb } from "./db";

// 결제 화면 데이터. 계좌번호와 금액은 민감 정보 — 관리자와 요청자 본인에게만
// 원본을 보여주고 그 외에는 마스킹한다 (기획서 "결제/입금 확인" 운영 규칙).

export interface PaymentRow {
  id: string;
  title: string;
  requesterName: string;
  /** 입금받을 곳 (상호/사람/기관명). 미입력 시 undefined */
  recipientName?: string;
  bankName: string;
  /** 마스킹 적용된 표시용 계좌번호 */
  accountDisplay: string;
  /** 복사용 원본 계좌번호 — 인가된 뷰어(관리자·요청자 본인)에게만 채워진다 */
  accountNumberForCopy?: string;
  /** 마스킹 적용된 표시용 금액 (null이면 비공개) */
  amountDisplay: string | null;
  /** 복사용 원본 금액(원 단위 숫자) — 인가된 뷰어에게만 채워진다 */
  amountForCopy?: number;
  category: string;
  description?: string;
  dueAt?: string;
  status: PaymentStatus;
  overdue: boolean;
  dueSoon: boolean;
  /** 현재 사용자가 이 요청의 상태를 바꿀 수 있는가 (관리자=전체, 요청자=취소만) */
  canComplete: boolean;
  canCancel: boolean;
}

export interface PaymentData {
  rows: PaymentRow[];
  summary: { waiting: number; done: number; cancelled: number; overdue: number };
}

/** 결제 폼 select용 — 활성(active) 분류만 표시 순서(sortOrder)대로. 이름 문자열을 폼이 category로 쓴다. */
export async function getPaymentCategories(): Promise<PaymentCategory[]> {
  const db = await getDb();
  return [...db.paymentCategories]
    .filter((c) => c.status === "active")
    .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name));
}

/** 관리 화면용 — 보관(archived) 포함 전체를 표시 순서대로. 관리자 전용 화면에서만 쓴다. */
export async function getAllPaymentCategories(): Promise<PaymentCategory[]> {
  const db = await getDb();
  return [...db.paymentCategories].sort(
    (a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name),
  );
}

function maskAccount(accountNumber: string): string {
  const digits = accountNumber.replace(/\D/g, "");
  return `•••• ${digits.slice(-4)}`;
}

export async function getPaymentData(viewer: User, now: Date = new Date()): Promise<PaymentData> {
  const db = await getDb();
  const userById = new Map(db.users.map((u) => [u.id, u]));
  const soonLimit = new Date(now.getTime() + 24 * 60 * 60 * 1000);

  const rows: PaymentRow[] = [...db.paymentRequests]
    .sort((a, b) => {
      // 마감 초과 대기 → 대기 → 나머지 순 (기획: 마감 지난 대기 항목 상단 노출)
      const rank = (p: (typeof db.paymentRequests)[number]) => {
        const isOverdue = p.status === "waiting" && p.dueAt && new Date(p.dueAt) < now;
        if (isOverdue) return 0;
        if (p.status === "waiting") return 1;
        return 2;
      };
      return rank(a) - rank(b) || b.createdAt.localeCompare(a.createdAt);
    })
    .map((payment) => {
      const canSee = viewer.role === "admin" || payment.requesterId === viewer.id;
      const overdue =
        payment.status === "waiting" && !!payment.dueAt && new Date(payment.dueAt) < now;
      return {
        id: payment.id,
        title: payment.title,
        requesterName: userById.get(payment.requesterId)?.name ?? payment.requesterId,
        recipientName: payment.recipientName,
        bankName: payment.bankName,
        accountDisplay: canSee ? payment.accountNumber : maskAccount(payment.accountNumber),
        // 복사용 원본 값은 인가된 뷰어에게만 제공한다 (비인가 뷰어에겐 undefined → 복사 불가).
        accountNumberForCopy: canSee ? payment.accountNumber : undefined,
        amountDisplay: canSee ? `${payment.amount.toLocaleString()}원` : null,
        amountForCopy: canSee ? payment.amount : undefined,
        category: payment.category,
        description: payment.description,
        dueAt: payment.dueAt,
        status: payment.status,
        overdue,
        dueSoon:
          payment.status === "waiting" &&
          !overdue &&
          !!payment.dueAt &&
          new Date(payment.dueAt) <= soonLimit,
        canComplete: viewer.role === "admin",
        canCancel: viewer.role === "admin" || payment.requesterId === viewer.id,
      };
    });

  return {
    rows,
    summary: {
      waiting: db.paymentRequests.filter((p) => p.status === "waiting").length,
      done: db.paymentRequests.filter((p) => p.status === "done").length,
      cancelled: db.paymentRequests.filter((p) => p.status === "cancelled").length,
      overdue: rows.filter((r) => r.overdue).length,
    },
  };
}
