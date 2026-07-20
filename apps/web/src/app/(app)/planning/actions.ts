"use server";

import { revalidatePath } from "next/cache";
import { format } from "date-fns";
import {
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
  /** 중요 마일스톤(최종 런칭일 등) — 붉은 그라데이션 표기. */
  critical?: boolean;
}): Promise<ActionResult> {
  const user = await getCurrentUser();
  return toResult((db) => db.createMilestone({ actorId: user.id, via: "web" }, input));
}

/**
 * 마일스톤 삭제 — 프로젝트 담당·admin만(core canManageMilestone 강제).
 * 회고·변경 접수 이력이 있으면 core가 거부하고 그 사유 문구가 그대로 토스트로 노출된다(이력 보존).
 */
export async function deleteMilestoneAction(input: {
  milestoneId: string;
}): Promise<ActionResult> {
  const user = await getCurrentUser();
  return toResult((db) => db.deleteMilestone({ actorId: user.id, via: "web" }, input));
}

export async function updateMilestoneAction(input: {
  milestoneId: string;
  title?: string;
  dueAt?: string;
  riskStatus?: Milestone["riskStatus"];
  /** 소속 프로젝트 변경 — core가 대상 프로젝트 실존·활성·양쪽 관리 권한을 강제한다. */
  projectId?: string;
  critical?: boolean;
  /** true면 기한 변경을 '결정(연기)'으로 기록한다(recordMilestoneDecision defer) — 간트 드래그 전용.
   *  결정 기록이 없으면 긴급 결정 카드가 드래그 조정을 인식하지 못해 당일 내내 잔존한다(글래도스 이월). */
  asDecision?: boolean;
}): Promise<{ ok: true; previousDueAt?: string } | { ok: false; error: string }> {
  const user = await getCurrentUser();
  // 변경 전 dueAt을 서버에서 떠서 반환한다 — 간트 드래그 토스트의 [실행 취소]가 이 값으로 복원한다.
  // 클라이언트 prop은 revalidate 경로에 따라 stale일 수 있어(연속 드래그) 이전 값의 권위는 서버다.
  let previousDueAt: string | undefined;
  const result = await toResult((db) => {
    previousDueAt = db.milestones.find((m) => m.id === input.milestoneId)?.dueAt;
    // asDecision은 dueAt만 바꾸는 드래그 경로에서만 유효 — 다른 필드가 섞이면 일반 수정으로 처리.
    if (
      input.asDecision &&
      input.dueAt &&
      input.title === undefined &&
      input.riskStatus === undefined &&
      input.critical === undefined &&
      input.projectId === undefined
    ) {
      return db.recordMilestoneDecision(
        { actorId: user.id, via: "web" },
        { milestoneId: input.milestoneId, decision: "defer", newDueAt: input.dueAt },
      );
    }
    return db.updateMilestone({ actorId: user.id, via: "web" }, input);
  });
  return result.ok ? { ok: true, previousDueAt } : result;
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
 * - keep(기한 유지): 데이터 무변경. 단 결정 사실(lastDecision*)+ChangeLog는 남는다.
 * - defer(기한 연기): newDueAt 필수 → dueAt 변경.
 * - hold(보류): 사유 필수 → riskStatus를 '주의(at_risk)'로 변경.
 * 세 경로 모두 core recordMilestoneDecision 하나로 처리(권한·필수값 core 강제 — 담당자·관리자).
 * 결정된 마일스톤은 당일 긴급 결정 카드·크라이시스 DM에서 빠진다(detectCrisisTriggers 억제).
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
  // datetime-local 값("YYYY-MM-DDTHH:mm", offset 없음)이 그대로 오면 core isoDateTime이
  // 거부한다("Invalid ISO datetime" — 2026-07-12 실사용 버그). 로컬 기준 ISO로 정규화.
  if (input.decision === "defer" && input.newDueAt && !/[Zz]|[+-]\d{2}:\d{2}$/.test(input.newDueAt)) {
    const parsed = new Date(input.newDueAt);
    if (Number.isNaN(parsed.getTime())) {
      return { ok: false, error: "새 마감일 형식이 올바르지 않습니다." };
    }
    input = { ...input, newDueAt: parsed.toISOString() };
  }
  if (input.decision === "hold" && !input.reason?.trim()) {
    return { ok: false, error: "보류는 사유가 필요합니다." };
  }
  return toResult((db) => {
    // 결정 3종(유지/연기/보류)은 core recordMilestoneDecision 하나로 처리한다 —
    // keep도 결정 기록(lastDecision*)+ChangeLog를 남겨 긴급 카드·재촉 DM이 당일 종결을 인식한다.
    // 권한·필수값(연기=새 마감일, 보류=사유)은 core가 최종 강제.
    return db.recordMilestoneDecision(
      { actorId: user.id, via: "web" },
      {
        milestoneId: input.milestoneId,
        decision: input.decision,
        newDueAt: input.newDueAt,
        reason: input.reason,
      },
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
