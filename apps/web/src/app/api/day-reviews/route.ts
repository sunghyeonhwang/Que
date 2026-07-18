import { z } from "zod";
import { withApi, apiError } from "@/lib/api/respond";
import { isDayBlocksEnabled, getDayReviews, upsertDayReviews } from "@/lib/dayblocks";

// DayBlocks(todo.griff.co.kr) 하루 회고(See) 스냅샷 저장 API. PAT Bearer 인증(withApi)·본인 스코프 강제.
// PK가 (user_id, date_key)라 upsert가 구조적으로 본인 밖을 건드릴 수 없다(블록과 달리 탈취 방지 로직 불필요).
// CORS는 proxy.ts 전역, mock/dev는 501. snapshot 구조는 DayBlocks 정본이라 서버는 소유·날짜만 안다.

const DATE_KEY = /^\d{4}-\d{2}-\d{2}$/;
/** 회고 snapshot 건당 상한(16KB, UTF-8 바이트). */
const MAX_SNAPSHOT_BYTES = 16 * 1024;
/** bulk 상한(회고는 하루 1건 → 최대 31일치). */
const MAX_ITEMS = 31;

/** from/to 범위 검증(둘 다 필수·형식·순서·최대 31일). 위반 시 Response(에러), 통과 시 {from,to}. */
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

/** GET /api/day-reviews?from=YYYY-MM-DD&to=YYYY-MM-DD — 본인 하루 회고를 날짜 범위로 조회한다. */
export async function GET(request: Request) {
  return withApi(request, async ({ user }) => {
    if (!isDayBlocksEnabled()) return apiError(501, "NOT_IMPLEMENTED", "이 환경에서는 DayBlocks 저장을 사용할 수 없다");
    const params = new URL(request.url).searchParams;
    const range = validateRange(params.get("from"), params.get("to"));
    if (range instanceof Response) return range;
    const reviews = await getDayReviews(user.id, range.from, range.to);
    return Response.json({ reviews });
  });
}

const reviewInputSchema = z.object({
  dateKey: z.string().regex(DATE_KEY, "dateKey는 YYYY-MM-DD 형식이어야 한다"),
  // snapshot 구조는 DayBlocks 정본 — unknown으로 통과. null/undefined·크기는 아래에서 검증한다.
  snapshot: z.unknown(),
});
const putSchema = z.object({ reviews: z.array(reviewInputSchema).min(1).max(MAX_ITEMS) });

/** PUT /api/day-reviews — 본인 하루 회고 bulk upsert(최대 31건, snapshot 건당 16KB). */
export async function PUT(request: Request) {
  return withApi(
    request,
    async ({ user }) => {
      if (!isDayBlocksEnabled()) return apiError(501, "NOT_IMPLEMENTED", "이 환경에서는 DayBlocks 저장을 사용할 수 없다");
      const { reviews } = putSchema.parse(await request.json());

      // snapshot 존재·크기 검증(건당 16KB). zod unknown이라 여기서 방어한다.
      for (const r of reviews) {
        if (r.snapshot === undefined || r.snapshot === null) {
          return apiError(422, "INVALID_INPUT", `회고 ${r.dateKey}: snapshot은 필수다`);
        }
        if (Buffer.byteLength(JSON.stringify(r.snapshot), "utf8") > MAX_SNAPSHOT_BYTES) {
          return apiError(413, "PAYLOAD_TOO_LARGE", `회고 ${r.dateKey}: snapshot은 16KB 이내여야 한다`);
        }
      }

      const saved = await upsertDayReviews(user.id, reviews);
      return Response.json({ saved });
    },
    // 31건 × 16KB + 오버헤드 — 기본 100KB 상한을 넘으므로 이 라우트만 상향한다.
    { maxBodyBytes: MAX_ITEMS * MAX_SNAPSHOT_BYTES + 100_000 },
  );
}
