"use server";

import { revalidatePath } from "next/cache";
import {
  canEditTask,
  findUser,
  isQueRuleError,
  type Project,
  type Task,
  type TaskStatus,
} from "@que/core";
import { getDb } from "@/lib/db";
import { getCurrentUser } from "@/lib/current-user";
import { generateAnalysis } from "@/lib/ai/gemini";
import type { ActionResult } from "@/app/(app)/today/actions";

// AI 선행 연결 제안 — 간트 뷰 보조. AI는 **제안만** 하고, 연결은 사용자가 건별로 수락해야
// 커밋된다(자연어 확인 카드 규칙의 정신). 수락은 core setTaskPredecessors 경유 —
// 같은 프로젝트·순환 금지·권한(canEditTask)을 core가 최종 강제하고 ChangeLog(via:"web")에 남는다.
// 호출 단위는 프로젝트 1개(전체 보기 미지원) — 제목 패턴·날짜 순서를 한 번에 보는 게 품질·비용 모두 유리.

export interface PredecessorSuggestion {
  /** 후행(이 작업이 선행을 기다린다). */
  taskId: string;
  taskTitle: string;
  /** 후행 기간 라벨("7/15~7/17" · "~7/13" · "7/15" · null=날짜 없음) — 날짜가 판단 근거라 카드에 표기. */
  taskPeriod: string | null;
  predecessorId: string;
  predecessorTitle: string;
  predecessorPeriod: string | null;
  /** AI가 붙인 근거 한 문장. */
  reason: string;
}

/** 작업의 기간 라벨. 시작~마감이 다르면 "M/d~M/d", 한쪽만 있으면 그 날짜(마감만이면 "~M/d"). */
function periodLabel(task: Task): string | null {
  const fmt = (iso: string) => {
    const d = new Date(iso);
    return `${d.getMonth() + 1}/${d.getDate()}`;
  };
  const start = task.startAt ? fmt(task.startAt) : null;
  const end = task.endAt ? fmt(task.endAt) : null;
  if (start && end) return start === end ? start : `${start}~${end}`;
  if (end) return `~${end}`;
  return start;
}

export type SuggestPredecessorsResult =
  | { ok: true; suggestions: PredecessorSuggestion[] }
  | { ok: false; error: string };

const STATUS_KO: Record<TaskStatus, string> = {
  scheduled: "예정",
  in_progress: "진행중",
  on_hold: "홀드",
  issue: "문제",
  needs_reschedule: "일정 재조정",
  done: "완료",
  cancelled: "취소",
  merged: "병합",
};

const MAX_SUGGESTIONS = 8;

const SYSTEM_INSTRUCTION = `너는 프로젝트 일정 관리 도우미다. 아래 작업 목록에서 "선행 작업" 연결(A가 끝나야 B를 시작)이 빠져 보이는 곳을 찾아 제안한다.
판단 근거: ①제목의 단계 패턴(예: 초안 → 작업 → 수정 → 검수 → 납품) ②날짜 순서(선행의 마감이 후행의 시작보다 앞) ③같은 담당·같은 흐름의 연속 작업.
규칙:
- 확신이 있는 것만 제안한다. 억지로 채우지 않는다. 최대 ${MAX_SUGGESTIONS}개.
- 이미 연결돼 있는 쌍은 제안하지 않는다.
- reason은 팀원이 읽는 한국어 한 문장(30자 내외).
- 출력은 JSON 배열만. 마크다운·설명·코드펜스 금지. 형식: [{"predecessorId":"...","taskId":"...","reason":"..."}]
- 제안할 것이 없으면 [] 만 출력한다.`;

/**
 * 프로젝트 하나의 작업 흐름을 AI가 읽고 누락된 선행 연결 후보를 돌려준다(읽기 전용 — 아무것도 저장 안 함).
 * 서버가 실재·같은 프로젝트·중복·순환·권한(내가 적용 가능한 것만)을 걸러 확실한 제안만 내려보낸다.
 */
