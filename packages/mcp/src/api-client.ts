// Que API 클라이언트 — MCP 서버는 웹 API를 통해서만 데이터에 접근한다.
// (별도 프로세스라 웹의 인메모리 DB를 공유할 수 없다 — API-first의 이유)
//
// 환경 변수:
//   QUE_API_URL  기본 http://localhost:3000
//   QUE_TOKEN    필수 — Personal Access Token (mock: que_pat_<userId>)

export class QueApiError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

const BASE_URL = process.env.QUE_API_URL ?? "http://localhost:3000";
const TOKEN = process.env.QUE_TOKEN;

export function requireToken(): string {
  if (!TOKEN) {
    throw new Error(
      "QUE_TOKEN 환경 변수가 필요하다. mock 단계에서는 que_pat_<userId> 형식을 사용한다.",
    );
  }
  return TOKEN;
}

async function request(method: string, path: string, body?: unknown): Promise<unknown> {
  const response = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: {
      authorization: `Bearer ${requireToken()}`,
      "x-que-via": "mcp",
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

export const api = {
  get: (path: string) => request("GET", path),
  post: (path: string, body?: unknown) => request("POST", path, body),
  patch: (path: string, body: unknown) => request("PATCH", path, body),
};
