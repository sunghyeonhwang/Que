import { z } from "zod";
import { withApi } from "@/lib/api/respond";
import { getDb } from "@/lib/db";

/** 작업 댓글 목록 — MCP list_task_comments 도구의 백엔드. */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ taskId: string }> },
) {
  return withApi(request, async () => {
    const { taskId } = await params;
    const db = await getDb();
    db.requireTask(taskId); // 유령 작업이면 404
    const comments = db.taskComments.filter((c) => c.taskId === taskId);
    return Response.json({ comments });
  });
}

const bodySchema = z.object({
  body: z.string(),
  helpUserId: z.string().optional(),
});

/** 작업 댓글/도움 요청 — 팀 누구나 타인 작업에도 가능 (MCP add_task_comment 백엔드). */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ taskId: string }> },
) {
  return withApi(request, async ({ user, via }) => {
    const { taskId } = await params;
    const input = bodySchema.parse(await request.json());
    const db = await getDb();
    const comment = db.addTaskComment({ actorId: user.id, via }, { taskId, ...input });
    await db.persist();
    return Response.json({ comment }, { status: 201 });
  });
}
