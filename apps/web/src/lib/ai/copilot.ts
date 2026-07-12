import "server-only";

import { getDb } from "@/lib/db";

import { z } from "zod";
import type { User } from "@que/core";
import {
  generateWithTools,
  type GeminiContent,
  type GeminiFunctionDeclaration,
  type GeminiPart,
} from "@/lib/ai/gemini";
import {
  COPILOT_READ_TOOL_DECLARATIONS,
  COPILOT_READ_TOOL_NAMES,
  runCopilotReadTool,
  type CopilotSource,
} from "@/lib/ai/copilot-tools";

// Que Copilot 채팅 라우터 (기획 모듈 D). 자연어 → (C-1) 실데이터 조회·정리 답변 + 출처 딥링크 /
// (C-2) 쓰기 intent면 확인 카드 draft 반환(실행은 별도 확정 액션 — copilot-actions.executeCopilotDraftAction).
//
// 설계 제약(기획 D-2):
//  ① AI는 실행하지 않고 제안한다 — 쓰기는 propose_* 도구 호출을 draft로 캡처만 하고 실행하지 않는다.
//  ② 권한은 말하는 사람의 권한 — 읽기 도구는 호출자 user를 그대로 데이터 계층에 넘긴다(상승 없음).
//  ③ 환각 방어 — 도구 결과에 없는 수치·사실은 만들지 않는다(시스템 프롬프트로 강제).

// ---- 확인 카드 draft 스키마 (zod로 정의, 타입은 유도) ----
// 4종만: create_task · create_milestone · change_status(내 작업) · help_request.
// 모델이 propose_* 도구를 "호출"하면 그 args를 이 스키마로 검증해 draft로 만든다(실행 안 함).

const statusDetailDraftSchema = z.object({
  reason: z.string().min(1).max(500),
  nextAction: z.string().max(500).optional(),
  helpUserIds: z.array(z.string().max(100)).max(10).optional(),
  recheckAt: z.string().max(40).optional(),
});

export const createTaskDraftSchema = z.object({
  kind: z.literal("create_task"),
  title: z.string().min(1).max(200),
  assigneeId: z.string().max(100).optional(),
  projectId: z.string().max(100).optional(),
  startAt: z.string().max(40).optional(),
  endAt: z.string().max(40).optional(),
  description: z.string().max(2000).optional(),
  priority: z.enum(["low", "normal", "high"]).optional(),
});

export const createMilestoneDraftSchema = z.object({
  kind: z.literal("create_milestone"),
  projectId: z.string().min(1).max(100),
  title: z.string().min(1).max(200),
  dueAt: z.string().min(1).max(40),
  riskStatus: z.enum(["on_track", "at_risk", "late"]).optional(),
});

export const createProjectDraftSchema = z.object({
  kind: z.literal("create_project"),
  name: z.string().min(1).max(200),
  clientId: z.string().min(1).max(100).optional(),
  ownerId: z.string().min(1).max(100).optional(),
  description: z.string().max(2000).optional(),
});

export const changeStatusDraftSchema = z.object({
  kind: z.literal("change_status"),
  taskId: z.string().min(1).max(100),
  // cancelled·merged는 특수 흐름이라 대화 확인 카드에서 제외한다.
  to: z.enum(["scheduled", "in_progress", "done", "needs_reschedule", "on_hold", "issue"]),
  // on_hold·issue로 갈 때는 core가 detail(사유)을 필수로 강제한다.
  detail: statusDetailDraftSchema.optional(),
});

export const helpRequestDraftSchema = z.object({
  kind: z.literal("help_request"),
  taskId: z.string().min(1).max(100),
  body: z.string().min(1).max(1000),
  helpUserIds: z.array(z.string().max(100)).min(1).max(10),
});

export const copilotDraftSchema = z.discriminatedUnion("kind", [
  createTaskDraftSchema,
  createMilestoneDraftSchema,
  createProjectDraftSchema,
  changeStatusDraftSchema,
  helpRequestDraftSchema,
]);

export type CopilotDraft = z.infer<typeof copilotDraftSchema>;

/** runCopilot 반환 계약. */
/** 확인 카드에 표시할 사람 읽는 라벨 — draft의 id들을 서버에서 이름으로 해석한다.
 *  사람이 "무엇을" 실행하는지 이름으로 검증할 수 있어야 확인 카드가 방어가 된다(게이트 M-3). */
export interface CopilotDraftLabels {
  taskTitle?: string;
  assigneeName?: string;
  projectName?: string;
  helpUserNames?: string[];
}

