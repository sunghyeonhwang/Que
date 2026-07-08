import { withApi } from "@/lib/api/respond";
import { getDb } from "@/lib/db";
import { notifyTaskCreated } from "@/lib/notifications/dispatch";

/** Action 후보 → Task 확정 — MCP confirm_action 도구의 백엔드.
 *  담당자·마감일 없으면 core가 422로 거부한다. */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ actionItemId: string }> },
) {
  return withApi(request, async ({ user, via }) => {
    const { actionItemId } = await params;
    const db = await getDb();
    const task = db.confirmActionItem({ actorId: user.id, via }, actionItemId);
    await db.persist();
    await notifyTaskCreated(db, task.id); // Action→Task 확정(MCP/CLI)도 담당자 DM
    return Response.json({ task }, { status: 201 });
  });
}
