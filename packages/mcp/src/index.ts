import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import {
  checkInResponseSchema,
  paymentStatusSchema,
  statusDetailSchema,
  taskStatusSchema,
} from "@que/core";
import { api, QueApiError, requireToken } from "./api-client.js";

// Que MCP 서버 — 사용자가 자신의 AI와 대화하며 Que를 조회/조작한다.
// 모든 변경은 웹 API → core 규칙을 거치므로 웹과 동일한 권한·검증·로그가 적용된다.
// (도구 명세: data/docs/que-mcp-cli-plan.md)

const server = new McpServer({ name: "que", version: "0.1.0" });

type ToolResult = {
  content: { type: "text"; text: string }[];
  isError?: boolean;
};

function ok(data: unknown): ToolResult {
  return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
}

/** QueApiError를 AI가 이해할 수 있는 구조적 에러 텍스트로 변환한다. */
async function run(fn: () => Promise<unknown>): Promise<ToolResult> {
  try {
    return ok(await fn());
  } catch (error) {
    if (error instanceof QueApiError) {
      return {
        isError: true,
        content: [
          {
            type: "text",
            text: JSON.stringify({ error: { code: error.code, message: error.message } }),
          },
        ],
      };
    }
    throw error;
  }
}

// ---------- 조회 도구 ----------

server.registerTool(
  "get_me",
  {
    description: "현재 토큰의 사용자 정보를 조회한다.",
    annotations: { readOnlyHint: true },
  },
  () => run(() => api.get("/api/me")),
);

server.registerTool(
  "get_my_day",
  {
    description:
      "오늘 화면 요약 — 내 작업 타임라인, 응답 대기 체크인, 마감 임박, 내가 관련된 문제/홀드.",
    annotations: { readOnlyHint: true },
  },
  () => run(() => api.get("/api/my-day")),
);

server.registerTool(
  "get_now_board",
  {
    description: "Now 운영표 — 오늘 캘린더 항목과 회의록 Action 후보를 한 표로 조회한다.",
    inputSchema: { filter: z.enum(["all", "mine", "issue"]).optional() },
    annotations: { readOnlyHint: true },
  },
  ({ filter }) => run(() => api.get(`/api/now${filter ? `?filter=${filter}` : ""}`)),
);

server.registerTool(
  "get_team_status",
  {
    description:
      "팀 현황 — 진행중/문제/홀드/마감 임박/응답 대기 요약, 사람별 오늘 시간표, Attention Queue, 일정 충돌.",
    annotations: { readOnlyHint: true },
  },
  () => run(() => api.get("/api/team")),
);

server.registerTool(
  "list_clients",
  {
    description:
      "거래처(클라이언트) 목록 조회. 반환된 id를 list_tasks의 client 인자로 넘겨 거래처별 작업을 필터할 수 있다.",
    annotations: { readOnlyHint: true },
  },
  () => run(() => api.get("/api/clients")),
);

server.registerTool(
  "list_tasks",
  {
    description:
      "작업 목록 조회. 담당자/프로젝트/상태/거래처로 필터할 수 있다. 각 작업에 거래처·프로젝트명(projectLabel)이 함께 온다.",
    inputSchema: {
      assignee: z.string().optional().describe("담당자 userId"),
      project: z.string().optional().describe("프로젝트 id"),
      client: z.string().optional().describe("클라이언트(거래처) id — list_clients로 조회"),
      status: taskStatusSchema.optional(),
    },
    annotations: { readOnlyHint: true },
  },
  ({ assignee, project, client, status }) =>
    run(() => {
      const params = new URLSearchParams();
      if (assignee) params.set("assignee", assignee);
      if (project) params.set("project", project);
      if (client) params.set("client", client);
      if (status) params.set("status", status);
      const query = params.toString();
      return api.get(`/api/tasks${query ? `?${query}` : ""}`);
    }),
);

server.registerTool(
  "list_action_candidates",
  {
    description: "회의록에서 추출된 Action 후보 목록. 확인 필요(담당자/마감 누락) 항목 포함.",
    inputSchema: { meetingNoteId: z.string().optional() },
    annotations: { readOnlyHint: true },
  },
  ({ meetingNoteId }) =>
    run(() => api.get(`/api/action-items${meetingNoteId ? `?note=${meetingNoteId}` : ""}`)),
);

