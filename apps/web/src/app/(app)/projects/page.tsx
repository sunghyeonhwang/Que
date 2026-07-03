import { Suspense } from "react";
import Link from "next/link";
import { Info } from "lucide-react";
import { getCurrentUser } from "@/lib/current-user";
import {
  getPrimaryProject,
  getProjectListView,
  getProjectBoardView,
  getProjectCalendarView,
  getProjectMeta,
  getTaskDetail,
  type PmPriority,
  type TaskFilter,
} from "@/lib/pm-data";
import { ProjectView } from "@/components/projects/project-view";
import { TaskDetailDrawer } from "@/components/projects/task-detail-drawer";

export const dynamic = "force-dynamic";

const PRIORITIES: PmPriority[] = ["high", "normal", "low"];

/** searchParams 값(string | string[])을 쉼표구분·배열 모두 허용해 평탄한 문자열 배열로. */
function toList(raw: string | string[] | undefined): string[] {
  if (raw === undefined) return [];
  const parts = Array.isArray(raw) ? raw : [raw];
  return parts
    .flatMap((p) => p.split(","))
    .map((s) => s.trim())
    .filter(Boolean);
}

// 프로젝트(Projects) — 목록(List)/보드(Board)/캘린더(Calendar) 뷰 + 태스크 상세 드로어.
// 드로어 열림 상태는 URL(`?task=<id>`)로, 필터는 `?priority=&assignee=`로 관리한다.
// priority/assignee는 쉼표구분 또는 반복 파라미터 둘 다 허용한다.
export default async function ProjectsPage({
  searchParams,
}: {
  searchParams: Promise<{
    view?: string;
    month?: string;
    task?: string;
    priority?: string | string[];
    assignee?: string | string[];
  }>;
}) {
  await getCurrentUser();
  const params = await searchParams;
  const project = getPrimaryProject();

  // 필터 파싱: priority는 화이트리스트만, assignee는 id 그대로. 둘 다 비면 필터 없음.
  const priority = toList(params.priority).filter((p): p is PmPriority =>
    PRIORITIES.includes(p as PmPriority),
  );
  const assigneeIds = toList(params.assignee);
  const filter: TaskFilter | undefined =
    priority.length > 0 || assigneeIds.length > 0
      ? { priority: priority.length ? priority : undefined, assigneeIds: assigneeIds.length ? assigneeIds : undefined }
      : undefined;

  const data = getProjectListView(project.id, filter);
  const board = getProjectBoardView(project.id, filter);
  const calendar = getProjectCalendarView(project.id, params.month);
  const taskDetail = getTaskDetail(params.task);
  const meta = getProjectMeta(project.id);

  return (
    <Suspense>
      {/* 출시 강등(HANDOFF 51): PM 모델이 비영속 mock이라 저장되지 않는 미리보기다. */}
      <div className="mb-4 flex items-start gap-2.5 rounded-xl border border-[var(--que-warning)]/30 bg-[var(--que-warning-bg)] px-4 py-3 text-sm">
        <Info className="mt-0.5 size-4 shrink-0 text-[var(--que-warning)]" aria-hidden />
        <p className="text-[var(--que-text-secondary)]">
          <span className="font-semibold text-[var(--que-text)]">미리보기 화면입니다 — 변경이 저장되지 않습니다.</span>{" "}
          실제 작업은{" "}
          <Link href="/today" className="font-medium text-[var(--que-brand)] underline-offset-2 hover:underline">
            작업 목록
          </Link>
          에서 관리하세요.
        </p>
      </div>
      <ProjectView data={data} board={board} calendar={calendar} meta={meta} />
      <TaskDetailDrawer detail={taskDetail} meta={meta} />
    </Suspense>
  );
}
