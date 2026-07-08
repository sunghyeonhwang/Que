import { z } from "zod";
import { formatProjectLabel, taskStatusSchema, taskSourceSchema } from "@que/core";
import { withApi } from "@/lib/api/respond";
import { getDb } from "@/lib/db";
import { notifyTaskCreated } from "@/lib/notifications/dispatch";

/** 작업 목록 조회 — MCP list_tasks 도구의 백엔드. 필터: assignee, status, project, client.
 *  client 필터는 core의 tasksForClient(해당 거래처 소속 프로젝트의 작업만)를 재사용한다.
 *  응답의 각 작업에는 거래처·프로젝트 표시용 파생 필드(projectLabel/clientId/clientName)를 곁들인다. */
export async function GET(request: Request) {
  return withApi(request, async () => {
    const params = new URL(request.url).searchParams;
    const assignee = params.get("assignee") ?? undefined;
    const project = params.get("project") ?? undefined;
    const client = params.get("client") ?? undefined;
    const statusRaw = params.get("status");
    const status = statusRaw ? taskStatusSchema.parse(statusRaw) : undefined;

    const db = await getDb();
    // client 지정 시 소스를 그 거래처 소속 작업으로 좁힌다. project와 동시 지정 시 AND(아래 필터에서 자연 통과).
    const source = client ? db.tasksForClient(client) : db.tasks;
    const tasks = source
      .filter(
        (t) =>
          (!assignee || t.assigneeId === assignee) &&
          (!project || t.projectId === project) &&
          (!status || t.status === status),
      )
      .map((t) => {
        const proj = db.projectOf(t);
        const cli = db.clientOf(proj);
        return {
          ...t,
          projectLabel: proj ? formatProjectLabel(proj, cli) : undefined,
          clientId: cli?.id,
          clientName: cli?.name,
        };
      });
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
    const db = await getDb();
    const task = db.createTask({ actorId: user.id, via }, body);
    await db.persist();
    await notifyTaskCreated(db, task.id); // MCP/CLI 생성도 담당자 DM(억제 조건은 훅이 판정)
    return Response.json({ task }, { status: 201 });
  });
}