export interface CopilotReply {
  /** 답변(실데이터 도구 결과 기반). */
  text: string;
  /** 출처 딥링크(중복 제거). */
  sources: CopilotSource[];
  /** 쓰기 intent면 확인 카드용 draft들(실행 전) — 나열 요청이면 여러 장. 없으면 조회 답변만. */
  drafts?: CopilotDraft[];
  /** drafts와 같은 순서의 라벨(확인 카드 표기용 — id를 이름으로 해석). */
  draftLabelsList?: CopilotDraftLabels[];
}

// ---- 쓰기 제안(propose_*) 도구 선언 — 실행하지 않고 draft로 캡처만 한다 ----
const PROPOSE_TOOL_DECLARATIONS: GeminiFunctionDeclaration[] = [
  {
    name: "propose_create_task",
    description:
      "사용자가 새 작업(할 일) 생성을 원할 때 호출한다. 실행하지 않고 확인 카드를 만든다. 담당자/프로젝트는 아이디를 모르면 비워라(사용자가 카드에서 지정).",
    parameters: {
      type: "object",
      properties: {
        title: { type: "string", description: "작업 제목." },
        assigneeId: { type: "string", description: "담당자 사용자 ID(모르면 생략 — 본인으로 배정)." },
        projectId: { type: "string", description: "프로젝트 ID(모르면 생략)." },
        startAt: { type: "string", description: "시작 ISO datetime(선택)." },
        endAt: { type: "string", description: "마감 ISO datetime(선택)." },
        description: { type: "string", description: "설명(선택)." },
        priority: { type: "string", enum: ["low", "normal", "high"], description: "우선순위(선택)." },
      },
      required: ["title"],
    },
  },
  {
    name: "propose_create_milestone",
    description: "프로젝트 마일스톤 생성을 원할 때 호출한다. 실행하지 않고 확인 카드를 만든다.",
    parameters: {
      type: "object",
      properties: {
        projectId: { type: "string", description: "프로젝트 ID." },
        title: { type: "string", description: "마일스톤 제목." },
        dueAt: { type: "string", description: "기한 ISO datetime." },
        riskStatus: {
          type: "string",
          enum: ["on_track", "at_risk", "late"],
          description: "위험 상태(선택, 기본 on_track).",
        },
      },
      required: ["projectId", "title", "dueAt"],
    },
  },
  {
    name: "propose_create_project",
    description:
      "새 프로젝트 생성을 제안한다(실행 안 함 — 확인 카드). 누구나 만들 수 있다. 클라이언트 소속이 불명확하면 사용자에게 물어라(list는 get_project_status 후보나 search_items로).",
    parameters: {
      type: "object",
      properties: {
        name: { type: "string", description: "프로젝트 이름(필수)." },
        clientId: { type: "string", description: "소속 클라이언트 id(선택)." },
        ownerId: { type: "string", description: "담당자 userId(선택 — 비우면 요청자 본인)." },
        description: { type: "string", description: "설명(선택)." },
      },
      required: ["name"],
    },
  },
  {
    name: "propose_change_status",
    description:
      "본인 작업의 상태 변경을 원할 때 호출한다(예: 완료 처리, 홀드). 실행하지 않고 확인 카드를 만든다. on_hold/issue면 detail(사유·다음 액션·재확인 시간)을 채워라.",
    parameters: {
      type: "object",
      properties: {
        taskId: { type: "string", description: "대상 작업 ID." },
        to: {
          type: "string",
          enum: ["scheduled", "in_progress", "done", "needs_reschedule", "on_hold", "issue"],
          description: "바꿀 상태.",
        },
        detail: {
          type: "object",
          description: "on_hold/issue 전환 시 필수. 사유·다음 액션·재확인 시간.",
          properties: {
            reason: { type: "string", description: "사유." },
            nextAction: { type: "string", description: "다음 액션(선택)." },
            helpUserIds: { type: "array", items: { type: "string" }, description: "도움 필요한 사람 ID(선택)." },
            recheckAt: { type: "string", description: "재확인 ISO datetime(선택)." },
          },
        },
      },
      required: ["taskId", "to"],
    },
  },
  {
    name: "propose_help_request",
    description: "특정 작업에 대해 도움을 요청하고 싶을 때 호출한다. 실행하지 않고 확인 카드를 만든다.",
    parameters: {
      type: "object",
      properties: {
        taskId: { type: "string", description: "대상 작업 ID." },
        body: { type: "string", description: "도움 요청 내용." },
        helpUserIds: {
          type: "array",
          items: { type: "string" },
          description: "도움을 요청할 사람 ID(최소 1명).",
        },
      },
      required: ["taskId", "body", "helpUserIds"],
    },
  },
];

