import { Suspense } from "react";
import { getCurrentUser } from "@/lib/current-user";
import {
  getPrimaryProject,
  getProjectListView,
  getProjectBoardView,
  getProjectCalendarView,
  getTaskDetail,
} from "@/lib/pm-data";
import { ProjectView } from "@/components/projects/project-view";
import { TaskDetailDrawer } from "@/components/projects/task-detail-drawer";

export const dynamic = "force-dynamic";

// 프로젝트(Projects) — 목록(List)/보드(Board)/캘린더(Calendar) 뷰 + 태스크 상세 드로어.
// 드로어 열림 상태는 URL(`?task=<id>`)로 관리한다. 파일 뷰는 후속 단계.
export default async function ProjectsPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string; month?: string; task?: string }>;
}) {
  await getCurrentUser();
  const params = await searchParams;
  const project = getPrimaryProject();
  const data = getProjectListView(project.id);
  const board = getProjectBoardView(project.id);
  const calendar = getProjectCalendarView(project.id, params.month);
  const taskDetail = getTaskDetail(params.task);

  return (
    <Suspense>
      <ProjectView data={data} board={board} calendar={calendar} />
      <TaskDetailDrawer detail={taskDetail} />
    </Suspense>
  );
}
