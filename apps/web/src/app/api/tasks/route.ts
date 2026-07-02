import { z } from "zod";
import { taskStatusSchema, taskSourceSchema } from "@que/core";
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

const createSchema = z.object({
  title: z.string(),
  assigneeId: z.string().optional(),
  projectId: z.string().optional(),
  startAt: z.string().optional(),
  endAt: z.string().optional(),
  description: z.string().optional(),
  estimatedHours: z.number().optional(),
  source: taskSourceSchema.default("manual"),
});

/** 작업 생성 — MCP create_task 도구의 백엔드. 자연어 해석 결과는 확인 후 이 경로로 들어온다. */
export async function POST(request: Request) {
  return withApi(request, async ({ user, via }) => {
    const body = createSchema.parse(await request.json());
    const task = getDb().createTask({ actorId: user.id, via }, body);
    return Response.json({ task }, { status: 201 });
  });
}
