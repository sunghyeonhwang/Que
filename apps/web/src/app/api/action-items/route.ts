import { withApi } from "@/lib/api/respond";
import { getDb } from "@/lib/db";

/** Action 후보 목록 — MCP list_action_candidates 도구의 백엔드. */
export async function GET(request: Request) {
  return withApi(request, () => {
    const note = new URL(request.url).searchParams.get("note") ?? undefined;
    const items = getDb().actionItems.filter((a) => !note || a.meetingNoteId === note);
    return Response.json({ actionItems: items });
  });
}
