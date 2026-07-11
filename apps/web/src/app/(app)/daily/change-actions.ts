"use server";

import { revalidatePath } from "next/cache";
import { isQueRuleError, type ChangeRequestStage } from "@que/core";
import { getDb } from "@/lib/db";
import { getCurrentUser } from "@/lib/current-user";

// OS-2b 외부 변경 접수(부록 C) 서버 액션. daily/actions.ts와 분리한 신규 파일.
// 3중 방어의 중간 층 — core mutation(canManageProject·순서 강제·admin 승인)이 최종 강제한다.
// 변경은 persist 후 /daily 재검증. via=web으로 ChangeLog에 기록(업무 영향 변경).

export type ActionResult = { ok: true } | { ok: false; error: string };

type Db = Awaited<ReturnType<typeof getDb>>;

/** 같은 db 인스턴스에서 mutation과 persist를 수행한다(actions.ts 계약과 동일). */
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

/** 외부 변경 접수 — 프로젝트 담당·admin(서버 판정 + core 강제). impactDeadline=접수+24h 자동. */
export async function createChangeRequestAction(input: {
  projectId: string;
  milestoneId?: string;
  title: string;
  description?: string;
}): Promise<ActionResult> {
  const user = await getCurrentUser();
  const db = await getDb();
  const project = db.projects.find((p) => p.id === input.projectId);
  if (!project) return { ok: false, error: "프로젝트를 찾을 수 없습니다." };
  if (user.role !== "admin" && project.ownerId !== user.id) {
    return { ok: false, error: "외부 변경 접수는 프로젝트 담당자 또는 관리자만 할 수 있습니다." };
  }
  return toResult((d) => d.createChangeRequest({ actorId: user.id, via: "web" }, input));
}

/** 변경 대응 단계 진행 — 순서 강제(건너뛰기 거부), approved는 admin만, closed 시 회고 자동 생성. */
export async function advanceChangeRequestStageAction(input: {
  changeRequestId: string;
  toStage: ChangeRequestStage;
}): Promise<ActionResult> {
  const user = await getCurrentUser();
  const db = await getDb();
  const cr = db.changeRequests.find((c) => c.id === input.changeRequestId);
  if (!cr) return { ok: false, error: "변경 요청을 찾을 수 없습니다." };
  const project = db.projects.find((p) => p.id === cr.projectId);
  if (user.role !== "admin" && project?.ownerId !== user.id) {
    return { ok: false, error: "변경 대응 진행은 프로젝트 담당자 또는 관리자만 할 수 있습니다." };
  }
  if (input.toStage === "approved" && user.role !== "admin") {
    return { ok: false, error: "승인 단계는 관리자만 진행할 수 있습니다." };
  }
  return toResult((d) =>
    d.advanceChangeRequestStage({ actorId: user.id, via: "web" }, input),
  );
}
