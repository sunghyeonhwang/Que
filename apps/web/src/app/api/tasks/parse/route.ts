import { z } from "zod";
import { parseTaskInput } from "@que/core";
import { withApi } from "@/lib/api/respond";
import { loadReadOnlyDb } from "@/lib/db";

const bodySchema = z.object({ text: z.string().min(1).max(500) });

/** 자연어 작업 해석 — MCP parse_task_input 도구의 백엔드.
 *  저장하지 않는다. 결과(초안+질문)를 사용자에게 확인받은 뒤 POST /api/tasks로 등록한다. */
export async function POST(request: Request) {
  return withApi(request, async () => {
    const body = bodySchema.parse(await request.json());
    // 담당자 해석 명단은 db.users(재직자만) — 읽기 전용 로더라 스케줄러/쓰기를 유발하지 않는다.
    // db.users는 비활성을 포함하므로 active !== false로 걸러 비활성이 담당자로 해석되지 않게 한다.
    const db = await loadReadOnlyDb();
    const activeUsers = db.users.filter((u) => u.active !== false);
    return Response.json({ draft: parseTaskInput({ text: body.text, users: activeUsers }) });
  });
}
