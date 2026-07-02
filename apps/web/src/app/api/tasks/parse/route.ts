import { z } from "zod";
import { parseTaskInput, USERS } from "@que/core";
import { withApi } from "@/lib/api/respond";

const bodySchema = z.object({ text: z.string().min(1).max(500) });

/** 자연어 작업 해석 — MCP parse_task_input 도구의 백엔드.
 *  저장하지 않는다. 결과(초안+질문)를 사용자에게 확인받은 뒤 POST /api/tasks로 등록한다. */
export async function POST(request: Request) {
  return withApi(request, async () => {
    const body = bodySchema.parse(await request.json());
    return Response.json({ draft: parseTaskInput({ text: body.text, users: USERS }) });
  });
}
