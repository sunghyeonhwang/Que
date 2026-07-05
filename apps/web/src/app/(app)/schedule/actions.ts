"use server";

import { revalidatePath } from "next/cache";
import { isQueRuleError, type CalendarEvent, type Task } from "@que/core";
import { getDb } from "@/lib/db";
import { getCurrentUser } from "@/lib/current-user";
import type { ActionResult } from "@/app/(app)/today/actions";

type Db = Awaited<ReturnType<typeof getDb>>;

// 일정(/schedule) "새로 추가" 하이브리드: 작업은 createTask, 미팅은 createCalendarEvent.
// mutation·persist·revalidate를 한 db 인스턴스에서 처리한다(글래도스 반려 회귀 — 캐시 정체성 의존 금지).
// 같은 일정 데이터(getCalendarData)를 소비하는 /schedule·/today·/team을 함께 무효화한다.
async function toResult(fn: (db: Db) => Promise<unknown> | unknown): Promise<ActionResult> {
  try {
    const db = await getDb();
    await fn(db);
    await db.persist();
    revalidatePath("/schedule");
    revalidatePath("/today");
    revalidatePath("/team");
    return { ok: true };
  } catch (error) {
    if (isQueRuleError(error)) return { ok: false, error: error.message };
    throw error;
  }
}

/**
 * 일정 화면에서 작업 추가. today의 createTaskAction과 달리 source는 "manual"이고
 * 프로젝트·우선순위·설명·시각을 함께 받는다. 담당자 미지정 시 core가 본인 작업으로 만든다.
 */
export async function createScheduleTaskAction(input: {
  title: string;
  assigneeId?: string;
  projectId?: string;
  priority?: Task["priority"];
  startAt?: string;
  endAt?: string;
  description?: string;
}): Promise<ActionResult> {
  const user = await getCurrentUser();
  return toResult((db) =>
    db.createTask({ actorId: user.id, via: "web" }, { ...input, source: "manual" }),
  );
}

/**
 * 일정 화면에서 미팅(캘린더 일정) 추가. source·ownerId는 core가 서버 고정하므로 여기서 넘기지 않는다
 * (외부 회사 일정·타인 소유 위조 차단). 참석자 실재·시각·공개 범위 검증은 core가 강제한다.
 */
export async function createCalendarEventAction(input: {
  title: string;
  startAt: string;
  endAt: string;
  attendeeIds?: string[];
  visibility?: CalendarEvent["visibility"];
}): Promise<ActionResult> {
  const user = await getCurrentUser();
  return toResult((db) => db.createCalendarEvent({ actorId: user.id, via: "web" }, input));
}
