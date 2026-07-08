import { PageHeader } from "@/components/app/page-header";
import { CreateTemplateForm } from "@/components/templates/create-template-form";
import { TemplateList } from "@/components/templates/template-list";
import { CreateMilestoneForm } from "@/components/milestones/create-milestone-form";
import { MilestoneList } from "@/components/milestones/milestone-list";
import { getCurrentUser } from "@/lib/current-user";
import { getPlanningData } from "@/lib/planning-data";

export const dynamic = "force-dynamic";

// 기타 > 반복·마일스톤 — 정기 반복 업무 템플릿(Task 자동 생성) + 프로젝트 마일스톤 관리.
// 반복 템플릿 회차는 스케줄러(/api/cron/sync·요청 lazy)가 자동 생성한다.
export default async function PlanningPage() {
  const user = await getCurrentUser();
  const { templates, milestones, projects, manageableProjects } = await getPlanningData(user);

  return (
    <div>
      <PageHeader
        title="반복 · 마일스톤"
        subtitle="정기 반복 업무 템플릿과 프로젝트 마일스톤을 한곳에서 관리합니다."
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="flex min-w-0 flex-col gap-4">
          <div>
            <h2 className="text-base font-semibold text-[var(--que-text)]">반복 업무 템플릿</h2>
            <p className="mt-0.5 text-sm text-[var(--que-text-secondary)]">
              한 번 등록하면 다가오는 회차부터 작업이 자동으로 생겨요.
            </p>
          </div>
          <CreateTemplateForm projects={projects} />
          <div className="rounded-xl border border-[var(--que-border)] bg-[var(--que-bg)] p-4 shadow-[var(--que-shadow-sm)]">
            <TemplateList templates={templates} />
          </div>
        </section>

        <section className="flex min-w-0 flex-col gap-4">
          <div>
            <h2 className="text-base font-semibold text-[var(--que-text)]">마일스톤</h2>
            <p className="mt-0.5 text-sm text-[var(--que-text-secondary)]">
              프로젝트 기한과 위험 상태를 드러냅니다. 일정 화면에서 드래그로 기한을 옮길 수도 있어요.
            </p>
          </div>
          <CreateMilestoneForm projects={manageableProjects} />
          <div className="rounded-xl border border-[var(--que-border)] bg-[var(--que-bg)] p-4 shadow-[var(--que-shadow-sm)]">
            <MilestoneList milestones={milestones} canCreate={manageableProjects.length > 0} />
          </div>
        </section>
      </div>
    </div>
  );
}
