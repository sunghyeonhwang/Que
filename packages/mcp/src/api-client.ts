// MCP 서버의 API 접근 — 공유 클라이언트(@que/core)를 env 설정으로 감싼다.
//
// 환경 변수:
//   QUE_API_URL  기본 http://localhost:3000
//   QUE_TOKEN    필수 — Personal Access Token (mock: que_pat_<userId>)

import { createQueClient, QueApiError } from "@que/core";

export { QueApiError };

export function requireToken(): string {
  const token = process.env.QUE_TOKEN;
  if (!token) {
    throw new Error(
      "QUE_TOKEN 환경 변수가 필요하다. mock 단계에서는 que_pat_<userId> 형식을 사용한다.",
    );
  }
  return token;
}

export const api = createQueClient({
  baseUrl: process.env.QUE_API_URL,
  token: process.env.QUE_TOKEN ?? "",
  via: "mcp",
});
