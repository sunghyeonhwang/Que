import {
  canManageMilestone,
  canManageRecurringTemplate,
  findUser,
  type Milestone,
  type User,
} from "@que/core";
import { getDb } from "./db";
import type { TemplateListItem } from "@/components/templates/template-list";

// 반복·마일스톤 화면(/planning) 데이터 — core 계층 재사용, 조회 전용.
// 관리 권한(canManage)은 서버에서 계산해 UI에 넘긴다(클라이언트 신뢰 금지).

export interface MilestoneRow {
  id: string;
  projectId: string;
  projectName: string;
  title: string;
  dueAt: string;
  riskStatus: Milestone["riskStatus"];
  canManage: boolean;
}

export interface PlanningData {
  templates: TemplateListItem[];
  milestones: MilestoneRow[];
  /** 반복 템플릿 폼의 프로젝트 선택(전체). */
  projects: { id: string; name: string }[];
  /** 마일스톤 생성 가능한 프로젝트(관리자·프로젝트 담당자만). */
  manageableProjects: { id: string; name: string }[];
}

export async function getPlanningData(user: User): Promise<PlanningData> {
  const db = await getDb();
  const projectById = new Map(db.projects.map((p) => [p.id, p]));

  const templates: TemplateListItem[] = [...db.recurringTemplates]
    .sort((a, b) => a.title.localeCompare(b.title, "ko"))
    .map((t) => ({
      id: t.id,
      title: t.title,
      assigneeName: findUser(t.assigneeId)?.name ?? t.assigneeId,
      projectName: t.projectId ? projectById.get(t.projectId)?.name : undefined,
      frequency: t.frequency,
      dayOfWeek: t.dayOfWeek,
      dayOfMonth: t.dayOfMonth,
      startTime: t.startTime,
      active: t.active,
      canManage: canManageRecurringTemplate(user, t),
    }));

  const milestones: MilestoneRow[] = [...db.milestones]
    .sort((a, b) => a.dueAt.localeCompare(b.dueAt))
    .map((m) => {
      const project = projectById.get(m.projectId);
      return {
        id: m.id,
        projectId: m.projectId,
        projectName: project?.name ?? m.projectId,
        title: m.title,
        dueAt: m.dueAt,
        riskStatus: m.riskStatus,
        canManage: canManageMilestone(user, project),
      };
    });

  const projects = db.projects.map((p) => ({ id: p.id, name: p.name }));
  const manageableProjects = db.projects
    .filter((p) => user.role === "admin" || p.ownerId === user.id)
    .map((p) => ({ id: p.id, name: p.name }));

  return { templates, milestones, projects, manageableProjects };
}
