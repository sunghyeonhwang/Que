import { Suspense } from "react";
import { FolderKanban } from "lucide-react";
import { getCurrentUser } from "@/lib/current-user";
import { getClientFilter, getClientOptions } from "@/lib/client-filter";
import {
  getActiveProjects,
  getProjectBoard,
  getProjectGantt,
  getProjectList,
  getProjectMeta,
  getProjectMilestones,
  getTaskDetail,
  resolveSelectedProjectId,
} from "@/lib/projects-data";
import { ProjectView } from "@/components/projects/project-view";
import { ALL_CLIENTS, ALL_PROJECTS } from "@/lib/projects-scope";
import { ProjectScopeFilters } from "@/components/projects/project-scope-filters";
import { TaskDetailDrawer } from "@/components/projects/task-detail-drawer";

export const dynamic = "force-dynamic";
// AI 연결 제안(suggest-actions)이 이 라우트에서 Gemini를 호출한다 — 기본 함수 시간(10초대)이면
// thinking 지연 시 간헐 실패(/team AI 분석과 같은 사고 패턴). 넉넉히 60초.
export const maxDuration = 60;

// 프로젝트(/projects) — 목록/보드/간트 뷰 + 태스크 상세 드로어.
// 카드 = core Task. 헤더의 2단 필터(클라이언트 → 프로젝트)로 스코프를 좁힌다.
// 클라이언트는 ?client=<id|all>, 프로젝트는 ?project=<id>, 뷰는 ?view=, 드로어는 ?task=<id>.
// ?client가 없으면 전역 클라이언트 스위처(쿠키)를 기본 스코프로 쓴다. ?client는 그 위에
// 페이지 단위로 덮어쓰며(all=명시적 전체), 전역 쿠키는 바꾸지 않는다.
export default async function ProjectsPage({
  searchParams,
}: {
  searchParams: Promise<{
    view?: string;
    task?: string;
    project?: string;
    client?: string;
  }>;
}) {
  const user = await getCurrentUser();
  const params = await searchParams;

  const cookieClient = await getClientFilter();
  const clientOptions = await getClientOptions();

  // 유효 클라이언트 스코프 해석:
  // - ?client=all → 명시적 전체(쿠키 무시)
  // - ?client=<유효 clientId> → 그 클라이언트
  // - 그 외(없음/무효) → 전역 스위처 쿠키(없으면 전체)
  const requested = params.client;
  const clientFilter =
    requested === ALL_CLIENTS
      ? undefined
      : requested && clientOptions.some((c) => c.id === requested)
        ? requested
        : cookieClient;
  const selectedClient = clientFilter ?? ALL_CLIENTS;

  const projects = await getActiveProjects(clientFilter);

  // 프로젝트 스코프 해석:
  // - ?project=all → 전체 보기(스코프 내 모든 프로젝트 합산, 단일 selectedId 없음)
  // - ?project=<유효 id> → 그 프로젝트, 그 외 → 첫 프로젝트
  const isAllProjects = params.project === ALL_PROJECTS;
  const selectedId = isAllProjects
    ? null
    : resolveSelectedProjectId(projects, params.project);
  const projectIds = isAllProjects
    ? projects.map((p) => p.id)
    : selectedId
      ? [selectedId]
      : [];

  // 빈 상태: 이 스코프에 프로젝트가 없다(전체가 0개 또는 특정 클라 0개).
  // 클라이언트 필터는 계속 렌더해 사용자가 스코프를 바꿔 빠져나갈 수 있게 한다.
  if (projectIds.length === 0) {
    return (
      <div className="flex h-full min-h-0 flex-col">
        <div className="shrink-0">
          <ProjectScopeFilters
            clients={clientOptions}
            selectedClient={selectedClient}
            projects={projects}
            selectedProjectId={null}
            isAllProjects={isAllProjects}
          />
        </div>
        <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center">
          <FolderKanban className="size-10 text-[var(--que-text-tertiary)]" aria-hidden />
          <p className="text-base font-semibold text-[var(--que-text)]">프로젝트가 없습니다</p>
          <p className="max-w-sm text-sm text-[var(--que-text-secondary)]">
            {clientFilter
              ? "선택한 클라이언트에 연결된 프로젝트가 없습니다. 클라이언트 필터를 바꾸거나 클라이언트 화면에서 프로젝트를 추가하세요."
              : "아직 프로젝트가 없습니다. 클라이언트 화면에서 프로젝트를 추가하세요."}
          </p>
        </div>
      </div>
    );
  }

  // 활성 뷰의 데이터만 계산한다 — 세 뷰를 전부 만들면 프로젝트 전환·뷰 전환마다
  // 불필요한 전체 재계산이 얹혀 로딩이 느려진다(2026-07-20 사용자 피드백).
  // 마일스톤 띠는 보드·목록 전용(간트는 getProjectGantt가 자체 레인 데이터를 포함).
  const view = ["list", "board", "gantt"].includes(params.view ?? "")
    ? (params.view as "list" | "board" | "gantt")
    : "gantt";
  const [board, list, gantt, milestones, taskDetail] = await Promise.all([
    view === "board" ? getProjectBoard(user, projectIds) : null,
    view === "list" ? getProjectList(user, projectIds) : null,
    view === "gantt" ? getProjectGantt(user, projectIds) : null,
    view !== "gantt" ? getProjectMilestones(user, projectIds) : [],
    getTaskDetail(user, params.task),
  ]);

  // 헤더/드로어 메타:
  // - 단일 보기: 선택 프로젝트 메타(헤더 + 드로어 담당자 목록에 사용).
  // - 전체 보기: 헤더는 스코프 요약이라 메타 불필요. 드로어가 열려 있으면 그 태스크의
  //   프로젝트 메타를 가져와 담당자 재지정 목록을 채운다.
  const metaProjectId = isAllProjects ? (taskDetail?.projectId ?? null) : selectedId;
  const meta = metaProjectId ? await getProjectMeta(metaProjectId) : null;

  // 단일 보기에서는 selectedId가 db 스코프로 검증됐으므로 meta가 항상 존재한다(방어적 폴백).
  if (!isAllProjects && !meta) return null;

  return (
    <Suspense>
      <ProjectView
        clients={clientOptions}
        selectedClient={selectedClient}
        projects={projects}
        selectedProjectId={selectedId}
        isAllProjects={isAllProjects}
        view={params.view}
        board={board}
        list={list}
        gantt={gantt}
        milestones={milestones}
        meta={meta}
        isAdmin={user.role === "admin"}
      />
      <TaskDetailDrawer detail={taskDetail} meta={meta} />
    </Suspense>
  );
}
