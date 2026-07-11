"use server";

import { revalidatePath } from "next/cache";
import { isQueRuleError } from "@que/core";
import type {
  KeyResultMetricType,
  KeyResultStatus,
  ObjectiveStatus,
  StateCheckInput,
} from "@que/core";
import { getDb } from "@/lib/db";
import { getCurrentUser } from "@/lib/current-user";

// OKR 서버 액션(기획 §6). 3중 방어의 중간 층 — 여기서 admin/owner를 먼저 판정하고,
// core mutation이 최종 강제한다(UI 숨김은 다음 에이전트 몫). 변경은 persist 후 /daily 재검증.
// via=web으로 ChangeLog에 기록된다(목표 데이터=감사 대상).

export type ActionResult = { ok: true } | { ok: false; error: string };

type Db = Awaited<ReturnType<typeof getDb>>;

/** db 인스턴스를 한 번 획득해 mutation과 persist를 같은 인스턴스에서 수행한다(actions.ts 계약과 동일). */
async function toResult<T>(fn: (db: Db) => Promise<T> | T): Promise<ActionResult> {
  try {
    const db = await getDb();
    await fn(db);
    await db.persist();
    revalidatePath("/daily");
    return { ok: true };
  } catch (error) {
    if (isQueRuleError(error)) return { ok: false, error: error.message };
    throw error;
  }
}

/** 분기 목표 생성 — admin만(서버 판정 + core 강제). */
export async function createObjectiveAction(input: {
  title: string;
  description?: string;
  period: string;
  ownerId: string;
  status?: ObjectiveStatus;
  order?: number;
}): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (user.role !== "admin") {
    return { ok: false, error: "분기 목표는 관리자만 만들 수 있습니다." };
  }
  return toResult((db) => db.createObjective({ actorId: user.id, via: "web" }, input));
}

/** 분기 목표 수정 — admin만(title/description/status/order). */
export async function updateObjectiveAction(input: {
  objectiveId: string;
  title?: string;
  description?: string | null;
  status?: ObjectiveStatus;
  order?: number;
}): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (user.role !== "admin") {
    return { ok: false, error: "분기 목표는 관리자만 수정할 수 있습니다." };
  }
  return toResult((db) => db.updateObjective({ actorId: user.id, via: "web" }, input));
}

/** 핵심결과(KR) 생성 — admin 또는 해당 Objective 소유자. */
export async function createKeyResultAction(input: {
  objectiveId: string;
  title: string;
  ownerId: string;
  month: string;
  metricType: KeyResultMetricType;
  targetValue?: number;
  currentValue?: number;
  unit?: string;
  stateChecks?: StateCheckInput[];
  status?: KeyResultStatus;
}): Promise<ActionResult> {
  const user = await getCurrentUser();
  const db = await getDb();
  const objective = db.objectives.find((o) => o.id === input.objectiveId);
  if (!objective) return { ok: false, error: "목표를 찾을 수 없습니다." };
  if (user.role !== "admin" && objective.ownerId !== user.id) {
    return { ok: false, error: "핵심결과는 관리자 또는 목표 소유자만 만들 수 있습니다." };
  }
  return toResult((d) => d.createKeyResult({ actorId: user.id, via: "web" }, input));
}

/** 핵심결과(KR) 수정 — admin 또는 해당 Objective 소유자(제목·월·측정방식·목표치·단위·상태·소유자). */
export async function updateKeyResultAction(input: {
  keyResultId: string;
  title?: string;
  month?: string;
  metricType?: KeyResultMetricType;
  targetValue?: number | null;
  unit?: string | null;
  stateChecks?: StateCheckInput[];
  status?: KeyResultStatus;
  ownerId?: string;
}): Promise<ActionResult> {
  const user = await getCurrentUser();
  const db = await getDb();
  const kr = db.keyResults.find((k) => k.id === input.keyResultId);
  if (!kr) return { ok: false, error: "핵심결과를 찾을 수 없습니다." };
  const objective = db.objectives.find((o) => o.id === kr.objectiveId);
  if (user.role !== "admin" && objective?.ownerId !== user.id) {
    return { ok: false, error: "핵심결과는 관리자 또는 목표 소유자만 수정할 수 있습니다." };
  }
  return toResult((d) => d.updateKeyResult({ actorId: user.id, via: "web" }, input));
}

/** KR 진척(currentValue) 입력 — KR 소유자 본인 또는 admin(manual KR만). */
export async function updateKeyResultProgressAction(input: {
  keyResultId: string;
  currentValue: number;
}): Promise<ActionResult> {
  const user = await getCurrentUser();
  const db = await getDb();
  const kr = db.keyResults.find((k) => k.id === input.keyResultId);
  if (!kr) return { ok: false, error: "핵심결과를 찾을 수 없습니다." };
  if (user.role !== "admin" && kr.ownerId !== user.id) {
    return { ok: false, error: "핵심결과 진척은 소유자 본인 또는 관리자만 입력할 수 있습니다." };
  }
  return toResult((d) =>
    d.updateKeyResultProgress({ actorId: user.id, via: "web" }, input),
  );
}

/** 상태형 KR(OS-1) 체크 항목 토글 — KR 소유자 본인 또는 admin. requiresAdminConfirm 항목은
 *  admin만(core가 최종 강제). done/해제 시 doneAt·confirmedBy 기록·정리. */
export async function toggleKeyResultCheckAction(input: {
  keyResultId: string;
  checkId: string;
  done: boolean;
}): Promise<ActionResult> {
  const user = await getCurrentUser();
  const db = await getDb();
  const kr = db.keyResults.find((k) => k.id === input.keyResultId);
  if (!kr) return { ok: false, error: "핵심결과를 찾을 수 없습니다." };
  if (user.role !== "admin" && kr.ownerId !== user.id) {
    return { ok: false, error: "상태 체크는 소유자 본인 또는 관리자만 토글할 수 있습니다." };
  }
  return toResult((d) =>
    d.toggleKeyResultCheck({ actorId: user.id, via: "web" }, input),
  );
}

/** Task ↔ KR 연결/해제 — 본인 작업만(core canEditTask 강제). keyResultId=null이면 해제. */
export async function linkTaskToKeyResultAction(input: {
  taskId: string;
  keyResultId: string | null;
}): Promise<ActionResult> {
  const user = await getCurrentUser();
  return toResult((db) =>
    db.updateTaskDetails(
      { actorId: user.id, via: "web" },
      { taskId: input.taskId, keyResultId: input.keyResultId },
    ),
  );
}