export async function suggestPredecessorsAction(input: {
  projectId: string;
}): Promise<SuggestPredecessorsResult> {
  const user = await getCurrentUser();
  const db = await getDb();
  const project = db.projects.find((p) => p.id === input.projectId);
  if (!project) return { ok: false, error: "프로젝트를 찾을 수 없습니다." };

  const tasks = db.tasks.filter(
    (t) => t.projectId === input.projectId && t.status !== "cancelled" && t.status !== "merged",
  );
  if (tasks.length < 2) {
    return { ok: false, error: "작업이 2개 이상 있어야 연결을 제안할 수 있습니다." };
  }

  const taskById = new Map(tasks.map((t) => [t.id, t]));
  const day = (iso: string | undefined) => (iso ? iso.slice(0, 10) : "없음");
  const lines = tasks.map((t) => {
    const preds = (t.predecessorIds ?? [])
      .map((id) => taskById.get(id)?.title ?? id)
      .join(", ");
    return `${t.id} | ${t.title} | 시작 ${day(t.startAt)} | 마감 ${day(t.endAt)} | ${STATUS_KO[t.status]} | 담당 ${findUser(t.assigneeId ?? "")?.name ?? "미배정"} | 기존 선행: ${preds || "없음"}`;
  });

  let raw: string;
  try {
    raw = await generateAnalysis(
      SYSTEM_INSTRUCTION,
      `프로젝트: ${project.name}\n작업 목록(id | 제목 | 시작 | 마감 | 상태 | 담당 | 기존 선행):\n${lines.join("\n")}`,
    );
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "AI 제안 생성에 실패했습니다." };
  }

  return { ok: true, suggestions: sanitizeSuggestions(raw, project, taskById, user) };
}

/**
 * AI 출력(JSON) → 검증된 제안 목록. LLM 출력은 신뢰하지 않는다 — 실재하지 않는 id·타 프로젝트·
 * 중복·순환 유발·내가 적용 못 하는 것(canEditTask)은 전부 버리고, 살아남은 것만 캡까지 자른다.
 */
function sanitizeSuggestions(
  raw: string,
  project: Project,
  taskById: Map<string, Task>,
  actor: Awaited<ReturnType<typeof getCurrentUser>>,
): PredecessorSuggestion[] {
  // 지시를 어기고 코드펜스를 두르는 경우 방어.
  const jsonText = raw.replace(/^\s*```(?:json)?\s*/i, "").replace(/\s*```\s*$/, "");
  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonText);
  } catch {
    return [];
  }
  if (!Array.isArray(parsed)) return [];

  // 연결 시 순환이 되는지 — 선행 후보의 선행 사슬에 후행이 이미 있으면 순환.
  const chainsInto = (fromId: string, targetId: string): boolean => {
    const stack = [fromId];
    const seen = new Set<string>();
    while (stack.length > 0) {
      const id = stack.pop()!;
      if (id === targetId) return true;
      if (seen.has(id)) continue;
      seen.add(id);
      const t = taskById.get(id);
      if (t?.predecessorIds) stack.push(...t.predecessorIds);
    }
    return false;
  };

  const out: PredecessorSuggestion[] = [];
  const dup = new Set<string>();
  for (const item of parsed) {
    if (out.length >= MAX_SUGGESTIONS) break;
    if (typeof item !== "object" || item === null) continue;
    const { taskId, predecessorId, reason } = item as Record<string, unknown>;
    if (typeof taskId !== "string" || typeof predecessorId !== "string") continue;
    if (taskId === predecessorId) continue;
    const task = taskById.get(taskId);
    const pred = taskById.get(predecessorId);
    if (!task || !pred) continue; // taskById는 이 프로젝트 작업만 담고 있다 — 타 프로젝트·유령 id 차단
    if ((task.predecessorIds ?? []).includes(predecessorId)) continue; // 이미 연결됨
    if (chainsInto(predecessorId, taskId)) continue; // 순환 유발
    if (!canEditTask(actor, task, project)) continue; // 내가 적용 못 하는 제안은 안 보여준다
    const key = `${predecessorId}->${taskId}`;
    if (dup.has(key)) continue;
    dup.add(key);
    out.push({
      taskId,
      taskTitle: task.title,
      taskPeriod: periodLabel(task),
      predecessorId,
      predecessorTitle: pred.title,
      predecessorPeriod: periodLabel(pred),
      reason: typeof reason === "string" ? reason.slice(0, 100) : "작업 흐름상 앞뒤로 이어져 보입니다",
    });
  }
  return out;
}

/**
 * 제안 1건 수락 — 현재 선행 목록을 서버에서 다시 읽어 **추가** 시맨틱으로 커밋한다
 * (클라이언트가 들고 있던 목록에 기대면 연속 수락 시 서로를 덮어쓴다).
 * 권한·순환·같은 프로젝트는 core setTaskPredecessors가 최종 강제.
 */
export async function applyPredecessorSuggestionAction(input: {
  taskId: string;
  predecessorId: string;
}): Promise<ActionResult> {
  const user = await getCurrentUser();
  try {
    const db = await getDb();
    const task = db.tasks.find((t) => t.id === input.taskId);
    if (!task) return { ok: false, error: "작업을 찾을 수 없습니다." };
    const next = Array.from(new Set([...(task.predecessorIds ?? []), input.predecessorId]));
    db.setTaskPredecessors({ actorId: user.id, via: "web" }, { taskId: input.taskId, predecessorIds: next });
    await db.persist();
    revalidatePath("/projects");
    return { ok: true };
  } catch (error) {
    if (isQueRuleError(error)) return { ok: false, error: error.message };
    throw error;
  }
}
