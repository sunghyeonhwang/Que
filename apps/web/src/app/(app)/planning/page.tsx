import { PageHeader } from "@/components/app/page-header";
import { LinkTabs } from "@/components/app/link-tabs";
import { CreateTemplateForm } from "@/components/templates/create-template-form";
import { TemplateList } from "@/components/templates/template-list";
import { CreateMilestoneForm } from "@/components/milestones/create-milestone-form";
import { MilestoneList } from "@/components/milestones/milestone-list";
import { getCurrentUser } from "@/lib/current-user";
import { getPlanningData } from "@/lib/planning-data";

export const dynamic = "force-dynamic";

type PlanningTab = "recurring" | "milestones";

function parseTab(value: string | undefined): PlanningTab {
  return value === "milestones" ? "milestones" : "recurring";
}

// 기타 > 반복·마일스톤 — 정기 반복 업무 템플릿(Task 자동 생성) + 프로젝트 마일스톤 관리.
// 성격이 다른 두 도구라 URL 탭(?tab=recurring|milestones)으로 분리하고, 각 탭 상단에 교육형 설명 블록을 둔다.
// 반복 템플릿 회차는 스케줄러(/api/cron/sync·요청 lazy)가 자동 생성한다.
export default async function PlanningPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const { tab: tabParam } = await searchParams;
  const tab = parseTab(tabParam);
  const user = await getCurrentUser();
  const { templates, milestones, projects, manageableProjects } = await getPlanningData(user);

  return (
    <div>
      <PageHeader
        title="반복 · 마일스톤"
        subtitle="정기 반복 업무 템플릿과 프로젝트 마일스톤을 한곳에서 관리합니다."
      />

      <LinkTabs
        label="반복·마일스톤 보기 전환"
        active={tab}
        tabs={[
          { key: "recurring", label: "반복 업무", href: "/planning" },
          { key: "milestones", label: "마일스톤", href: "/planning?tab=milestones" },
        ]}
      />

      {tab === "recurring" ? (
        <section className="flex min-w-0 flex-col gap-4">
          <div className="rounded-xl border border-[var(--que-border)] bg-[var(--que-bg-muted)] p-4">
            <h2 className="text-base font-semibold text-[var(--que-text)]">반복 업무 템플릿이란</h2>
            <p className="mt-1 text-sm leading-relaxed text-[var(--que-text-secondary)]">
              정기적으로 반복되는 일을 한 번 등록하면 회차 작업이 자동으로 생성됩니다. 예를 들어
              &lsquo;매주 월요일 주간 보고&rsquo;를 등록해 두면, 매주 해당 요일의 작업이 알아서
              만들어집니다. 템플릿은 언제든 켜고 끌 수 있으며, 꺼 두면 다음 회차부터 생성되지
              않습니다. 회차 작업은 다가오는 일정에 맞춰 자동으로 채워집니다.
            </p>
          </div>
          <CreateTemplateForm projects={projects} />
          <div className="rounded-xl border border-[var(--que-border)] bg-[var(--que-bg)] p-4 shadow-[var(--que-shadow-sm)]">
            <TemplateList templates={templates} />
          </div>
        </section>
      ) : (
        <section className="flex min-w-0 flex-col gap-4">
          <div className="rounded-xl border border-[var(--que-border)] bg-[var(--que-bg-muted)] p-4">
            <h2 className="text-base font-semibold text-[var(--que-text)]">마일스톤이란</h2>
            <p className="mt-1 text-sm leading-relaxed text-[var(--que-text-secondary)]">
              마일스톤은 프로젝트의 중요한 기한 지점입니다. 담당자와 관리자만 만들 수 있고, 위험
              상태(정상·주의·지연)를 표시해 기한이 위태로운 프로젝트를 미리 드러냅니다. 일정 화면에서
              드래그로 기한을 옮길 수도 있습니다.
            </p>
          </div>
          <CreateMilestoneForm projects={manageableProjects} />
          <div className="rounded-xl border border-[var(--que-border)] bg-[var(--que-bg)] p-4 shadow-[var(--que-shadow-sm)]">
            <MilestoneList
              milestones={milestones}
              manageableProjects={manageableProjects}
              canCreate={manageableProjects.length > 0}
            />
          </div>
        </section>
      )}
    </div>
  );
}
