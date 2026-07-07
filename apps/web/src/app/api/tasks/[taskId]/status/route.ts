import { z } from "zod";
import { statusDetailSchema, taskStatusSchema } from "@que/core";
import { withApi } from "@/lib/api/respond";
import { getDb } from "@/lib/db";
import { notifyTaskStatusChanged } from "@/lib/notifications/dispatch";

const bodySchema = z.object({
  to: taskStatusSchema,
  detail: statusDetailSchema.optional(),
  /** to가 merged일 때 필수 — core가 강제 */
  mergedIntoTaskId: z.string().optional(),
});

/** 작업 상태 변경 — MCP change_task_status 도구의 백엔드. 규칙은 core가 강제. */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ taskId: string }> },
) {
  return withApi(request, async ({ user, via }) => {
    const { taskId } = await params;
    const body = bodySchema.parse(await request.json());
    const db = await getDb();
    const from = db.tasks.find((t) => t.id === taskId)?.status; // 변경 전 status(알림 훅용)
    const task = db.changeTaskStatus(
      { actorId: user.id, via },
      { taskId, to: body.to, detail: body.detail, mergedIntoTaskId: body.mergedIntoTaskId },
    );
    await db.persist();
    // MCP/CLI 경유 상태 변경도 웹과 동일하게 알림 훅을 태운다. 발송 실패는 응답을 막지 않는다.
    if (from) await notifyTaskStatusChanged(db, taskId, from, body.detail);
    return Response.json({ task });
  });
}
