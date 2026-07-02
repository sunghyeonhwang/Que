import { withApi } from "@/lib/api/respond";
import { getDb } from "@/lib/db";

/** Action 후보 → Task 확정 — MCP confirm_action 도구의 백엔드.
 *  담당자·마감일 없으면 core가 422로 거부한다. */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ actionItemId: string }> },
) {
  return withApi(request, async ({ user, via }) => {
    const { actionItemId } = await params;
    const task = getDb().confirmActionItem({ actorId: user.id, via }, actionItemId);
    return Response.json({ task }, { status: 201 });
  });
}
