import { z } from "zod";
import { withApi } from "@/lib/api/respond";
import { getDb } from "@/lib/db";

const bodySchema = z.object({
  assigneeId: z.string().optional(),
  dueAt: z.string().optional(),
  projectId: z.string().optional(),
});

/** Action 후보 필드 지정 (담당자/마감/프로젝트) — MCP 도구 백엔드. */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ actionItemId: string }> },
) {
  return withApi(request, async ({ user, via }) => {
    const { actionItemId } = await params;
    const body = bodySchema.parse(await request.json());
    const item = getDb().updateActionItem({ actorId: user.id, via }, { actionItemId, ...body });
    return Response.json({ actionItem: item });
  });
}
