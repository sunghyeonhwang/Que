"use server";

import { revalidatePath } from "next/cache";
import { isQueRuleError, type Client, type Project } from "@que/core";
import { getDb } from "@/lib/db";
import { getCurrentUser } from "@/lib/current-user";
import type { ActionResult } from "@/app/(app)/today/actions";

type Db = Awaited<ReturnType<typeof getDb>>;

// 클라이언트·프로젝트 관리(관리자 전용) 서버 액션.
// 권한 최종 강제는 core mutation(canManageClient/canManageProject)이지만, 관리자만 여기 도달하도록
// 각 액션이 getCurrentUser로 actor를 확정하고, 페이지도 비관리자를 리다이렉트한다(3중 게이트).
// mutation과 persist는 반드시 같은 db 인스턴스에서(planning/projects actions와 동일 패턴).
async function toResult(fn: (db: Db) => Promise<unknown> | unknown): Promise<ActionResult> {
  try {
    const db = await getDb();
    await fn(db);
    await db.persist();
    revalidatePath("/clients");
    // 상단 클라이언트 스위처는 (app) layout에서 렌더된다. layout은 soft navigation 간
    // 재실행되지 않으므로, 클라이언트 추가/변경이 즉시 스위처에 반영되도록 layout을 갱신한다.
    revalidatePath("/", "layout");
    return { ok: true };
  } catch (error) {
    if (isQueRuleError(error)) return { ok: false, error: error.message };
    throw error;
  }
}

export async function createClientAction(input: { name: string }): Promise<ActionResult> {
  const user = await getCurrentUser();
  return toResult((db) => db.createClient({ actorId: user.id, via: "web" }, input));
}

export async function updateClientAction(input: {
  clientId: string;
  name?: string;
  status?: Client["status"];
}): Promise<ActionResult> {
  const user = await getCurrentUser();
  return toResult((db) => db.updateClient({ actorId: user.id, via: "web" }, input));
}

export async function reorderClientsAction(input: {
  orderedIds: string[];
}): Promise<ActionResult> {
  const user = await getCurrentUser();
  return toResult((db) => db.reorderClients({ actorId: user.id, via: "web" }, input));
}

export async function createProjectAction(input: {
  name: string;
  clientId?: string;
  ownerId?: string;
}): Promise<ActionResult> {
  const user = await getCurrentUser();
  return toResult((db) => db.createProject({ actorId: user.id, via: "web" }, input));
}

export async function updateProjectAction(input: {
  projectId: string;
  name?: string;
  status?: Project["status"];
  clientId?: string | null;
  ownerId?: string;
}): Promise<ActionResult> {
  const user = await getCurrentUser();
  return toResult((db) => db.updateProject({ actorId: user.id, via: "web" }, input));
}
