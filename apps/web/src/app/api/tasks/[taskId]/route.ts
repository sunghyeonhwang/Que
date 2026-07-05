import { z } from "zod";
import { withApi } from "@/lib/api/respond";
import { getDb } from "@/lib/db";

// 작업 단건 조작 — MCP cancel_task/reassign_task 도구의 백엔드. 규칙은 core가 강제한다.
// DELETE = 취소(cancelled) soft delete(hard delete 아님, 이력 보존). PATCH = 담당자 재배정.

const patchSchema = z.object({
  assigneeId: z.string().min(1),
});

const deleteSchema = z.object({
  reason: z.string().optional(),
});

/** 작업 삭제 = 취소(cancelled) soft 전환. 이전 status를 함께 반환한다(실행취소용). */
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ taskId: string }> },
) {
  return withApi(request, async ({ user, via }) => {
    const { taskId } = await params;
    // 본문은 선택(reason). 없거나 비어 있어도 취소는 진행된다.
    const raw = await request.text();
    const body = raw ? deleteSchema.parse(JSON.parse(raw)) : {};
    const db = await getDb();
    const { task, previousStatus, previousStatusDetail } = db.cancelTask(
      { actorId: user.id, via },
      { taskId, reason: body.reason },
    );
    await db.persist();
    return Response.json({ task, previousStatus, previousStatusDetail });
  });
}

/** 작업 담당자 재배정. body: { assigneeId }. */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ taskId: string }> },
) {
  return withApi(request, async ({ user, via }) => {
    const { taskId } = await params;
    const body = patchSchema.parse(await request.json());
    const db = await getDb();
    const task = db.reassignTask({ actorId: user.id, via }, { taskId, assigneeId: body.assigneeId });
    await db.persist();
    return Response.json({ task });
  });
}
