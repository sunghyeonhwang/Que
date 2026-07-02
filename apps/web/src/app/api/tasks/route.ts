import { taskStatusSchema } from "@que/core";
import { withApi } from "@/lib/api/respond";
import { getDb } from "@/lib/db";

/** 작업 목록 조회 — MCP list_tasks 도구의 백엔드. 필터: assignee, status, project */
export async function GET(request: Request) {
  return withApi(request, () => {
    const params = new URL(request.url).searchParams;
    const assignee = params.get("assignee") ?? undefined;
    const project = params.get("project") ?? undefined;
    const statusRaw = params.get("status");
    const status = statusRaw ? taskStatusSchema.parse(statusRaw) : undefined;

    const tasks = getDb().tasks.filter(
      (t) =>
        (!assignee || t.assigneeId === assignee) &&
        (!project || t.projectId === project) &&
        (!status || t.status === status),
    );
    return Response.json({ tasks });
  });
}
