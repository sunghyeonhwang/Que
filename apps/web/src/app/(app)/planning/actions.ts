"use server";

import { revalidatePath } from "next/cache";
import { format } from "date-fns";
import {
  canManageMilestone,
  isQueRuleError,
  type Milestone,
  type RetroCause,
  type RetroCauseDetail,
} from "@que/core";
import { getDb } from "@/lib/db";
import { getCurrentUser } from "@/lib/current-user";
import { webhookEnabled } from "@/lib/notifications/config";
import { postToSlack } from "@/lib/notifications/slack";
import type { ActionResult } from "@/app/(app)/today/actions";

type Db = Awaited<ReturnType<typeof getDb>>;

// mutation과 persist는 반드시 같은 db 인스턴스에서(cache 정체성 의존 금지 — projects/actions와 동일 패턴).
async function toResult(
  fn: (db: Db) => Promise<unknown> | unknown,
  afterCommit?: (db: Db) => Promise<void>,
): Promise<ActionResult> {
  try {
    const db = await getDb();
    await fn(db);
    await db.persist();
    revalidatePath("/planning");
    // 커밋 성공 직후 훅(있으면). throw하지 않는 훅만 전달한다(today/actions 계약과 동일).
    if (afterCommit) await afterCommit(db);
    return { ok: true };
  } catch (error) {
    if (isQueRuleError(error)) return { ok: false, error: error.message };
    throw error;
  }
}

export async function createMilestoneAction(input: {
  projectId: string;
  title: string;
  dueAt: string;
}): Promise<ActionResult> {
  const user = await getCurrentUser();
  return toResult((db) => db.createMilestone({ actorId: user.id, via: "web" }, input));
}

export async function updateMilestoneAction(input: {
  milestoneId: string;
  title?: string;
  dueAt?: string;
  riskStatus?: Milestone["riskStatus"];
}): Promise<ActionResult> {
  const user = await getCurrentUser();
  return toResult((db) => db.updateMilestone({ actorId: user.id, via: "web" }, input));
}

/**
 * 마일스톤 회고 남기기(OS-2a 실패 분류, 부록 B). 담당·admin만(core canManageMilestone 강제).
 * 회고=기록 그 자체라 ChangeLog는 남기지 않는다. 확인 카드(원인 2택 → 세부 유형 → 한 줄) 종결 경로.
 */
export async function createMilestoneRetroAction(input: {
  milestoneId: string;
  cause: RetroCause;
  causeDetail: RetroCauseDetail;
  note?: string;
  managed?: boolean;
}): Promise<ActionResult> {
  const user = await getCurrentUser();
  return toResult((db) => db.createMilestoneRetro({ actorId: user.id, via: "web" }, input));
}

/**
 * 마일스톤 안건 결정(기획 §1-c 원격 진행 · §1-e 긴급 결정의 웹 결정 경로).
 * - keep(기한 유지): 변경 없음. 권한만 확인하고 종결(위험 상태 확인 성격).
 * - defer(기한 연기): newDueAt 필수 → updateMilestone(dueAt) 재사용.
 * - hold(보류): 사유 필수 → riskStatus를 '주의(at_risk)'로 변경(updateMilestone 재사용).
 * 권한은 core canManageMilestone/updateMilestone이 강제(담당자·관리자). 신규 실행 경로를 만들지 않는다.
 */
export async function resolveMilestoneAgendaAction(input: {
  milestoneId: string;
  decision: "keep" | "defer" | "hold";
  newDueAt?: string;
  reason?: string;
}): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (input.decision === "defer" && !input.newDueAt) {
    return { ok: false, error: "기한 연기는 새 마감일이 필요합니다." };
  }
  if (input.decision === "hold" && !input.reason?.trim()) {
    return { ok: false, error: "보류는 사유가 필요합니다." };
  }
  return toResult((db) => {
    const milestone = db.milestones.find((m) => m.id === input.milestoneId);
    if (!milestone) {
      // core mutation과 동일한 오류 계약을 따르도록 rule error를 던진다.
      return db.updateMilestone({ actorId: user.id, via: "web" }, { milestoneId: input.milestoneId });
    }
    if (input.decision === "keep") {
      // 변경 없음 — 권한만 확인하고 종결(위험 상태 확인). 클라이언트를 신뢰하지 않는다.
      const project = db.projects.find((p) => p.id === milestone.projectId);
      if (!canManageMilestone(db.requireUser(user.id), project)) {
        return db.updateMilestone({ actorId: user.id, via: "web" }, { milestoneId: input.milestoneId });
      }
      return milestone;
    }
    if (input.decision === "defer") {
      return db.updateMilestone(
        { actorId: user.id, via: "web" },
        { milestoneId: input.milestoneId, dueAt: input.newDueAt },
      );
    }
    // hold — 위험 상태를 '주의'로 올리고 사유를 ChangeLog에 남긴다(사유는 남기는 것 — 게이트 M1).
    return db.updateMilestone(
      { actorId: user.id, via: "web" },
      { milestoneId: input.milestoneId, riskStatus: "at_risk", reason: input.reason },
    );
  }, async (db) => {
    // 커밋 성공 직후 팀채널에 결정 공유(§1-e — "결정 내역 팀채널 공유"). 실패해도 결정을 되돌리지 않는다.
    await shareMilestoneDecision(db, input, user.id);
  });
}

/** 결정 공유(팀채널 웹훅) — throw 금지 훅. 웹훅 미설정이면 조용히 스킵(1회성 공유라 dedup 불요). */
async function shareMilestoneDecision(
  db: Awaited<ReturnType<typeof getDb>>,
  input: { milestoneId: string; decision: "keep" | "defer" | "hold"; newDueAt?: string; reason?: string },
  actorId: string,
): Promise<void> {
  try {
    if (!webhookEnabled()) return;
    const milestone = db.milestones.find((m) => m.id === input.milestoneId);
    if (!milestone) return;
    const actorName = db.users.find((u) => u.id === actorId)?.name ?? actorId;
    const label =
      input.decision === "keep"
        ? "기한 유지"
        : input.decision === "defer"
          ? `기한 연기 → ${input.newDueAt ? format(new Date(input.newDueAt), "M/d HH:mm") : ""}`
          : `보류(주의) — ${input.reason?.trim() ?? ""}`;
    await postToSlack({
      text: `*마일스톤 결정: ${milestone.title}* — ${label} · 결정 ${actorName}`,
      deeplinkPath: "/gantt",
      tone: input.decision === "hold" ? "amber" : "blue",
    });
  } catch {
    // 공유 실패는 결정에 영향 없음 — 조용히 무시.
  }
}
