import {
  canManageMilestone,
  canManageRecurringTemplate,
  findUser,
  formatProjectLabel,
  type Milestone,
  type User,
} from "@que/core";
import { getDb } from "./db";
import { needsRetro } from "./retro-data";
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
  /** OS-2a — 기한 초과·지연 종결로 회고가 필요한 상태인지(부록 B needsRetro). */
  needsRetro: boolean;
  /** 이미 회고가 남아 있는지(중복 방지). */
  hasRetro: boolean;
  /** 이 마일스톤이 변경 접수 프로세스를 탔는지(external·managed 자동 판정). */
  managed: boolean;
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
  const clientById = new Map(db.clients.map((c) => [c.id, c]));
  const labelForProject = (projectId: string): string => {
    const project = projectById.get(projectId);
    if (!project) return projectId;
    return formatProjectLabel(project, project.clientId ? clientById.get(project.clientId) : undefined);
  };

  const templates: TemplateListItem[] = [...db.recurringTemplates]
    .sort((a, b) => a.title.localeCompare(b.title, "ko"))
    .map((t) => ({
      id: t.id,
      title: t.title,
      assigneeName: findUser(t.assigneeId)?.name ?? t.assigneeId,
      projectName: t.projectId ? labelForProject(t.projectId) : undefined,
      frequency: t.frequency,
      dayOfWeek: t.dayOfWeek,
      dayOfMonth: t.dayOfMonth,
      startTime: t.startTime,
      active: t.active,
      canManage: canManageRecurringTemplate(user, t),
    }));

  const now = new Date();
  // 마일스톤별 회고 유무·변경 접수 여부를 한 번에 집계(N+1 방지).
  const retroMilestoneIds = new Set(db.milestoneRetros.map((r) => r.milestoneId));
  const changeMilestoneIds = new Set(
    db.changeRequests.filter((c) => c.milestoneId).map((c) => c.milestoneId as string),
  );

  const milestones: MilestoneRow[] = [...db.milestones]
    .sort((a, b) => a.dueAt.localeCompare(b.dueAt))
    .map((m) => {
      const project = projectById.get(m.projectId);
      return {
        id: m.id,
        projectId: m.projectId,
        projectName: labelForProject(m.projectId),
        title: m.title,
        dueAt: m.dueAt,
        riskStatus: m.riskStatus,
        canManage: canManageMilestone(user, project),
        needsRetro: needsRetro(m, now),
        hasRetro: retroMilestoneIds.has(m.id),
        managed: changeMilestoneIds.has(m.id),
      };
    });

  const projects = db.projects.map((p) => ({ id: p.id, name: labelForProject(p.id) }));
  const manageableProjects = db.projects
    .filter((p) => user.role === "admin" || p.ownerId === user.id)
    .map((p) => ({ id: p.id, name: labelForProject(p.id) }));

  return { templates, milestones, projects, manageableProjects };
}