server.registerTool(
  "list_payment_requests",
  {
    description:
      "결제 요청 목록. 계좌번호/금액은 권한(관리자·요청자 본인)에 따라 마스킹되어 반환된다.",
    annotations: { readOnlyHint: true },
  },
  () => run(() => api.get("/api/payments")),
);

server.registerTool(
  "list_task_comments",
  {
    description: "작업의 댓글/도움 요청 목록을 조회한다.",
    inputSchema: { taskId: z.string() },
    annotations: { readOnlyHint: true },
  },
  ({ taskId }) => run(() => api.get(`/api/tasks/${taskId}/comments`)),
);

server.registerTool(
  "parse_task_input",
  {
    description:
      "자연어 작업 입력을 해석해 초안(제목/담당자/일시)과 확인 질문을 반환한다. 저장하지 않는다 — 초안을 사용자에게 보여주고 확인받은 뒤 create_task를 호출하라.",
    inputSchema: { text: z.string().min(1).max(500) },
    annotations: { readOnlyHint: true },
  },
  ({ text }) => run(() => api.post("/api/tasks/parse", { text })),
);

// ---------- 변경 도구 ----------

server.registerTool(
  "create_task",
  {
    description:
      "확인된 초안으로 작업을 생성한다. 반드시 parse_task_input 결과를 사용자에게 확인받은 뒤 호출하라. assigneeId를 생략하면 본인 작업이 된다.",
    inputSchema: {
      title: z.string().min(1).max(200),
      assigneeId: z.string().optional(),
      projectId: z.string().optional(),
      startAt: z.string().optional().describe("ISO 8601"),
      endAt: z.string().optional().describe("ISO 8601"),
      description: z.string().optional(),
      estimatedHours: z.number().optional(),
    },
  },
  (input) => run(() => api.post("/api/tasks", { ...input, source: "natural_language" })),
);

server.registerTool(
  "change_task_status",
  {
    description:
      "작업 상태 변경. 문제발생(issue)/홀드(on_hold)는 detail.reason이 필수다 — 없으면 사용자에게 사유를 물어본 뒤 호출하라. 병합(merged)은 mergedIntoTaskId가 필수다 — list_tasks로 대상을 찾아 사용자에게 확인받아라.",
    inputSchema: {
      taskId: z.string(),
      to: taskStatusSchema,
      detail: statusDetailSchema.optional(),
      mergedIntoTaskId: z.string().optional().describe("to가 merged일 때 필수 — 병합 대상 작업 id"),
    },
  },
  ({ taskId, to, detail, mergedIntoTaskId }) =>
    run(() => api.post(`/api/tasks/${taskId}/status`, { to, detail, mergedIntoTaskId })),
);

server.registerTool(
  "move_task",
  {
    description: "작업 일정 이동. startAt/endAt은 ISO 8601 문자열, 시작≤종료여야 한다.",
    inputSchema: { taskId: z.string(), startAt: z.string(), endAt: z.string() },
  },
  ({ taskId, startAt, endAt }) =>
    run(() => api.post(`/api/tasks/${taskId}/move`, { startAt, endAt })),
);

server.registerTool(
  "respond_checkin",
  {
    description:
      "자동 체크인에 응답한다 (작업중/완료/시간변경/문제발생/필요없어짐/병합/나중에). issue 응답은 detail.reason 필수. '나중에(later)' 응답 시 snoozeUntil(ISO 8601, 지금부터 48시간 이내)을 주면 그 시각까지 응답대기에서 빠졌다가 자동 재노출된다.",
    inputSchema: {
      checkInId: z.string(),
      response: checkInResponseSchema,
      detail: statusDetailSchema.optional(),
      snoozeUntil: z
        .string()
        .optional()
        .describe("later 응답일 때만 유효 — 다시 물어볼 시각(ISO 8601, now+48h 이내)"),
    },
  },
  ({ checkInId, response, detail, snoozeUntil }) =>
    run(() => api.post(`/api/checkins/${checkInId}/answer`, { response, detail, snoozeUntil })),
);

server.registerTool(
  "reassign_task",
  {
    description:
      "작업 담당자를 변경한다. 본인·작업 소유자·프로젝트 담당·관리자만 가능(서버가 강제). 미응답 체크인은 새 담당자로 함께 넘어간다.",
    inputSchema: {
      taskId: z.string(),
      assigneeId: z.string().describe("새 담당자 userId — list_tasks/get_team_status로 확인"),
    },
    annotations: { destructiveHint: true },
  },
  ({ taskId, assigneeId }) =>
    run(() => api.patch(`/api/tasks/${taskId}`, { assigneeId })),
);

