"use client";

import { useCallback } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import type {
  ProjectBoard,
  ProjectCalendar,
  ProjectGantt,
  ProjectList,
  ProjectListItem,
  ProjectMeta,
} from "@/lib/projects-data";
import { ProjectHeader } from "./project-header";
import { ProjectScopeSummary } from "./project-scope-summary";
import { ALL_CLIENTS } from "@/lib/projects-scope";
import { ProjectScopeFilters } from "./project-scope-filters";
import { CreateTaskDialog } from "./create-task-dialog";
import { ViewTabs, type ProjectView as ProjectViewKey } from "./view-tabs";
import { ListView } from "./list-view";
import { BoardView } from "./board-view";
import { ProjectCalendarView } from "./calendar-view";
import { GanttView } from "./gantt-view";

const VIEW_KEYS: ProjectViewKey[] = ["list", "board", "calendar", "gantt"];

function resolveView(raw: string | undefined): ProjectViewKey {
  return VIEW_KEYS.includes(raw as ProjectViewKey) ? (raw as ProjectViewKey) : "board";
}

/** 프로젝트 화면 클라이언트 오케스트레이터 — 클라이언트·프로젝트 필터 + 헤더 + 뷰 탭 + 목록/보드/캘린더. */
export function ProjectView({
  clients,
  selectedClient,
  projects,
  selectedProjectId,
  isAllProjects,
  view: viewRaw,
  board,
  list,
  calendar,
  gantt,
  meta,
  isAdmin,
}: {
  clients: { id: string; name: string }[];
  selectedClient: string;
  projects: ProjectListItem[];
  /** 단일 보기의 선택 프로젝트 id. 전체 보기면 null. */
  selectedProjectId: string | null;
  /** 전체 프로젝트 보기 여부(?project=all). */
  isAllProjects: boolean;
  view?: string;
  board: ProjectBoard;
  list: ProjectList;
  calendar: ProjectCalendar;
  gantt: ProjectGantt;
  /** 단일 보기의 프로젝트 메타. 전체 보기면 null(스코프 요약으로 대체). */
  meta: ProjectMeta | null;
  isAdmin: boolean;
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const view = resolveView(viewRaw);

  // 전체 보기 스코프 요약용 집계. 특정 클라이언트 스코프면 클라이언트명을 함께 표시.
  const totalTaskCount = projects.reduce((sum, p) => sum + p.taskCount, 0);
  const scopeClientName =
    selectedClient !== ALL_CLIENTS
      ? (clients.find((c) => c.id === selectedClient)?.name ?? null)
      : null;
  // 뷰에 넘길 projectId(단일 보기는 선택 id, 전체 보기는 생성 비활성이라 미사용).
  const viewProjectId = selectedProjectId ?? "";

  // 현재 URL(view/month 등)을 보존하며 `task=<id>`만 추가한 상세 열기 링크.
  const taskHref = useCallback(
    (taskId: string) => {
      const params = new URLSearchParams(searchParams.toString());
      params.set("task", taskId);
      return `${pathname}?${params.toString()}`;
    },
    [pathname, searchParams],
  );

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="shrink-0 space-y-3">
        <ProjectScopeFilters
          clients={clients}
          selectedClient={selectedClient}
          projects={projects}
          selectedProjectId={selectedProjectId}
          isAllProjects={isAllProjects}
        />
        {isAllProjects || !meta ? (
          <ProjectScopeSummary
            projectCount={projects.length}
            taskCount={totalTaskCount}
            clientName={scopeClientName}
          />
        ) : (
          <ProjectHeader meta={meta} isAdmin={isAdmin} />
        )}
      </div>

      <div className="mt-4 flex shrink-0 flex-wrap items-end justify-between gap-2 border-b border-[var(--que-border)]">
        <ViewTabs current={view} />
        <div className="flex items-center gap-2 pb-2">
          {/* 전체 보기에선 생성 버튼을 숨긴다 — 생성은 대상 프로젝트가 필요하다. */}
          {!isAllProjects && meta ? (
            <CreateTaskDialog projectId={viewProjectId} meta={meta} />
          ) : null}
        </div>
      </div>

      {view === "board" ? (
        <BoardView
          columns={board.columns}
          projectId={viewProjectId}
          taskHref={taskHref}
          showProject={isAllProjects}
          allowCreate={!isAllProjects}
        />
      ) : view === "calendar" ? (
        <ProjectCalendarView data={calendar} taskHref={taskHref} showProject={isAllProjects} />
      ) : view === "gantt" ? (
        <GanttView data={gantt} taskHref={taskHref} showProject={isAllProjects} />
      ) : (
        <ListView
          columns={list.columns}
          projectId={viewProjectId}
          taskHref={taskHref}
          showProject={isAllProjects}
          allowCreate={!isAllProjects}
        />
      )}
    </div>
  );
}
