import { z } from "zod";
import { withApi } from "@/lib/api/respond";
import { getDb } from "@/lib/db";

const bodySchema = z.object({ to: z.enum(["held", "ignored"]) });

/** Action 후보 보류/무시 — MCP hold_action / ignore_action 도구의 백엔드. */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ actionItemId: string }> },
) {
  return withApi(request, async ({ user, via }) => {
    const { actionItemId } = await params;
    const body = bodySchema.parse(await request.json());
    const item = getDb().setActionItemStatus(
      { actorId: user.id, via },
      { actionItemId, to: body.to },
    );
    return Response.json({ actionItem: item });
  });
}
