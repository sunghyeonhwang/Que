import { QueRuleError, type QueRuleCode } from "@que/core";
import { ZodError } from "zod";
import { ApiAuthError, authenticate, type ApiContext } from "./auth";

// API 응답 공통 처리 — QueRuleError를 코드별 HTTP 상태로 매핑한다.
// 규칙은 core가 강제하고, 이 계층은 번역만 한다.

const STATUS_BY_CODE: Record<QueRuleCode, number> = {
  NOT_FOUND: 404,
  NOT_AUTHORIZED: 403,
  EVENT_NOT_MOVABLE: 403,
  ALREADY_ANSWERED: 409,
  ACTION_ALREADY_RESOLVED: 409,
  ACTION_NEEDS_ASSIGNEE_AND_DUE: 422,
  STATUS_DETAIL_REQUIRED: 422,
  INVALID_SCHEDULE: 422,
  INVALID_INPUT: 422,
};

export function apiError(status: number, code: string, message: string): Response {
  return Response.json({ error: { code, message } }, { status });
}

/** 인증 + 에러 매핑을 감싼 핸들러 러너. */
export async function withApi(
  request: Request,
  handler: (ctx: ApiContext) => Promise<Response> | Response,
): Promise<Response> {
  try {
    const ctx = authenticate(request);
    return await handler(ctx);
  } catch (error) {
    if (error instanceof ApiAuthError) {
      return apiError(error.status, "UNAUTHORIZED", error.message);
    }
    if (error instanceof QueRuleError) {
      return apiError(STATUS_BY_CODE[error.code] ?? 400, error.code, error.message);
    }
    if (error instanceof ZodError) {
      return apiError(
        422,
        "INVALID_INPUT",
        error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join(", "),
      );
    }
    if (error instanceof SyntaxError) {
      return apiError(400, "INVALID_JSON", "본문이 유효한 JSON이 아니다");
    }
    throw error;
  }
}
