"use client";

import { useCallback } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import type {
  ProjectBoard,
  ProjectCalendar,
  ProjectList,
  ProjectListItem,
  ProjectMeta,
} from "@/lib/projects-data";
import { FullscreenButton } from "@/components/app/fullscreen-button";
import { ProjectHeader } from "./project-header";
import { ProjectScopeFilters } from "./project-scope-filters";
import { CreateTaskDialog } from "./create-task-dialog";
import { ViewTabs, type ProjectView as ProjectViewKey } from "./view-tabs";
import { ListView } from "./list-view";
import { BoardView } from "./board-view";
import { ProjectCalendarView } from "./calendar-view";

const VIEW_KEYS: ProjectViewKey[] = ["list", "board", "calendar"];

function resolveView(raw: string | undefined): ProjectViewKey {
  return VIEW_KEYS.includes(raw as ProjectViewKey) ? (raw as ProjectViewKey) : "board";
}

/** 프로젝트 화면 클라이언트 오케스트레이터 — 클라이언트·프로젝트 필터 + 헤더 + 뷰 탭 + 목록/보드/캘린더. */
export function ProjectView({
  clients,
  selectedClient,
  projects,
  selectedProjectId,
  view: viewRaw,
  board,
  list,
  calendar,
  meta,
  isAdmin,
}: {
  clients: { id: string; name: string }[];
  selectedClient: string;
  projects: ProjectListItem[];
  selectedProjectId: string;
  view?: string;
  board: ProjectBoard;
  list: ProjectList;
  calendar: ProjectCalendar;
  meta: ProjectMeta;
  isAdmin: boolean;
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const view = resolveView(viewRaw);

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
        />
        <ProjectHeader meta={meta} isAdmin={isAdmin} />
      </div>

      <div className="mt-4 flex shrink-0 flex-wrap items-end justify-between gap-2 border-b border-[var(--que-border)]">
        <ViewTabs current={view} />
        <div className="flex items-center gap-2 pb-2">
          <FullscreenButton />
          <CreateTaskDialog projectId={selectedProjectId} meta={meta} />
        </div>
      </div>

      {view === "board" ? (
        <BoardView columns={board.columns} projectId={selectedProjectId} taskHref={taskHref} />
      ) : view === "calendar" ? (
        <ProjectCalendarView data={calendar} taskHref={taskHref} />
      ) : (
        <ListView columns={list.columns} projectId={selectedProjectId} taskHref={taskHref} />
      )}
    </div>
  );
}
