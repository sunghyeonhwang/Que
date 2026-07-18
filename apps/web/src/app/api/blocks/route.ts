import { z } from "zod";
import { withApi, apiError } from "@/lib/api/respond";
import { isDayBlocksEnabled, getBlocks, upsertBlocks, deleteBlocks } from "@/lib/dayblocks";

// DayBlocks(todo.griff.co.kr) 개인 블록 저장 API. PAT Bearer 인증(withApi)·본인 스코프 강제.
// CORS는 proxy.ts가 /api/* 전역으로 처리(todo.griff.co.kr 화이트리스트) — 여기서 다루지 않는다.
// mock/dev(키 없음)는 501(SSO·패스키 선례). payload 구조는 DayBlocks 정본이라 서버는 소유·날짜만 안다.

/** YYYY-MM-DD 형식 화이트리스트. */
const DATE_KEY = /^\d{4}-\d{2}-\d{2}$/;
/** 블록 payload 건당 상한(8KB, UTF-8 바이트). */
const MAX_PAYLOAD_BYTES = 8 * 1024;
/** bulk 상한. */
const MAX_ITEMS = 100;

/** from/to 범위 검증(둘 다 필수·형식·순서·최대 31일). 위반 시 Response(에러) 반환, 통과 시 null. */
function validateRange(from: string | null, to: string | null): { from: string; to: string } | Response {
  if (!from || !to) return apiError(422, "INVALID_INPUT", "from·to 쿼리(YYYY-MM-DD)가 모두 필요하다");
  if (!DATE_KEY.test(from) || !DATE_KEY.test(to)) {
    return apiError(422, "INVALID_INPUT", "from·to는 YYYY-MM-DD 형식이어야 한다");
  }
  if (to < from) return apiError(422, "INVALID_INPUT", "to는 from 이상이어야 한다");
  const days = (Date.parse(`${to}T00:00:00`) - Date.parse(`${from}T00:00:00`)) / 86_400_000 + 1;
  if (days > 31) return apiError(422, "INVALID_INPUT", "조회 범위는 최대 31일이다");
  return { from, to };
}

/** GET /api/blocks?from=YYYY-MM-DD&to=YYYY-MM-DD — 본인 블록을 날짜 범위로 조회한다. */
export async function GET(request: Request) {
  return withApi(request, async ({ user }) => {
    if (!isDayBlocksEnabled()) return apiError(501, "NOT_IMPLEMENTED", "이 환경에서는 DayBlocks 저장을 사용할 수 없다");
    const params = new URL(request.url).searchParams;
    const range = validateRange(params.get("from"), params.get("to"));
    if (range instanceof Response) return range;
    const blocks = await getBlocks(user.id, range.from, range.to);
    return Response.json({ blocks });
  });
}

const blockInputSchema = z.object({
  id: z.string().min(1).max(200),
  dateKey: z.string().regex(DATE_KEY, "dateKey는 YYYY-MM-DD 형식이어야 한다"),
  // payload 구조는 DayBlocks 정본 — unknown으로 통과. null/undefined·크기는 아래에서 검증한다.
  payload: z.unknown(),
  updatedAt: z.string().optional(),
});
const putSchema = z.object({ blocks: z.array(blockInputSchema).min(1).max(MAX_ITEMS) });

/** PUT /api/blocks — 본인 소유로 블록 bulk upsert(최대 100건, payload 건당 8KB). id 탈취 방지는 core 헬퍼가 강제. */
export async function PUT(request: Request) {
  return withApi(
    request,
    async ({ user }) => {
      if (!isDayBlocksEnabled()) return apiError(501, "NOT_IMPLEMENTED", "이 환경에서는 DayBlocks 저장을 사용할 수 없다");
      const { blocks } = putSchema.parse(await request.json());

      // payload 존재·크기 검증(건당 8KB). zod unknown이라 여기서 방어한다.
      for (const b of blocks) {
        if (b.payload === undefined || b.payload === null) {
          return apiError(422, "INVALID_INPUT", `블록 ${b.id}: payload는 필수다`);
        }
        if (Buffer.byteLength(JSON.stringify(b.payload), "utf8") > MAX_PAYLOAD_BYTES) {
          return apiError(413, "PAYLOAD_TOO_LARGE", `블록 ${b.id}: payload는 8KB 이내여야 한다`);
        }
      }

      const result = await upsertBlocks(user.id, blocks);
      return Response.json(result);
    },
    // 100건 × 8KB + 오버헤드 — 기본 100KB 상한을 넘으므로 이 라우트만 상향한다.
    { maxBodyBytes: MAX_ITEMS * MAX_PAYLOAD_BYTES + 100_000 },
  );
}

/** DELETE /api/blocks?ids=a,b,c — 본인 소유 블록만 삭제(최대 100). 삭제 개수 반환. */
export async function DELETE(request: Request) {
  return withApi(request, async ({ user }) => {
    if (!isDayBlocksEnabled()) return apiError(501, "NOT_IMPLEMENTED", "이 환경에서는 DayBlocks 저장을 사용할 수 없다");
    const raw = new URL(request.url).searchParams.get("ids");
    const ids = (raw ?? "").split(",").map((s) => s.trim()).filter(Boolean);
    if (ids.length === 0) return apiError(422, "INVALID_INPUT", "ids 쿼리(콤마 구분)가 필요하다");
    if (ids.length > MAX_ITEMS) return apiError(422, "INVALID_INPUT", `ids는 최대 ${MAX_ITEMS}개다`);
    const deleted = await deleteBlocks(user.id, ids);
    return Response.json({ deleted });
  });
}
