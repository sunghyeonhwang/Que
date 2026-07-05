import { withApi } from "@/lib/api/respond";
import { getDb } from "@/lib/db";

/** 거래처(클라이언트) 목록 조회 — MCP list_clients 도구/CLI que clients 의 백엔드.
 *  조회 전용. 활성(active) 거래처의 id·name만 반환한다(status 등 내부 필드 비노출). */
export async function GET(request: Request) {
  return withApi(request, async () => {
    const clients = (await getDb()).clients
      .filter((c) => c.status === "active")
      .map((c) => ({ id: c.id, name: c.name }));
    return Response.json({ clients });
  });
}
