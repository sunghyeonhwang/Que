import { Suspense } from "react";
import { getCurrentUser } from "@/lib/current-user";
import {
  getPrimaryProject,
  getProjectListView,
  getProjectBoardView,
  getProjectCalendarView,
} from "@/lib/pm-data";
import { ProjectView } from "@/components/projects/project-view";

export const dynamic = "force-dynamic";

// 프로젝트(Projects) — 목록(List)/보드(Board)/캘린더(Calendar) 뷰. 신규 mock PM 모델.
// 파일 뷰와 태스크 모달은 후속 단계.
export default async function ProjectsPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string; month?: string }>;
}) {
  await getCurrentUser();
  const params = await searchParams;
  const project = getPrimaryProject();
  const data = getProjectListView(project.id);
  const board = getProjectBoardView(project.id);
  const calendar = getProjectCalendarView(project.id, params.month);

  return (
    <Suspense>
      <ProjectView data={data} board={board} calendar={calendar} />
    </Suspense>
  );
}
