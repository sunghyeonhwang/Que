"use server";

import { revalidatePath } from "next/cache";
import { isQueRuleError } from "@que/core";
import { getDb } from "@/lib/db";
import { getCurrentUser } from "@/lib/current-user";
import type { ActionResult } from "@/app/(app)/today/actions";

function toResult(fn: () => void): ActionResult {
  try {
    fn();
    revalidatePath("/calendar");
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
  const db = getDb();
  const task = db.tasks.find((t) => t.id === input.taskId);
  if (!task) return { ok: false, error: `작업 없음: ${input.taskId}` };

  const prevStart = task.startAt ? new Date(task.startAt) : new Date();
  const durationMs =
    task.endAt && task.startAt
      ? new Date(task.endAt).getTime() - new Date(task.startAt).getTime()
      : 60 * 60 * 1000;

  const nextStart = new Date(prevStart);
  nextStart.setFullYear(parsedDate.y, parsedDate.m - 1, parsedDate.d);
  if (parsedHour !== undefined) nextStart.setHours(parsedHour, 0, 0, 0);
  const nextEnd = new Date(nextStart.getTime() + durationMs);

  return toResult(() =>
    db.moveTask(
      { actorId: user.id, via: "web" },
      {
        taskId: input.taskId,
        startAt: nextStart.toISOString(),
        endAt: nextEnd.toISOString(),
      },
    ),
  );
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
  const db = getDb();
  const event = db.calendarEvents.find((e) => e.id === input.eventId);
  if (!event) return { ok: false, error: `일정 없음: ${input.eventId}` };

  const prevStart = new Date(event.startAt);
  const durationMs = new Date(event.endAt).getTime() - prevStart.getTime();
  const nextStart = new Date(prevStart);
  nextStart.setFullYear(parsedDate.y, parsedDate.m - 1, parsedDate.d);
  if (parsedHour !== undefined) nextStart.setHours(parsedHour, 0, 0, 0);

  return toResult(() =>
    db.moveCalendarEvent(
      { actorId: user.id, via: "web" },
      {
        eventId: input.eventId,
        startAt: nextStart.toISOString(),
        endAt: new Date(nextStart.getTime() + durationMs).toISOString(),
      },
    ),
  );
}

/** 마일스톤 마감일 이동 (시간은 유지). */
export async function moveMilestoneToDateAction(input: {
  milestoneId: string;
  date: string;
}): Promise<ActionResult> {
  const parsedDate = parseDateInput(input.date);
  if (!parsedDate) return INVALID_DATE;

  const user = await getCurrentUser();
  const db = getDb();
  const milestone = db.milestones.find((m) => m.id === input.milestoneId);
  if (!milestone) return { ok: false, error: `마일스톤 없음: ${input.milestoneId}` };

  const prev = new Date(milestone.dueAt);
  const next = new Date(prev);
  next.setFullYear(parsedDate.y, parsedDate.m - 1, parsedDate.d);

  return toResult(() =>
    db.moveMilestone(
      { actorId: user.id, via: "web" },
      { milestoneId: input.milestoneId, dueAt: next.toISOString() },
    ),
  );
}
