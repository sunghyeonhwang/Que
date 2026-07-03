import { z } from "zod";
import { paymentStatusSchema } from "@que/core";
import { withApi } from "@/lib/api/respond";
import { getDb } from "@/lib/db";

const bodySchema = z.object({ to: paymentStatusSchema });

/** 결제 상태 변경 — 관리자 전체 / 요청자 본인 취소만 (core 강제). */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ paymentId: string }> },
) {
  return withApi(request, async ({ user, via }) => {
    const { paymentId } = await params;
    const body = bodySchema.parse(await request.json());
    const db = await getDb();
    const payment = db.updatePaymentStatus(
      { actorId: user.id, via },
      { paymentId, to: body.to },
    );
    await db.persist();
    return Response.json({ payment });
  });
}