server.registerTool(
  "cancel_task",
  {
    description:
      "작업을 취소(cancelled) 상태로 바꾼다. hard delete가 아니라 soft — 데이터·이력은 보존되고 나중에 change_task_status로 복구할 수 있다. 응답의 previousStatus가 복구 대상 상태다. 취소 전 사용자에게 확인받아라.",
    inputSchema: {
      taskId: z.string(),
      reason: z.string().optional().describe("취소 사유(선택) — ChangeLog·StatusLog에 남는다"),
    },
    annotations: { destructiveHint: true },
  },
  ({ taskId, reason }) =>
    run(() =>
      api.del(`/api/tasks/${taskId}`, reason !== undefined ? { reason } : undefined),
    ),
);

server.registerTool(
  "update_action_item",
  {
    description: "Action 후보의 담당자/마감일/프로젝트를 지정한다. 확정 전 필드 보완용.",
    inputSchema: {
      actionItemId: z.string(),
      assigneeId: z.string().optional(),
      dueAt: z.string().optional().describe("ISO 8601"),
      projectId: z.string().optional(),
    },
  },
  ({ actionItemId, ...body }) => run(() => api.patch(`/api/action-items/${actionItemId}`, body)),
);

server.registerTool(
  "confirm_action",
  {
    description:
      "Action 후보를 실제 Task로 확정한다. 담당자와 마감일이 모두 있어야 하며, 없으면 서버가 거부한다 — 먼저 update_action_item으로 채워라.",
    inputSchema: { actionItemId: z.string() },
  },
  ({ actionItemId }) => run(() => api.post(`/api/action-items/${actionItemId}/confirm`)),
);

server.registerTool(
  "resolve_action",
  {
    description: "Action 후보를 보류(held)하거나 무시(ignored)한다. 무시는 되돌리기 어렵다 — 사용자 확인 후 호출하라.",
    inputSchema: { actionItemId: z.string(), to: z.enum(["held", "ignored"]) },
    annotations: { destructiveHint: true },
  },
  ({ actionItemId, to }) => run(() => api.post(`/api/action-items/${actionItemId}/status`, { to })),
);

server.registerTool(
  "add_task_comment",
  {
    description:
      "작업에 댓글을 남긴다. 타인의 작업(수정 권한 없음)에도 가능 — 수정 대신 의견을 전달하는 통로다. helpUserId를 지정하면 도움 요청이 되어 대상자의 오늘 화면과 팀 현황에 노출된다.",
    inputSchema: {
      taskId: z.string(),
      body: z.string().min(1).max(1000),
      helpUserId: z.string().optional().describe("도움을 요청할 사용자 id"),
    },
  },
  ({ taskId, ...input }) => run(() => api.post(`/api/tasks/${taskId}/comments`, input)),
);

server.registerTool(
  "create_payment_request",
  {
    description: "결제 요청을 등록한다 (기본 상태: 대기). 등록 전에 사용자에게 내용을 확인받아라.",
    inputSchema: {
      title: z.string(),
      recipientName: z.string().optional().describe("입금받을 곳 (상호/사람/기관명)"),
      bankName: z.string(),
      accountNumber: z.string(),
      amount: z.number(),
      description: z.string().optional(),
      dueAt: z.string().optional().describe("ISO 8601"),
      category: z.string(),
    },
  },
  (input) => run(() => api.post("/api/payments", input)),
);

server.registerTool(
  "update_payment_status",
  {
    description:
      "결제 요청 상태 변경 (waiting/done/cancelled). 완료 처리는 관리자만, 취소는 요청자 본인도 가능 — 서버가 강제한다.",
    inputSchema: { paymentId: z.string(), to: paymentStatusSchema },
    annotations: { destructiveHint: true },
  },
  ({ paymentId, to }) => run(() => api.post(`/api/payments/${paymentId}/status`, { to })),
);

// ---------- 기동 ----------

requireToken(); // 토큰 없이 뜨는 것을 조기에 막는다
await server.connect(new StdioServerTransport());
console.error("[que-mcp] 서버 시작 — API:", process.env.QUE_API_URL ?? "http://localhost:3000");
