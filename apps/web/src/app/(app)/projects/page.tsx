import { Suspense } from "react";
import { FolderKanban } from "lucide-react";
import { getCurrentUser } from "@/lib/current-user";
import { getClientFilter } from "@/lib/client-filter";
import {
  getActiveProjects,
  getProjectBoard,
  getProjectCalendar,
  getProjectList,
  getProjectMeta,
  getTaskDetail,
  resolveSelectedProjectId,
} from "@/lib/projects-data";
import { ProjectView } from "@/components/projects/project-view";
import { TaskDetailDrawer } from "@/components/projects/task-detail-drawer";

export const dynamic = "force-dynamic";

// 프로젝트(/projects) — 보드(4열 고정)/목록/캘린더 뷰 + 태스크 상세 드로어.
// 카드 = core Task. 좌측 프로젝트 목록은 활성 클라이언트 필터 스코프를 존중한다.
// 선택 프로젝트는 ?project=<id>, 뷰는 ?view=, 캘린더 월은 ?month=, 드로어는 ?task=<id>.
export default async function ProjectsPage({
  searchParams,
}: {
  searchParams: Promise<{
    view?: string;
    month?: string;
    task?: string;
    project?: string;
  }>;
}) {
  const user = await getCurrentUser();
  const params = await searchParams;

  const clientFilter = await getClientFilter();
  const projects = await getActiveProjects(clientFilter);
  const selectedId = resolveSelectedProjectId(projects, params.project);

  // 빈 상태: 프로젝트가 없다(신규 배포 실데이터 또는 클라 필터로 0개).
  if (!selectedId) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3 text-center">
        <FolderKanban className="size-10 text-[var(--que-text-tertiary)]" aria-hidden />
        <p className="text-base font-semibold text-[var(--que-text)]">프로젝트가 없습니다</p>
        <p className="max-w-sm text-sm text-[var(--que-text-secondary)]">
          {clientFilter
            ? "선택한 클라이언트에 연결된 프로젝트가 없습니다. 상단에서 클라이언트 필터를 바꾸거나 클라이언트 화면에서 프로젝트를 추가하세요."
            : "아직 프로젝트가 없습니다. 클라이언트 화면에서 프로젝트를 추가하세요."}
        </p>
      </div>
    );
  }

  const [board, list, calendar, meta, taskDetail] = await Promise.all([
    getProjectBoard(user, selectedId),
    getProjectList(user, selectedId),
    getProjectCalendar(selectedId, params.month),
    getProjectMeta(selectedId),
    getTaskDetail(user, params.task),
  ]);

  // selectedId는 db 프로젝트 스코프에서 검증됐으므로 meta는 항상 존재한다(방어적 폴백).
  if (!meta) return null;

  return (
    <Suspense>
      <ProjectView
        projects={projects}
        selectedProjectId={selectedId}
        view={params.view}
        board={board}
        list={list}
        calendar={calendar}
        meta={meta}
      />
      <TaskDetailDrawer detail={taskDetail} meta={meta} />
    </Suspense>
  );
}
