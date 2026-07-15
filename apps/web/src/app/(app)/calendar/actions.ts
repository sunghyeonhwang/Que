"use server";

import { revalidatePath } from "next/cache";
import { isQueRuleError, QueRuleError } from "@que/core";
import { getDb } from "@/lib/db";
import { getCurrentUser } from "@/lib/current-user";
import type { ActionResult } from "@/app/(app)/today/actions";

type Db = Awaited<ReturnType<typeof getDb>>;

// mutation과 persist를 반드시 같은 db 인스턴스에서 (글래도스 반려 회귀 — cache 정체성 의존 금지).
// 사전 읽기(작업/일정/마일스톤 조회)도 콜백 안에서 같은 db로 처리한다.
async function toResult(fn: (db: Db) => Promise<unknown> | unknown): Promise<ActionResult> {
  try {
    const db = await getDb();
    await fn(db);
    await db.persist();
    revalidatePath("/calendar");
    revalidatePath("/schedule");
    revalidatePath("/today");
    return { ok: true };
  } catch (error) {
    if (isQueRuleError(error)) return { ok: false, error: error.message };
    throw error;
  }
}

interface ParsedDate {
  y: number;
  m: number;
  d: number;
}

/** 서버 액션은 노출된 엔드포인트다 — UI를 신뢰하지 않고 날짜/시간을 직접 검증한다. */
function parseDateInput(value: string): ParsedDate | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const [y, m, d] = value.split("-").map(Number);
  const probe = new Date(y, m - 1, d);
  if (probe.getFullYear() !== y || probe.getMonth() !== m - 1 || probe.getDate() !== d) {
    return null;
  }
  return { y, m, d };
}

function parseHourInput(value: number | undefined): number | undefined | null {
  if (value === undefined) return undefined;
  if (!Number.isInteger(value) || value < 0 || value > 23) return null;
  return value;
}

const INVALID_DATE: ActionResult = { ok: false, error: "유효하지 않은 날짜 형식이다 (YYYY-MM-DD)" };
const INVALID_HOUR: ActionResult = { ok: false, error: "유효하지 않은 시간이다 (0~23)" };

/** 작업을 다른 날짜(선택적으로 시간)로 이동. 기존 지속 시간을 유지한다. */
export async function moveTaskToDateAction(input: {
  taskId: string;
  date: string; // YYYY-MM-DD
  hour?: number;
}): Promise<ActionResult> {
  const parsedDate = parseDateInput(input.date);
  if (!parsedDate) return INVALID_DATE;
  const parsedHour = parseHourInput(input.hour);
  if (parsedHour === null) return INVALID_HOUR;

  const user = await getCurrentUser();
  return toResult((db) => {
    const task = db.tasks.find((t) => t.id === input.taskId);
    if (!task) throw new QueRuleError("NOT_FOUND", `작업 없음: ${input.taskId}`);

    const prevStart = task.startAt ? new Date(task.startAt) : new Date();
    const durationMs =
      task.endAt && task.startAt
        ? new Date(task.endAt).getTime() - new Date(task.startAt).getTime()
        : 60 * 60 * 1000;

    const nextStart = new Date(prevStart);
    nextStart.setFullYear(parsedDate.y, parsedDate.m - 1, parsedDate.d);
    if (parsedHour !== undefined) nextStart.setHours(parsedHour, 0, 0, 0);
    const nextEnd = new Date(nextStart.getTime() + durationMs);

    db.moveTask(
      { actorId: user.id, via: "web" },
      { taskId: input.taskId, startAt: nextStart.toISOString(), endAt: nextEnd.toISOString() },
    );
  });
}

/** Que 일정을 다른 날짜/시간으로 이동. */
export async function moveEventToDateAction(input: {
  eventId: string;
  date: string;
  hour?: number;
}): Promise<ActionResult> {
  const parsedDate = parseDateInput(input.date);
  if (!parsedDate) return INVALID_DATE;
  const parsedHour = parseHourInput(input.hour);
  if (parsedHour === null) return INVALID_HOUR;

  const user = await getCurrentUser();
  return toResult((db) => {
    const event = db.calendarEvents.find((e) => e.id === input.eventId);
    if (!event) throw new QueRuleError("NOT_FOUND", `일정 없음: ${input.eventId}`);

    const prevStart = new Date(event.startAt);
    const durationMs = new Date(event.endAt).getTime() - prevStart.getTime();
    const nextStart = new Date(prevStart);
    nextStart.setFullYear(parsedDate.y, parsedDate.m - 1, parsedDate.d);
    if (parsedHour !== undefined) nextStart.setHours(parsedHour, 0, 0, 0);

    db.moveCalendarEvent(
      { actorId: user.id, via: "web" },
      {
        eventId: input.eventId,
        startAt: nextStart.toISOString(),
        endAt: new Date(nextStart.getTime() + durationMs).toISOString(),
      },
    );
  });
}

/** Que 일정 시작·종료를 직접 지정(팝오버 일시 수정 — 드래그의 date+hour와 달리 종료 시각까지 설정).
 *  드래그와 **같은 core mutation(db.moveCalendarEvent)**을 재사용한다(중복 mutation 없음).
 *  권한(que 소스·이동 가능 여부)은 core가 최종 강제한다 — UI는 movable로 진입만 게이트한다. */
export async function updateEventScheduleAction(input: {
  eventId: string;
  startAt: string;
  endAt: string;
}): Promise<ActionResult> {
  if (Number.isNaN(Date.parse(input.startAt)) || Number.isNaN(Date.parse(input.endAt))) {
    return { ok: false, error: "유효하지 않은 일시다." };
  }
  const user = await getCurrentUser();
  return toResult((db) => {
    const event = db.calendarEvents.find((e) => e.id === input.eventId);
    if (!event) throw new QueRuleError("NOT_FOUND", `일정 없음: ${input.eventId}`);
    db.moveCalendarEvent(
      { actorId: user.id, via: "web" },
      { eventId: input.eventId, startAt: input.startAt, endAt: input.endAt },
    );
  });
}

/** 마일스톤 마감일 이동 (시간은 유지). */
export async function moveMilestoneToDateAction(input: {
  milestoneId: string;
  date: string;
}): Promise<ActionResult> {
  const parsedDate = parseDateInput(input.date);
  if (!parsedDate) return INVALID_DATE;

  const user = await getCurrentUser();
  return toResult((db) => {
    const milestone = db.milestones.find((m) => m.id === input.milestoneId);
    if (!milestone) throw new QueRuleError("NOT_FOUND", `마일스톤 없음: ${input.milestoneId}`);

    const prev = new Date(milestone.dueAt);
    const next = new Date(prev);
    next.setFullYear(parsedDate.y, parsedDate.m - 1, parsedDate.d);

    db.moveMilestone(
      { actorId: user.id, via: "web" },
      { milestoneId: input.milestoneId, dueAt: next.toISOString() },
    );
  });
}