const PROPOSE_TO_KIND: Record<string, CopilotDraft["kind"]> = {
  propose_create_task: "create_task",
  propose_create_milestone: "create_milestone",
  propose_create_project: "create_project",
  propose_change_status: "change_status",
  propose_help_request: "help_request",
};

/** 시스템 프롬프트 — 현재 KST 날짜를 주입한다("내일" 같은 상대 날짜를 LLM이 올바르게 계산하게, 실측 회귀). */
const systemPromptFor = (now: Date) => {
  const kst = new Date(now.getTime() + 9 * 3600_000);
  const today = kst.toISOString().slice(0, 10);
  const dow = ["일", "월", "화", "수", "목", "금", "토"][kst.getUTCDay()];
  return `오늘은 ${today} (${dow}요일, Asia/Seoul)이다. 날짜·시간은 전부 이 기준으로 계산하고, datetime은 +09:00 오프셋을 포함한 ISO8601로 쓴다.

${SYSTEM_PROMPT_BODY}`;
};

const SYSTEM_PROMPT_BODY = `너는 Que(팀 작업 상태 관리 도구)의 어시스턴트 "Que Copilot"이다. 한국어 존댓말로, 운영 도구답게 간결하게 답한다.

원칙:
- 조회 답변의 모든 수치·사실은 반드시 도구(get_*) 호출 결과에서만 인용한다. 도구 결과에 없는 숫자·이름·상태를 지어내지 마라.
- 도구를 부르지 않았거나 결과가 비었으면, 추측하지 말고 "해당 데이터를 찾지 못했습니다"라고 답한다. 단 도구 결과에 hint 필드가 있으면 그 안내(어느 화면에서 만들 수 있는지)를 함께 전한다 — "없습니다"로 끝내는 막다른 답을 만들지 마라.
- 필요한 데이터가 있으면 먼저 도구를 호출하고, 그 결과만으로 정리해서 답한다. 여러 정보가 필요하면 도구를 여러 번 부른다.
- 사용자가 무언가를 만들거나·바꾸거나·도움을 요청하려 하면(쓰기 의도), 직접 실행하지 말고 propose_* 도구를 호출한다. 실행은 사람이 확인 카드에서 누른다.
- 쓰기 대상(작업/프로젝트/사람)의 ID를 모르면 먼저 search_items나 get_* 도구로 찾은 뒤 propose_* 를 호출한다.
- **작업을 만들 때 어느 프로젝트에 속하는지 반드시 확정하라 — 불명확하면 propose 전에 사용자에게 물어라**(시스템도 프로젝트 없는 제안은 카드로 내보내지 않고 되묻는다) — get_project_status나 search_items로 활성 프로젝트 후보를 찾아 "어느 프로젝트에 넣을까요? (후보: A, B, …)" 형태로 제시한다. 사용자가 "멘딕스"처럼 단서를 줬으면 그 이름으로 프로젝트를 해석해 projectId를 채운다. 프로젝트 없이 만들어달라고 하면 그때만 projectId를 비운다.
- 프로젝트가 아예 없으면(후보에 마땅한 것이 없으면) propose_create_project로 새 프로젝트 생성을 제안할 수 있다 — 누구나 만들 수 있다.
- **사용자가 할 일 여러 개를 나열하면(번호·줄바꿈 목록), 각 항목마다 propose_create_task를 각각 호출한다** — 첫 항목만 만들고 멈추지 마라. 확인 카드가 항목 수만큼 나와야 한다.
- 답변에 출처 화면을 언급할 필요는 없다(출처 링크는 시스템이 따로 붙인다). 장황한 서론 없이 핵심부터.`;

/** 대화 메시지(세션 로컬 — 저장하지 않는다). */
export interface CopilotMessage {
  role: "user" | "assistant";
  text: string;
}

const MAX_TOOL_ROUNDS = 3;

/**
 * 채팅 1턴 실행. 읽기 도구 루프(최대 3라운드) + 쓰기 propose 캡처.
 * 대화 이력(messages)은 세션 로컬로만 쓰고 저장하지 않는다(기획 D-4).
 */
