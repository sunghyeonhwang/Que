import type { ChangeVia } from "./domain";

// Que API 클라이언트 — MCP 서버와 CLI가 공유한다.
// 별도 프로세스는 웹의 인메모리 DB를 공유할 수 없으므로 항상 API를 경유한다.
// 환경(env) 접근은 호출자 책임 — core는 순수하게 유지한다.

export class QueApiError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = "QueApiError";
    this.status = status;
    this.code = code;
  }
}

export interface QueClientOptions {
  baseUrl?: string;
  token: string;
  via: Extract<ChangeVia, "mcp" | "cli">;
}

export interface QueClient {
  get(path: string): Promise<unknown>;
  post(path: string, body?: unknown): Promise<unknown>;
  patch(path: string, body: unknown): Promise<unknown>;
}

export function createQueClient(options: QueClientOptions): QueClient {
  const baseUrl = options.baseUrl ?? "http://localhost:3000";

  async function request(method: string, path: string, body?: unknown): Promise<unknown> {
    const response = await fetch(`${baseUrl}${path}`, {
      method,
      headers: {
        authorization: `Bearer ${options.token}`,
        "x-que-via": options.via,
        ...(body !== undefined ? { "content-type": "application/json" } : {}),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });

    const payload = (await response.json().catch(() => null)) as
      | { error?: { code?: string; message?: string } }
      | null;

    if (!response.ok) {
      throw new QueApiError(
        response.status,
        payload?.error?.code ?? "UNKNOWN",
        payload?.error?.message ?? `API 오류 (HTTP ${response.status})`,
      );
    }
    return payload;
  }

  return {
    get: (path) => request("GET", path),
    post: (path, body) => request("POST", path, body),
    patch: (path, body) => request("PATCH", path, body),
  };
}
