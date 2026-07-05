import { z } from "zod";
import { checkInResponseSchema, statusDetailSchema } from "@que/core";
import { withApi } from "@/lib/api/respond";
import { getDb } from "@/lib/db";

const bodySchema = z.object({
  response: checkInResponseSchema,
  detail: statusDetailSchema.optional(),
  /** response가 later일 때만 유효 — 다시 물어볼 시각(ISO 8601, now+48h 이내). core가 검증한다. */
  snoozeUntil: z.string().optional(),
});

/** 체크인 응답 — MCP respond_checkin 도구의 백엔드. Slack Bot(2단계)도 이 경로를 쓴다. */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ checkInId: string }> },
) {
  return withApi(request, async ({ user, via }) => {
    const { checkInId } = await params;
    const body = bodySchema.parse(await request.json());
    const db = await getDb();
    const checkIn = db.answerCheckIn(
      { actorId: user.id, via },
      {
        checkInId,
        response: body.response,
        detail: body.detail,
        snoozeUntil: body.snoozeUntil,
      },
    );
    await db.persist();
    return Response.json({ checkIn });
  });
}