export async function runCopilot(
  user: User,
  messages: CopilotMessage[],
  now: Date = new Date(),
): Promise<CopilotReply> {
  const contents: GeminiContent[] = messages
    .filter((m) => m.text.trim().length > 0)
    .map((m) => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: m.text }],
    }));
  if (contents.length === 0) {
    return { text: "무엇을 도와드릴까요?", sources: [] };
  }

  const functionDeclarations = [...COPILOT_READ_TOOL_DECLARATIONS, ...PROPOSE_TOOL_DECLARATIONS];
  const sourceMap = new Map<string, CopilotSource>(); // href 기준 중복 제거

  for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
    const candidate = await generateWithTools({
      systemInstruction: systemPromptFor(new Date()),
      contents,
      functionDeclarations,
    });
    const parts = candidate.parts ?? [];
    const calls = parts.filter((p): p is GeminiPart & { functionCall: NonNullable<GeminiPart["functionCall"]> } =>
      Boolean(p.functionCall),
    );

    // 쓰기 제안(propose_*)은 **전부** draft로 캡처하고 종료한다(실행하지 않음) —
    // "할 일 3개 만들어줘"처럼 나열하면 확인 카드가 3장 나와야 한다(2026-07-12 피드백:
    // 첫 번째만 캡처돼 1건만 생성되던 회귀).
    const proposeCalls = calls.filter((p) => p.functionCall.name in PROPOSE_TO_KIND);
    if (proposeCalls.length > 0) {
      const drafts: CopilotDraft[] = [];
      const draftLabelsList: CopilotDraftLabels[] = [];
      for (const call of proposeCalls) {
        const draft = buildDraft(call.functionCall.name, call.functionCall.args);
        if (!draft) continue;
        drafts.push(draft);
        draftLabelsList.push(await resolveDraftLabels(user, draft));
      }
      // ── 프로젝트 필수 확인 가드(2026-07-12 사용자 확정: "관련된 프로젝트를 물어봐야 해") ──
      // projectId 없는 create_task는 카드로 내보내지 않고 반드시 되묻는다. 예외는 사용자가
      // 대화에서 "프로젝트 없이"를 명시했을 때뿐(무한 되묻기 방지 + 명시적 선택 존중).
      const userSaidNoProject = messages.some(
        (m) => m.role === "user" && /프로젝트\s*(없이|없음|무관|안\s*넣어)/.test(m.text),
      );
      const held = userSaidNoProject
        ? []
        : drafts
            .map((d, i) => ({ d, i }))
            .filter(({ d }) => d.kind === "create_task" && !d.projectId);
      if (held.length > 0) {
        const heldTitles = held.map(({ d }) => (d.kind === "create_task" ? `"${d.title}"` : "")).join(", ");
        const heldIdx = new Set(held.map(({ i }) => i));
        const readyDrafts = drafts.filter((_, i) => !heldIdx.has(i));
        const readyLabels = draftLabelsList.filter((_, i) => !heldIdx.has(i));
        const candidates = await activeProjectCandidates();
        const ask =
          `${heldTitles} — 어느 프로젝트에 넣을까요?\n` +
          (candidates.length > 0 ? `후보: ${candidates.join(" · ")}\n` : "") +
          `프로젝트 없이 두려면 "프로젝트 없이"라고 답해 주세요.`;
        return {
          text: readyDrafts.length > 0 ? `${readyDrafts.length}건은 아래 카드로 준비했습니다.\n${ask}` : ask,
          sources: dedupeSources(sourceMap),
          drafts: readyDrafts.length > 0 ? readyDrafts : undefined,
          draftLabelsList: readyDrafts.length > 0 ? readyLabels : undefined,
        };
      }

      const text =
        collectText(parts) ||
        (drafts.length > 0
          ? drafts.length > 1
            ? `아래 ${drafts.length}건을 준비했습니다. 각각 확인 후 실행하세요.`
            : "아래 내용을 준비했습니다. 확인 후 실행하세요."
          : "요청을 이해했지만 확인 카드를 만들 정보가 부족합니다. 조금 더 구체적으로 알려주세요.");
      return {
        text,
        sources: dedupeSources(sourceMap),
        drafts: drafts.length > 0 ? drafts : undefined,
        draftLabelsList: drafts.length > 0 ? draftLabelsList : undefined,
      };
    }

    const readCalls = calls.filter((p) => COPILOT_READ_TOOL_NAMES.has(p.functionCall.name));
    if (readCalls.length === 0) {
      // 도구 호출 없음 = 최종 답변(텍스트).
      const text = collectText(parts) || "해당 데이터를 찾지 못했습니다.";
      return { text, sources: dedupeSources(sourceMap) };
    }

    // 읽기 도구 실행 → 모델 턴 + functionResponse 턴을 대화에 append하고 다음 라운드로.
    contents.push({ role: "model", parts });
    const responseParts: GeminiPart[] = [];
    // 미지 도구명(READ도 propose도 아닌 호출)에도 오류 functionResponse를 돌려준다 —
    // model 턴에 미응답 functionCall이 남으면 다음 라운드 API가 거부할 수 있다(게이트 Low).
    const unknownCalls = calls.filter(
      (p) =>
        !COPILOT_READ_TOOL_NAMES.has(p.functionCall.name) &&
        !p.functionCall.name.startsWith("propose_"),
    );
    for (const call of unknownCalls) {
      responseParts.push({
        functionResponse: {
          name: call.functionCall.name,
          response: { error: "알 수 없는 도구입니다." },
        },
      });
    }
    for (const call of readCalls) {
      const { name, args } = call.functionCall;
      try {
        const result = await runCopilotReadTool(name, args ?? {}, user, now);
        for (const s of result.sources) sourceMap.set(s.href, s);
        responseParts.push({
          functionResponse: { name, response: { result: result.data } },
        });
      } catch (e) {
        responseParts.push({
          functionResponse: {
            name,
            response: { error: e instanceof Error ? e.message : "도구 실행 실패" },
          },
        });
      }
    }
    // functionResponse는 v1beta에서 "user" 턴으로 되돌린다.
    contents.push({ role: "user", parts: responseParts });
  }

  // 라운드 소진 — 마지막으로 도구 없이 한 번 더 요약을 요청한다(무한 루프 방지).
  const finalCandidate = await generateWithTools({
    systemInstruction: systemPromptFor(new Date()),
    contents,
    functionDeclarations: COPILOT_READ_TOOL_DECLARATIONS, // 마지막엔 쓰기 제안 없이 정리만
  });
  const text = collectText(finalCandidate.parts ?? []) || "해당 데이터를 찾지 못했습니다.";
  return { text, sources: dedupeSources(sourceMap) };
}

