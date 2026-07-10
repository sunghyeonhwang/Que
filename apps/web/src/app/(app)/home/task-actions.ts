"use server";

import { revalidatePath } from "next/cache";
import { isQueRuleError } from "@que/core";
import { getDb } from "@/lib/db";
import { getCurrentUser } from "@/lib/current-user";
import type { ActionResult } from "@/app/(app)/today/actions";

// 홈 '오늘 할 일' 완료 토글 — core changeTaskStatus 경유(ChangeLog via:"web"). 권한은 core가 강제한다
// (본인 작업만). projects의 toggleTaskDoneAction과 로직은 같으나 revalidate 대상이 /home이라 별도 래퍼로
// 둔다(홈에서 완료 처리 후 홈 데이터가 갱신되게).

/** 홈 오늘 할 일 완료/해제. done=true → done, false → in_progress. */
export async function toggleHomeTaskDoneAction(input: {
  taskId: string;
  done: boolean;
}): Promise<ActionResult> {
  const user = await getCurrentUser();
  try {
    const db = await getDb();
    db.changeTaskStatus(
      { actorId: user.id, via: "web" },
      { taskId: input.taskId, to: input.done ? "done" : "in_progress" },
    );
    await db.persist();
    revalidatePath("/home");
    return { ok: true };
  } catch (error) {
    if (isQueRuleError(error)) return { ok: false, error: error.message };
    throw error; // NEXT_REDIRECT · 예상 밖 예외는 삼키지 않는다
  }
}
