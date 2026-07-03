import { z } from "zod";
import { withApi } from "@/lib/api/respond";
import { getDb } from "@/lib/db";
import { getPaymentData } from "@/lib/payment-data";

/** 결제 목록 — 웹과 동일한 마스킹 계층(getPaymentData)을 거친다.
 *  원본 계좌/금액은 관리자·요청자 본인 외에는 응답에 포함되지 않는다. */
export async function GET(request: Request) {
  return withApi(request, async ({ user }) => Response.json(await getPaymentData(user)));
}

const createSchema = z.object({
  title: z.string(),
  bankName: z.string(),
  accountNumber: z.string(),
  amount: z.number(),
  description: z.string().optional(),
  dueAt: z.string().optional(),
  category: z.string(),
});

/** 결제 요청 등록 — MCP create_payment_request 도구의 백엔드. */
export async function POST(request: Request) {
  return withApi(request, async ({ user, via }) => {
    const body = createSchema.parse(await request.json());
    const payment = (await getDb()).createPaymentRequest({ actorId: user.id, via }, body);
    return Response.json({ payment }, { status: 201 });
  });
}
