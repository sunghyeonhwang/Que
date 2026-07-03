import { format } from "date-fns";
import { differenceInCalendarDays } from "date-fns";
import { Diamond } from "lucide-react";
import { canManageRecurringTemplate, TASK_STATUS_LABELS } from "@que/core";
import { PageHeader } from "@/components/app/page-header";
import { StatusBadge } from "@/components/app/status-badge";
import { CreateTemplateForm } from "@/components/templates/create-template-form";
import { TemplateList, type TemplateListItem } from "@/components/templates/template-list";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { getCurrentUser } from "@/lib/current-user";
import { getDb } from "@/lib/db";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function ProjectsPage() {
  const user = await getCurrentUser();
  const db = await getDb();
  const userById = new Map(db.users.map((u) => [u.id, u]));
  const projectById = new Map(db.projects.map((p) => [p.id, p]));
  const now = new Date();

  const templates: TemplateListItem[] = [...db.recurringTemplates]
    .sort((a, b) => Number(b.active) - Number(a.active) || a.title.localeCompare(b.title))
    .map((t) => ({
      id: t.id,
      title: t.title,
      assigneeName: userById.get(t.assigneeId)?.name ?? t.assigneeId,
      projectName: t.projectId ? projectById.get(t.projectId)?.name : undefined,
      frequency: t.frequency,
      dayOfWeek: t.dayOfWeek,
      dayOfMonth: t.dayOfMonth,
      startTime: t.startTime,
      active: t.active,
      canManage: canManageRecurringTemplate(user, t),
    }));

  const projects = db.projects.map((project) => {
    const tasks = db.tasks.filter((t) => t.projectId === project.id);
    const active = tasks.filter((t) => t.status !== "cancelled" && t.status !== "merged");
    const done = active.filter((t) => t.status === "done");
    const blocked = active.filter((t) => t.status === "issue" || t.status === "on_hold");
    const milestones = db.milestones
      .filter((m) => m.projectId === project.id)
      .sort((a, b) => a.dueAt.localeCompare(b.dueAt));
    const nextMilestone = milestones.find((m) => new Date(m.dueAt) >= now) ?? milestones.at(-1);

    const byAssignee = new Map<string, number>();
    for (const task of active) {
      byAssignee.set(task.assigneeId, (byAssignee.get(task.assigneeId) ?? 0) + 1);
    }

    const changes = db.changeLogs
      .filter((log) => {
        if (log.entityType === "milestone") {
          return milestones.some((m) => m.id === log.entityId);
        }
        if (log.entityType === "task") {
          return tasks.some((t) => t.id === log.entityId);
        }
        return false;
      })
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, 3);

    return { project, active, done, blocked, milestones, nextMilestone, byAssignee, changes };
  });

  return (
    <div>
      <PageHeader title="마일스톤" subtitle="프로젝트 기준으로 마일스톤과 연결 작업을 추적합니다" />

      <div className="grid gap-4 lg:grid-cols-2 2xl:grid-cols-3">
        {projects.map(({ project, active, done, blocked, nextMilestone, byAssignee, changes }) => {
          const owner = userById.get(project.ownerId);
          const dday = nextMilestone
            ? differenceInCalendarDays(new Date(nextMilestone.dueAt), now)
            : null;
          return (
            <Card key={project.id}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  {project.name}
                  <Badge variant="outline">담당 {owner?.name}</Badge>
                  {blocked.length > 0 && (
                    <Badge variant="destructive">병목 {blocked.length}</Badge>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-3">
                {nextMilestone && (
                  <div className="flex items-center gap-2 rounded-md border p-2 text-sm">
                    <Diamond
                      className={cn(
                        "size-4 shrink-0",
                        nextMilestone.riskStatus === "at_risk"
                          ? "text-destructive"
                          : "text-foreground",
                      )}
                      fill="currentColor"
                      aria-hidden
                    />
                    <span className="min-w-0 flex-1 truncate">{nextMilestone.title}</span>
                    <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                      {format(new Date(nextMilestone.dueAt), "M/d")}
                      {dday !== null && dday >= 0 ? ` · D-${dday}` : " · 지남"}
                    </span>
                    {nextMilestone.riskStatus === "at_risk" && (
                      <Badge variant="destructive">위험</Badge>
                    )}
                  </div>
                )}

                <div>
                  <div className="mb-1 flex justify-between text-xs text-muted-foreground">
                    <span>진행률</span>
                    <span className="tabular-nums">
                      {done.length}/{active.length} 완료
                    </span>
                  </div>
                  <Progress
                    value={active.length ? (done.length / active.length) * 100 : 0}
                    className="h-2"
                  />
                </div>

                {blocked.length > 0 && (
                  <div className="flex flex-col gap-1.5">
                    {blocked.map((task) => (
                      <div key={task.id} className="flex items-center gap-2 text-sm">
                        <StatusBadge status={task.status} />
                        <span className="min-w-0 flex-1 truncate">{task.title}</span>
                        <span className="shrink-0 text-xs text-muted-foreground">
                          {userById.get(task.assigneeId)?.name}
                        </span>
                      </div>
                    ))}
                  </div>
                )}

                <div className="flex flex-wrap gap-1.5">
                  {[...byAssignee.entries()].map(([assigneeId, count]) => {
                    const member = userById.get(assigneeId);
                    return (
                      <span
                        key={assigneeId}
                        className="flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs"
                      >
                        <span
                          className="size-2 rounded-full"
                          style={{ backgroundColor: member?.avatarColor }}
                          aria-hidden
                        />
                        {member?.name} {count}
                      </span>
                    );
                  })}
                </div>

                {changes.length > 0 && (
                  <div className="border-t pt-2">
                    <p className="mb-1 text-xs font-medium text-muted-foreground">일정 변경 이력</p>
                    {changes.map((log) => (
                      <p key={log.id} className="text-xs text-muted-foreground">
                        {format(new Date(log.createdAt), "M/d HH:mm")} ·{" "}
                        {userById.get(log.actorId)?.name} ·{" "}
                        {log.changeType === "move"
                          ? "일정 이동"
                          : log.changeType === "status_change"
                            ? `상태 변경${log.afterValue && log.afterValue in TASK_STATUS_LABELS ? ` → ${TASK_STATUS_LABELS[log.afterValue as keyof typeof TASK_STATUS_LABELS]}` : ""}`
                            : "변경"}
                      </p>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="mt-6 grid gap-4 xl:grid-cols-[minmax(0,26rem)_minmax(0,1fr)]">
        <CreateTemplateForm projects={db.projects} />
        <div>
          <h2 className="mb-2 text-base font-semibold">반복 업무 템플릿</h2>
          <p className="mb-2 text-xs text-muted-foreground">
            매주/매월 반복되는 정기 업무를 등록하면 다가오는 회차를 Task로 미리 만들어줍니다.
          </p>
          <TemplateList templates={templates} />
        </div>
      </div>
    </div>
  );
}
