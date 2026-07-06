"use server";

import { revalidatePath } from "next/cache";
import { isQueRuleError, type RevisionNoteStatus } from "@que/core";
import { getDb } from "@/lib/db";
import { getCurrentUser } from "@/lib/current-user";
import type { ActionResult } from "@/app/(app)/today/actions";

type Db = Awaited<ReturnType<typeof getDb>>;

// 수정사항(이슈/피드백) 트래커 서버 액션 — 전원 접근(관리자 전용 아님).
// 팀 공용이라 소유자 제한이 없다: 누구나 작성·상태 변경이 가능하다(인증만 core mutation이 강제).
// mutation과 persist는 반드시 같은 db 인스턴스에서(clients/planning actions와 동일 패턴).
async function toResult(fn: (db: Db) => Promise<unknown> | unknown): Promise<ActionResult> {
  try {
    const db = await getDb();
    await fn(db);
    await db.persist();
    revalidatePath("/revisions");
    return { ok: true };
  } catch (error) {
    if (isQueRuleError(error)) return { ok: false, error: error.message };
    throw error;
  }
}

export async function createRevisionNoteAction(input: {
  menu: string;
  location?: string;
  description: string;
  status?: RevisionNoteStatus;
}): Promise<ActionResult> {
  const user = await getCurrentUser();
  return toResult((db) => db.createRevisionNote({ actorId: user.id, via: "web" }, input));
}

export async function updateRevisionStatusAction(input: {
  id: string;
  status: RevisionNoteStatus;
}): Promise<ActionResult> {
  const user = await getCurrentUser();
  return toResult((db) => db.updateRevisionNoteStatus({ actorId: user.id, via: "web" }, input));
}
