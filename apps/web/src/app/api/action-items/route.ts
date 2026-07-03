import { canViewMeetingNote } from "@que/core";
import { withApi } from "@/lib/api/respond";
import { getDb } from "@/lib/db";

/** Action 후보 목록 — MCP list_action_candidates 도구의 백엔드. */
export async function GET(request: Request) {
  return withApi(request, (ctx) => {
    const note = new URL(request.url).searchParams.get("note") ?? undefined;
    const db = getDb();
    const noteById = new Map(db.meetingNotes.map((n) => [n.id, n]));
    const items = db.actionItems.filter((a) => {
      if (note && a.meetingNoteId !== note) return false;
      const parentNote = noteById.get(a.meetingNoteId);
      return !parentNote || canViewMeetingNote(ctx.user, parentNote);
    });
    return Response.json({ actionItems: items });
  });
}