/** parts의 text를 이어붙인다. */
function collectText(parts: GeminiPart[]): string {
  return parts
    .map((p) => p.text ?? "")
    .join("")
    .trim();
}

function dedupeSources(map: Map<string, CopilotSource>): CopilotSource[] {
  return [...map.values()].slice(0, 8);
}

/** propose_* args → 검증된 draft. 검증 실패면 null(호출부가 안내 문구로 대체). */
function buildDraft(toolName: string, rawArgs: Record<string, unknown>): CopilotDraft | null {
  const kind = PROPOSE_TO_KIND[toolName];
  if (!kind) return null;
  const parsed = copilotDraftSchema.safeParse({ ...rawArgs, kind });
  return parsed.success ? parsed.data : null;
}

/** draft id들을 이름으로 해석(조회 전용 — getDb 스냅샷). 실패는 라벨 없음으로 조용히. */
async function resolveDraftLabels(
  _user: { id: string },
  draft: CopilotDraft,
): Promise<CopilotDraftLabels> {
  try {
    const db = await getDb();
    const userName = (id?: string) => (id ? db.users.find((u) => u.id === id)?.name : undefined);
    if (draft.kind === "create_task") {
      return {
        assigneeName: userName(draft.assigneeId),
        projectName: draft.projectId
          ? db.projects.find((p) => p.id === draft.projectId)?.name
          : undefined,
      };
    }
    if (draft.kind === "create_milestone") {
      return { projectName: db.projects.find((p) => p.id === draft.projectId)?.name };
    }
    if (draft.kind === "create_project") {
      return {
        projectName: draft.clientId
          ? db.clients.find((c) => c.id === draft.clientId)?.name
          : undefined, // 확인 카드의 "클라이언트" 표기에 재사용
        assigneeName: userName(draft.ownerId),
      };
    }
    if (draft.kind === "change_status") {
      return { taskTitle: db.tasks.find((t) => t.id === draft.taskId)?.title };
    }
    // help_request
    return {
      taskTitle: db.tasks.find((t) => t.id === draft.taskId)?.title,
      helpUserNames: draft.helpUserIds
        .map((id) => userName(id))
        .filter((n): n is string => Boolean(n)),
    };
  } catch {
    return {};
  }
}

/** 활성 프로젝트 이름 후보(되묻기용). 실패는 빈 배열로 조용히. */
async function activeProjectCandidates(): Promise<string[]> {
  try {
    const db = await getDb();
    return db.projects
      .filter((p) => p.status !== "archived")
      .slice(0, 10)
      .map((p) => p.name);
  } catch {
    return [];
  }
}
