import { z } from "zod";
import { withApi } from "@/lib/api/respond";
import { getDb } from "@/lib/db";

const bodySchema = z.object({
  startAt: z.string(),
  endAt: z.string(),
});

/** 작업 일정 이동 — MCP move_schedule 도구의 백엔드. 날짜 검증은 core parseScheduleRange. */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ taskId: string }> },
) {
  return withApi(request, async ({ user, via }) => {
    const { taskId } = await params;
    const body = bodySchema.parse(await request.json());
    const task = getDb().moveTask({ actorId: user.id, via }, { taskId, ...body });
    return Response.json({ task });
  });
}
