"use server";

import { revalidatePath } from "next/cache";
import { isQueRuleError, type TaskStatus } from "@que/core";
import { z } from "zod";
import { getDb } from "@/lib/db";
import { getCurrentUser } from "@/lib/current-user";
import { runCopilot, copilotDraftSchema, type CopilotDraft, type CopilotReply } from "@/lib/ai/copilot";
import { notifyTaskCreated, notifyTaskStatusChanged } from "@/lib/notifications/dispatch";
import type { ActionResult } from "@/app/(app)/today/actions";

// Que Copilot 서버 액션 (기획 모듈 D). ⌘K 채팅의 서버 진입점.
//  - askCopilotAction: 세션 강제 → runCopilot(조회·정리 + 확인 카드 draft). 대화 이력 저장 안 함(D-4).
//  - executeCopilotDraftAction: 확인 카드 확정 실행 → core mutation 직접 호출(via:"chat").
// 권한은 core가 최종 강제한다(말하는 사람의 권한 — 권한 상승 없음). toResult(같은 db 인스턴스 persist) 준수.

/** getDb()가 반환하는 DB 인스턴스 타입. */
type Db = Awaited<ReturnType<typeof getDb>>;

/** 채팅 메시지 입력(클라이언트 신뢰 금지 — zod 검증). */
const messagesSchema = z
  .array(
    z.object({
      role: z.enum(["user", "assistant"]),
      text: z.string().max(4000),
    }),
  )
  .min(1)
  .max(40);

export type AskCopilotResult =
  | { ok: true; reply: CopilotReply }
  | { ok: false; error: string };

/** 채팅 1턴. 실패(설정 미비·모델 오류·검증 실패)는 { ok:false }로 변환한다. */
export async function askCopilotAction(
  messages: { role: "user" | "assistant"; text: string }[],
): Promise<AskCopilotResult> {
  const user = await getCurrentUser(); // 미인증이면 /login 리다이렉트(세션 강제)
  const parsed = messagesSchema.safeParse(messages);
  if (!parsed.success) return { ok: false, error: "메시지 형식이 올바르지 않습니다." };
  try {
    const reply = await runCopilot(user, parsed.data);
    return { ok: true, reply };
  } catch (error) {
    // runCopilot이 던지는 것은 사용자용 한글 메시지(gemini.ts) — 그대로 노출.
    return { ok: false, error: error instanceof Error ? error.message : "코파일럿 응답에 실패했습니다." };
  }
}

/**
 * db 인스턴스를 한 번 획득해 mutation + persist를 같은 인스턴스에서 수행(persist 유실 방지).
 * QueRuleError만 { ok:false }로 변환하고 NEXT_REDIRECT(미인증) 등은 전파한다.
 */
async function toResult(
  fn: (db: Db) => Promise<void> | void,
  afterCommit?: (db: Db) => Promise<void>,
): Promise<ActionResult> {
  try {
    const db = await getDb();
    await fn(db);
    await db.persist();
    // 대화 실행의 영향 화면을 폭넓게 갱신(정확한 대상보다 안전).
    for (const path of ["/today", "/now", "/team", "/projects", "/planning"]) {
      revalidatePath(path);
    }
    if (afterCommit) await afterCommit(db);
    return { ok: true };
  } catch (error) {
    if (isQueRuleError(error)) return { ok: false, error: error.message };
    // zod 검증(잘못된 datetime 등) 실패는 대화 UI가 그대로 보여줄 사용자 문구로 변환.
    if (error instanceof Error && error.name === "ZodError") {
      return { ok: false, error: "입력 형식이 올바르지 않습니다 — 날짜·값을 확인해 주세요." };
    }
    throw error;
  }
}

/**
 * 확인 카드 확정 실행. draft.kind별로 core mutation을 via:"chat"으로 호출한다.
 * draft는 클라이언트에서 오므로 다시 zod로 검증한다(신뢰 금지). 권한·규칙은 core가 최종 강제.
 */
/** LLM이 만든 datetime은 타임존이 빠진 "YYYY-MM-DDTHH:mm[:ss]" 형태가 흔하다 —
 *  core isoDateTime(offset 필수)이 거부하므로 KST(+09:00)를 부여해 정규화한다(실측 회귀). */
function normalizeKst(value: string | undefined): string | undefined {
  if (!value) return value;
  const v = value.trim();
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?$/.test(v)) {
    return `${v.length === 16 ? `${v}:00` : v}+09:00`;
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return `${v}T09:00:00+09:00`; // 날짜만 오면 오전 9시
  return v;
}

export async function executeCopilotDraftAction(draft: CopilotDraft): Promise<ActionResult> {
  const user = await getCurrentUser();
  const parsed = copilotDraftSchema.safeParse(draft);
  if (!parsed.success) return { ok: false, error: "확인 카드 내용이 올바르지 않습니다." };
  const d = parsed.data;
  if (d.kind === "create_task") {
    d.startAt = normalizeKst(d.startAt);
    d.endAt = normalizeKst(d.endAt);
  } else if (d.kind === "create_milestone") {
    d.dueAt = normalizeKst(d.dueAt) ?? d.dueAt;
  } else if (d.kind === "change_status" && d.detail?.recheckAt) {
    d.detail.recheckAt = normalizeKst(d.detail.recheckAt) ?? d.detail.recheckAt;
  }
  const ctx = { actorId: user.id, via: "chat" as const };

  switch (d.kind) {
    case "create_task": {
      let createdId: string | undefined;
      const result = await toResult(
        (db) => {
          const task = db.createTask(ctx, {
            title: d.title,
            assigneeId: d.assigneeId,
            projectId: d.projectId,
            startAt: d.startAt,
            endAt: d.endAt,
            description: d.description,
            priority: d.priority,
            source: "manual",
          });
          createdId = task.id;
        },
        (db) => (createdId ? notifyTaskCreated(db, createdId) : Promise.resolve()),
      );
      return result;
    }

    case "create_milestone":
      return toResult((db) =>
        void db.createMilestone(ctx, {
          projectId: d.projectId,
          title: d.title,
          dueAt: d.dueAt,
          riskStatus: d.riskStatus,
        }),
      );

    case "change_status": {
      let fromStatus: TaskStatus | undefined;
      return toResult(
        (db) => {
          fromStatus = db.tasks.find((t) => t.id === d.taskId)?.status;
          db.changeTaskStatus(ctx, { taskId: d.taskId, to: d.to, detail: d.detail });
        },
        (db) =>
          fromStatus
            ? notifyTaskStatusChanged(db, d.taskId, fromStatus, d.detail)
            : Promise.resolve(),
      );
    }

    case "help_request":
      return toResult((db) =>
        void db.addTaskComment(ctx, {
          taskId: d.taskId,
          body: d.body,
          helpUserIds: d.helpUserIds,
        }),
      );
  }
}
