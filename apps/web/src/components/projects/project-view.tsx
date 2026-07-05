"use client";

import { useCallback } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type {
  ProjectBoard,
  ProjectCalendar,
  ProjectList,
  ProjectListItem,
  ProjectMeta,
} from "@/lib/projects-data";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ProjectHeader } from "./project-header";
import { CreateTaskDialog } from "./create-task-dialog";
import { ViewTabs, type ProjectView as ProjectViewKey } from "./view-tabs";
import { ListView } from "./list-view";
import { BoardView } from "./board-view";
import { ProjectCalendarView } from "./calendar-view";

const VIEW_KEYS: ProjectViewKey[] = ["list", "board", "calendar"];

function resolveView(raw: string | undefined): ProjectViewKey {
  return VIEW_KEYS.includes(raw as ProjectViewKey) ? (raw as ProjectViewKey) : "board";
}

/** 프로젝트 화면 클라이언트 오케스트레이터 — 프로젝트 선택 + 헤더 + 뷰 탭 + 목록/보드/캘린더. */
export function ProjectView({
  projects,
  selectedProjectId,
  view: viewRaw,
  board,
  list,
  calendar,
  meta,
}: {
  projects: ProjectListItem[];
  selectedProjectId: string;
  view?: string;
  board: ProjectBoard;
  list: ProjectList;
  calendar: ProjectCalendar;
  meta: ProjectMeta;
}) {
  const router = useRouter();
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

  // 프로젝트 전환 — view는 유지, 태스크/월은 초기화(프로젝트가 다르면 의미 없음).
  const selectProject = (id: string) => {
    if (!id || id === selectedProjectId) return;
    const params = new URLSearchParams(searchParams.toString());
    params.set("project", id);
    params.delete("task");
    params.delete("month");
    router.push(`${pathname}?${params.toString()}`, { scroll: false });
  };

  const projectItems = Object.fromEntries(projects.map((p) => [p.id, p.name]));

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="shrink-0 space-y-3">
        {projects.length > 1 && (
          <Select
            items={projectItems}
            value={selectedProjectId}
            onValueChange={(v) => v && selectProject(v)}
          >
            <SelectTrigger
              aria-label="프로젝트 선택"
              className="h-10 min-h-10 w-full max-w-xs border-[var(--que-border)]"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {projects.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  <span className="truncate">{p.name}</span>
                  <span className="ml-auto text-xs text-[var(--que-text-tertiary)]">
                    {p.taskCount}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        <ProjectHeader meta={meta} />
      </div>

      <div className="mt-4 flex shrink-0 flex-wrap items-end justify-between gap-2 border-b border-[var(--que-border)]">
        <ViewTabs current={view} />
        <div className="flex items-center gap-2 pb-2">
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
