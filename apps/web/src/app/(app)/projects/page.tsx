import { Suspense } from "react";
import { getCurrentUser } from "@/lib/current-user";
import { getPrimaryProject, getProjectListView, getProjectBoardView } from "@/lib/pm-data";
import { ProjectView } from "@/components/projects/project-view";

export const dynamic = "force-dynamic";

// 프로젝트(Projects) — 목록(List)/보드(Board) 뷰. 신규 mock PM 모델.
// 캘린더/파일 뷰와 태스크 모달은 후속 단계.
export default async function ProjectsPage() {
  await getCurrentUser();
  const project = getPrimaryProject();
  const data = getProjectListView(project.id);
  const board = getProjectBoardView(project.id);

  return (
    <Suspense>
      <ProjectView data={data} board={board} />
    </Suspense>
  );
}
