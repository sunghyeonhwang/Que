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
  estimatedHours: z.number().positive().max(1000).optional(),
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
        estimatedHours: {
          type: "number",
          description: "예상 소요시간(시간 단위, 선택). 예: 2시간→2, 30분→0.5, 반나절→4, 하루종일→8. 언급이 없으면 생략.",
        },
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
- 지난 회의 결정·"~하기로 한 것"을 물으면 get_decisions를 쓴다(AI 추출이라 정확한 문구는 원문 대조가 필요함을 답변에 덧붙인다).
- 지난주·이번 주 회고("어땠나·누가 뭐에 집중·막힘")를 물으면 get_weekly_retro를 쓴다(막힘 해소는 단정하지 말고 라벨 그대로).
- 본인이 "오늘 얼마나 바쁜가·부하"를 물으면 get_today_load를 쓴다(본인만 — 타인 부하는 이 도구로 답하지 말고 get_workload/팀 화면으로 안내).
- 사용자가 무언가를 만들거나·바꾸거나·도움을 요청하려 하면(쓰기 의도), 직접 실행하지 말고 propose_* 도구를 호출한다. 실행은 사람이 확인 카드에서 누른다.
- 쓰기 대상(작업/프로젝트/사람)의 ID를 모르면 먼저 search_items나 get_* 도구로 찾은 뒤 propose_* 를 호출한다.
- **작업을 만들 때 어느 프로젝트에 속하는지 반드시 확정하라 — 불명확하면 propose 전에 사용자에게 물어라**(시스템도 프로젝트 없는 제안은 카드로 내보내지 않고 되묻는다) — get_project_status나 search_items로 활성 프로젝트 후보를 찾아 "어느 프로젝트에 넣을까요? (후보: A, B, …)" 형태로 제시한다. 사용자가 "멘딕스"처럼 단서를 줬으면 그 이름으로 프로젝트를 해석해 projectId를 채운다. 프로젝트 없이 만들어달라고 하면 그때만 projectId를 비운다.
- 프로젝트가 아예 없으면(후보에 마땅한 것이 없으면) propose_create_project로 새 프로젝트 생성을 제안할 수 있다 — 누구나 만들 수 있다. **사용자가 특정 이름을 댔는데 get_project_status 후보에 없으면, 되묻기보다 그 이름으로 propose_create_project를 제안하는 것을 먼저 고려하라.**
- **회의 요청 처리:** Que에는 '회의' 엔티티가 없다. "회의를 잡아줘/미팅 일정 잡아줘"류 요청은 propose_create_task로 만든다(제목=회의명, startAt/endAt=회의 시간, description에 참석자 명단을 적는다). **회의를 propose_create_milestone으로 만들지 마라** — 마일스톤은 프로젝트 기한이지 회의가 아니다. 회의 작업의 프로젝트가 불명확하면 위 프로젝트 규칙대로 되묻되, 프로젝트 없이도 만들 수 있음을 안내한다.
- **마일스톤은 projectId가 필수다.** 프로젝트를 특정할 수 없으면 propose_create_milestone을 호출하지 말고, 작업(propose_create_task)으로 만들지 사용자에게 제안하라.
- **사용자가 할 일 여러 개를 나열하면(번호·줄바꿈 목록), 각 항목마다 propose_create_task를 각각 호출한다** — 첫 항목만 만들고 멈추지 마라. 확인 카드가 항목 수만큼 나와야 한다.
- **예상 소요가 언급되면 estimatedHours로 추출한다**(예: "2시간"→2, "30분"→0.5, "반나절"→4, "하루종일"→8). 언급이 없으면 임의로 채우지 말고 생략한다.
- **날짜 표기:** 답변 본문에는 ISO datetime 문자열(예: 2026-07-21T17:00:00+09:00)을 그대로 쓰지 마라. 도구 결과에 함께 담긴 사람 표기(예: dueAtHuman "7월 21일(화) 17:00")나 자연스러운 한국어 날짜로 쓴다(propose_* 인자에는 ISO를 그대로 쓴다).
- **서식:** 굵게(**...**)와 목록(-, 1.) 같은 가벼운 마크다운은 써도 된다. 다만 표(|)와 헤딩(#)은 쓰지 마라(운영 도구 가독성).
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

  // 성공한 draft를 라운드에 걸쳐 누적한다(검증 실패 재시도 중 이미 확정된 카드를 잃지 않게). JSON 키로 중복 제거.
  const capturedDrafts: CopilotDraft[] = [];
  const capturedLabels: CopilotDraftLabels[] = [];
  const seenDraftKeys = new Set<string>();
  let proposeRetried = false; // 검증 실패 재시도는 1라운드만(무한 되풀이 방지).

  for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
    const candidate = await generateWithTools({
      systemInstruction: systemPromptFor(new Date()),
      contents,
      functionDeclarations,
      // Copilot 채팅은 pro(2026-07-15 사용자 확정) — flash의 도구 선택·교정 호출 약점이
      // 실측으로 확인돼 승급. 배치성 AI(브리핑·요약)의 모델 선택과는 무관.
      model: "pro",
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
      const built = proposeCalls.map((call) => ({
        name: call.functionCall.name,
        check: buildDraftChecked(call.functionCall.name, call.functionCall.args ?? {}),
      }));
      // 참조 ID 실존 검증 — 모델이 지어낸 projectId 등이 카드에 실리는 걸 막는다
      // (2026-07-14 라이브 실측: 미존재 프로젝트명에 가짜 id "unreal-…-123"을 만들어 카드 발행).
      // 스키마 통과분도 참조가 죽어 있으면 실패로 강등해 기존 재시도 루프를 태운다.
      for (const b of built) {
        if (!b.check.ok) continue;
        const refError = await verifyDraftRefs(b.check.draft);
        if (refError) b.check = refError;
      }
      // 성공분을 누적(중복 제거) + 라벨 해석.
      for (const b of built) {
        if (!b.check.ok) continue;
        const key = JSON.stringify(b.check.draft);
        if (seenDraftKeys.has(key)) continue;
        seenDraftKeys.add(key);
        capturedDrafts.push(b.check.draft);
        capturedLabels.push(await resolveDraftLabels(user, b.check.draft));
      }
      const failures = built
        .map((b) => b.check)
        .filter((c): c is Extract<DraftCheck, { ok: false }> => !c.ok);

      // ── 검증 실패 피드백 루프 ──
      // 실패가 있고 아직 재시도 전이면, zod 오류(필드·사유)를 functionResponse.error로 되돌려
      // 1라운드 교정 재시도(막다른 고정 답 방지). 같은 턴에 섞인 read/미지 호출도 응답을 채워
      // "미응답 functionCall" 거부를 막는다. 이미 성공한 draft는 위에서 누적돼 유실되지 않는다.
      if (failures.length > 0 && !proposeRetried) {
        proposeRetried = true;
        contents.push({ role: "model", parts });
        const responseParts: GeminiPart[] = [];
        for (const b of built) {
          responseParts.push({
            functionResponse: {
              name: b.name,
              response: b.check.ok
                ? {
                    result: {
                      accepted: true,
                      note: "이 항목은 확인 카드로 준비됐다. 다시 제안하지 말고, 오류가 난 다른 항목만 고쳐 호출하라.",
                    },
                  }
                : { error: b.check.modelError },
            },
          });
        }
        for (const call of calls) {
          const nm = call.functionCall.name;
          if (nm in PROPOSE_TO_KIND) continue; // 위에서 처리
          if (COPILOT_READ_TOOL_NAMES.has(nm)) {
            try {
              const result = await runCopilotReadTool(nm, call.functionCall.args ?? {}, user, now);
              for (const s of result.sources) sourceMap.set(s.href, s);
              responseParts.push({ functionResponse: { name: nm, response: { result: result.data } } });
            } catch (e) {
              responseParts.push({
                functionResponse: {
                  name: nm,
                  response: { error: e instanceof Error ? e.message : "도구 실행 실패" },
                },
              });
            }
          } else {
            responseParts.push({
              functionResponse: { name: nm, response: { error: "알 수 없는 도구입니다." } },
            });
          }
        }
        // 오류만 돌려주면 flash가 교정 호출 대신 "다시 시도하겠다"는 설명 텍스트로 턴을 끝내는
        // 실측 회귀(2026-07-14) — 같은 user 턴에 명시 지시를 함께 실어 즉시 교정 호출을 강제한다.
        responseParts.push({
          text: "위 오류를 반영해 지금 즉시 교정된 propose_* 도구를 호출하라. 설명 텍스트만 반환하지 마라. 마일스톤인데 프로젝트를 특정할 수 없으면 propose_create_task로 바꿔 호출하라.",
        });
        contents.push({ role: "user", parts: responseParts });
        continue; // 다음 라운드에서 모델이 교정
      }

      // 확정 emit(재시도 소진 또는 실패 없음). 성공 누적분을 카드로, 남은 실패는
      // ⑴ 마일스톤(projectId 부재)이면 서버가 작업 카드로 결정적 변환, ⑵ 그 외는 구체 문구로.
      const residualHints: string[] = [];
      for (const f of failures) {
        const converted = convertMilestoneFailureToTask(f);
        if (converted) {
          const key = JSON.stringify(converted);
          if (!seenDraftKeys.has(key)) {
            seenDraftKeys.add(key);
            capturedDrafts.push(converted);
            capturedLabels.push(await resolveDraftLabels(user, converted));
          }
          residualHints.push(
            `"${converted.title}"은(는) 프로젝트가 없어 마일스톤 대신 작업(할 일) 카드로 준비했습니다.`,
          );
        } else if (f.userHint) {
          residualHints.push(f.userHint);
        }
      }
      return finalizeCopilotProposal({
        drafts: capturedDrafts,
        labels: capturedLabels,
        failureHints: residualHints,
        modelText: collectText(parts),
        messages,
        sources: dedupeSources(sourceMap),
      });
    }

    const readCalls = calls.filter((p) => COPILOT_READ_TOOL_NAMES.has(p.functionCall.name));
    if (readCalls.length === 0) {
      // 도구 호출 없음 = 최종 답변(텍스트). 단, 앞선 재시도에서 확정된 카드가 있으면 그것을 함께 낸다.
      if (capturedDrafts.length > 0) {
        return finalizeCopilotProposal({
          drafts: capturedDrafts,
          labels: capturedLabels,
          failureHints: [],
          modelText: collectText(parts),
          messages,
          sources: dedupeSources(sourceMap),
        });
      }
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

  // 라운드 소진 — 앞선 재시도에서 확정된 카드가 있으면 그것을 낸다(요약 재요청보다 우선 — 카드 유실 방지).
  if (capturedDrafts.length > 0) {
    return finalizeCopilotProposal({
      drafts: capturedDrafts,
      labels: capturedLabels,
      failureHints: [],
      modelText: "",
      messages,
      sources: dedupeSources(sourceMap),
    });
  }
  // 마지막으로 도구 없이 한 번 더 요약을 요청한다(무한 루프 방지).
  const finalCandidate = await generateWithTools({
    systemInstruction: systemPromptFor(new Date()),
    contents,
    functionDeclarations: COPILOT_READ_TOOL_DECLARATIONS, // 마지막엔 쓰기 제안 없이 정리만
    model: "pro",
  });
  const text = collectText(finalCandidate.parts ?? []) || "해당 데이터를 찾지 못했습니다.";
  return { text, sources: dedupeSources(sourceMap) };
}

/**
 * 확정된 propose draft들을 확인 카드 응답으로 마무리한다. 두 가지 가드를 유지·통합한다:
 *  ⑴ 프로젝트 필수 확인(projectId 없는 create_task는 카드로 내보내지 않고 되묻는다 — 2026-07-12 확정),
 *  ⑵ 검증 실패로 카드를 못 만든 항목은 구체 부족-사유(failureHints)로 안내(막다른 고정 문구 금지).
 */
async function finalizeCopilotProposal(params: {
  drafts: CopilotDraft[];
  labels: CopilotDraftLabels[];
  failureHints: string[];
  modelText: string;
  messages: CopilotMessage[];
  sources: CopilotSource[];
}): Promise<CopilotReply> {
  const { drafts, labels, failureHints, modelText, messages, sources } = params;
  const failureText = failureHints.filter(Boolean).join("\n");

  // ⑴ 프로젝트 필수 확인 가드. 예외는 사용자가 대화에서 "프로젝트 없이"를 명시했을 때뿐.
  const userSaidNoProject = messages.some(
    (m) => m.role === "user" && /프로젝트\s*(없이|없음|무관|안\s*넣어)/.test(m.text),
  );
  const held = userSaidNoProject
    ? []
    : drafts.map((d, i) => ({ d, i })).filter(({ d }) => d.kind === "create_task" && !d.projectId);

  if (held.length > 0) {
    const heldTitles = held
      .map(({ d }) => (d.kind === "create_task" ? `"${d.title}"` : ""))
      .join(", ");
    const heldIdx = new Set(held.map(({ i }) => i));
    const readyDrafts = drafts.filter((_, i) => !heldIdx.has(i));
    const readyLabels = labels.filter((_, i) => !heldIdx.has(i));
    const candidates = await activeProjectCandidates();
    const ask =
      `${heldTitles} — 어느 프로젝트에 넣을까요?\n` +
      (candidates.length > 0 ? `후보: ${candidates.join(" · ")}\n` : "") +
      `프로젝트 없이 두려면 "프로젝트 없이"라고 답해 주세요.`;
    const text = [
      readyDrafts.length > 0 ? `${readyDrafts.length}건은 아래 카드로 준비했습니다.` : "",
      ask,
      failureText,
    ]
      .filter(Boolean)
      .join("\n");
    return {
      text,
      sources,
      drafts: readyDrafts.length > 0 ? readyDrafts : undefined,
      draftLabelsList: readyDrafts.length > 0 ? readyLabels : undefined,
    };
  }

  let text: string;
  if (drafts.length > 0) {
    text =
      modelText ||
      (drafts.length > 1
        ? `아래 ${drafts.length}건을 준비했습니다. 각각 확인 후 실행하세요.`
        : "아래 내용을 준비했습니다. 확인 후 실행하세요.");
    if (failureText) text = `${text}\n${failureText}`;
  } else {
    // 성공 draft가 하나도 없다 — 구체 부족-사유로 안내(고정 "정보 부족" 막다른 답 금지).
    text =
      failureText ||
      modelText ||
      "요청을 이해했지만 확인 카드를 만들 정보가 부족합니다. 조금 더 구체적으로 알려주세요.";
  }
  return {
    text,
    sources,
    drafts: drafts.length > 0 ? drafts : undefined,
    draftLabelsList: drafts.length > 0 ? labels : undefined,
  };
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

/** propose_* args 검증 결과. 실패면 모델에 되돌릴 오류(modelError)와 사용자 안내(userHint)를 함께 담고,
 *  서버측 결정적 변환(마일스톤→작업)을 위해 kind·rawArgs·issues 원본도 보존한다. */
type DraftCheck =
  | { ok: true; draft: CopilotDraft }
  | {
      ok: false;
      toolName: string;
      kind?: CopilotDraft["kind"];
      rawArgs: Record<string, unknown>;
      issues?: DraftIssues;
      modelError: string;
      userHint: string;
    };

/**
 * propose_* args → 검증된 draft. 실패 시 draft를 조용히 버리지 않고, zod 오류를 **모델에 되돌릴 문구**와
 * **사용자에게 보여줄 부족-사유 문구**로 변환한다(막다른 고정 답 방지 — 재시도 루프의 재료).
 */
function buildDraftChecked(toolName: string, rawArgs: Record<string, unknown>): DraftCheck {
  const kind = PROPOSE_TO_KIND[toolName];
  if (!kind) {
    return {
      ok: false,
      toolName,
      rawArgs,
      modelError: `알 수 없는 제안 도구: ${toolName}`,
      userHint: "",
    };
  }
  const parsed = copilotDraftSchema.safeParse({ ...rawArgs, kind });
  if (parsed.success) return { ok: true, draft: parsed.data };
  const issues = parsed.error.issues;
  return {
    ok: false,
    toolName,
    kind,
    rawArgs,
    issues,
    modelError: describeModelError(kind, issues),
    userHint: describeUserHint(kind, issues),
  };
}

/** kind → propose 도구명(역매핑, verifyDraftRefs 실패 보고용). */
const KIND_TO_PROPOSE = Object.fromEntries(
  Object.entries(PROPOSE_TO_KIND).map(([tool, kind]) => [kind, tool]),
) as Record<CopilotDraft["kind"], string>;

/**
 * 스키마를 통과한 draft의 **참조 ID 실존**을 검증한다(모델이 지어낸 id 방어).
 * 죽은 참조가 있으면 실패 DraftCheck로 강등해 기존 재시도 루프(functionResponse.error)를 태운다 —
 * 사람이 카드에서 가짜 id를 실행해 core 오류를 맞는 경로를 서버가 먼저 끊는다.
 * 실존하는 참조만 통과시키므로 권한 상승과 무관(실행 시 core가 권한을 재검증한다).
 */
async function verifyDraftRefs(
  draft: CopilotDraft,
): Promise<Extract<DraftCheck, { ok: false }> | null> {
  const db = await getDb();
  const missing: string[] = [];
  const hints: string[] = [];
  const hasUser = (id?: string) => !id || db.users.some((u) => u.id === id);
  const hasProject = (id?: string) => !id || db.projects.some((p) => p.id === id);
  if (draft.kind === "create_task" || draft.kind === "create_milestone") {
    if (!hasProject("projectId" in draft ? draft.projectId : undefined)) {
      missing.push(
        `projectId '${draft.projectId}'는 존재하지 않는다. get_project_status나 search_items로 실제 id를 찾아라. 그 이름의 프로젝트가 정말 없으면 propose_create_project로 프로젝트 생성을 먼저 제안하라.`,
      );
      hints.push(
        "말씀하신 프로젝트를 찾지 못했습니다. 정확한 프로젝트 이름을 알려주시거나, 새 프로젝트로 만들어 드릴까요?",
      );
    }
  }
  if (draft.kind === "create_task" && !hasUser(draft.assigneeId)) {
    missing.push(`assigneeId '${draft.assigneeId}'는 존재하지 않는다. 모르면 비워라(본인 배정).`);
    hints.push("담당자를 찾지 못했습니다. 팀원 이름을 다시 알려주세요.");
  }
  if (draft.kind === "create_project") {
    if (draft.clientId && !db.clients.some((c) => c.id === draft.clientId)) {
      missing.push(`clientId '${draft.clientId}'는 존재하지 않는다. list_clients로 실제 id를 찾거나 비워라.`);
      hints.push("말씀하신 클라이언트를 찾지 못했습니다.");
    }
    if (!hasUser(draft.ownerId)) {
      missing.push(`ownerId '${draft.ownerId}'는 존재하지 않는다. 모르면 비워라(본인).`);
      hints.push("담당자를 찾지 못했습니다.");
    }
  }
  if (
    (draft.kind === "change_status" || draft.kind === "help_request") &&
    !db.tasks.some((t) => t.id === draft.taskId)
  ) {
    missing.push(`taskId '${draft.taskId}'는 존재하지 않는다. search_items나 get_my_today로 실제 id를 찾아라.`);
    hints.push("대상 작업을 찾지 못했습니다. 작업 이름을 알려주세요.");
  }
  if (draft.kind === "help_request") {
    const dead = draft.helpUserIds.filter((id) => !db.users.some((u) => u.id === id));
    if (dead.length > 0) {
      missing.push(`helpUserIds ${dead.map((d) => `'${d}'`).join(", ")}는 존재하지 않는다.`);
      hints.push("도움을 요청할 팀원을 찾지 못했습니다.");
    }
  }
  if (missing.length === 0) return null;
  return {
    ok: false,
    toolName: KIND_TO_PROPOSE[draft.kind],
    kind: draft.kind,
    rawArgs: draft as unknown as Record<string, unknown>,
    modelError: `참조 검증 실패 — ${missing.join(" ")}`,
    userHint: hints.join(" "),
  };
}

/**
 * projectId 부재로 탈락한 create_milestone 제안을 create_task draft로 결정적으로 변환한다.
 * 배경(2026-07-14 라이브 실측): "회의 잡아줘, 프로젝트 없음" 요청에서 flash가 마일스톤 제안을
 * 고집하고, 오류 피드백을 받아도 교정 호출 대신 설명 텍스트만 반환해 카드가 영영 안 나왔다.
 * 확인 카드 자체가 사람의 확인 절차이므로, 서버가 안전하게 작업 카드로 바꿔 제시한다
 * (projectId 없는 task는 finalize의 프로젝트 확인 가드가 기존대로 되묻는다 — 가드 우회 아님).
 */
function convertMilestoneFailureToTask(
  f: Extract<DraftCheck, { ok: false }>,
): Extract<CopilotDraft, { kind: "create_task" }> | null {
  if (f.kind !== "create_milestone" || !f.issues || !issuesTouch(f.issues, "projectId")) return null;
  const title = typeof f.rawArgs.title === "string" ? f.rawArgs.title : undefined;
  const dueAt = typeof f.rawArgs.dueAt === "string" ? f.rawArgs.dueAt : undefined;
  if (!title || !dueAt) return null;
  const parsed = createTaskDraftSchema.safeParse({
    kind: "create_task",
    title,
    startAt: dueAt,
    endAt: dueAt,
    ...(typeof f.rawArgs.description === "string" && { description: f.rawArgs.description }),
  });
  return parsed.success ? parsed.data : null;
}

/** zod 파싱 실패 시 issues 배열 타입(버전 독립 — ZodError에서 유도). */
type DraftIssues = z.ZodError["issues"];

/** zod 이슈 경로에 특정 필드가 포함되는지. */
function issuesTouch(issues: DraftIssues, field: string): boolean {
  return issues.some((i) => i.path.includes(field));
}

/** 모델에 되돌릴 오류 문구(필드·사유 + 교정 힌트). functionResponse.error로 실어 1라운드 재시도를 유도한다. */
function describeModelError(kind: CopilotDraft["kind"], issues: DraftIssues): string {
  const fields = issues
    .map((i) => {
      const path = i.path.filter((p) => p !== "kind").join(".") || "(값)";
      return `${path}: ${i.message}`;
    })
    .join("; ");
  let extra = "";
  if (kind === "create_milestone" && issuesTouch(issues, "projectId")) {
    extra =
      " 마일스톤은 projectId가 필수다. 프로젝트를 특정할 수 없으면 propose_create_milestone 대신 propose_create_task로 만들어라(회의·일정 요청도 작업으로).";
  }
  return `검증 실패 — ${fields}.${extra} 올바른 인자로 다시 호출하거나, 필요한 정보를 사용자에게 물어라.`;
}

/** 재시도 후에도 실패가 남을 때 사용자에게 보여줄 구체 문구(고정 "정보 부족" 문구 대체). */
function describeUserHint(kind: CopilotDraft["kind"], issues: DraftIssues): string {
  const touch = (f: string) => issuesTouch(issues, f);
  if (kind === "create_milestone") {
    if (touch("projectId"))
      return "마일스톤은 프로젝트가 필수입니다. 어느 프로젝트의 마일스톤인지 알려주시거나, 프로젝트 없이 진행하려면 작업(할 일)으로 만들어 드릴까요?";
    if (touch("dueAt")) return "마일스톤 기한(마감일)이 필요합니다. 언제까지인지 알려주세요.";
    if (touch("title")) return "마일스톤 제목이 필요합니다.";
  }
  if (kind === "create_task" && touch("title"))
    return "작업 제목이 필요합니다. 무슨 작업인지 알려주세요.";
  if (kind === "create_project" && touch("name")) return "프로젝트 이름이 필요합니다.";
  if (kind === "change_status") {
    if (touch("taskId")) return "어떤 작업의 상태를 바꿀지 알려주세요.";
    if (touch("to")) return "어떤 상태로 바꿀지 알려주세요(예: 완료, 홀드).";
  }
  if (kind === "help_request") {
    if (touch("helpUserIds")) return "누구에게 도움을 요청할지 알려주세요.";
    if (touch("taskId")) return "어떤 작업에 대한 도움 요청인지 알려주세요.";
  }
  return "요청을 확인 카드로 만들기에 정보가 부족합니다. 조금 더 구체적으로 알려주세요.";
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
