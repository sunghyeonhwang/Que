import { resolvePat, type ChangeVia, type User } from "@que/core";

// API 계층 인증 — MCP 서버와 CLI가 사용하는 진입점.
// Authorization: Bearer <PAT> 로 사용자를 식별하고,
// X-Que-Via 헤더(mcp|cli, 화이트리스트)로 변경 출처를 기록한다.

export interface ApiContext {
  user: User;
  via: ChangeVia;
}

export class ApiAuthError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export function authenticate(request: Request): ApiContext {
  const header = request.headers.get("authorization");
  if (!header?.startsWith("Bearer ")) {
    throw new ApiAuthError(401, "Authorization: Bearer <token> 헤더가 필요하다");
  }
  const user = resolvePat(header.slice("Bearer ".length).trim());
  if (!user) {
    throw new ApiAuthError(401, "유효하지 않은 토큰이다");
  }

  const viaHeader = request.headers.get("x-que-via");
  const via: ChangeVia = viaHeader === "mcp" ? "mcp" : "cli";

  return { user, via };
}
