"use client";

import { useSearchParams } from "next/navigation";
import { SlidersHorizontal, Plus } from "lucide-react";
import type { ProjectListView, ProjectBoardView, ProjectCalendarView } from "@/lib/pm-data";
import { Button } from "@/components/ui/button";
import { IconButton } from "@/components/app/icon-button";
import { ProjectHeader } from "./project-header";
import { ViewTabs, type ProjectView as ProjectViewKey } from "./view-tabs";
import { TaskGroupSection } from "./task-group-section";
import { BoardView } from "./board-view";
import { ProjectCalendarView as CalendarView } from "./calendar-view";

const VIEW_KEYS: ProjectViewKey[] = ["list", "board", "calendar", "files"];
const VIEW_LABEL: Record<ProjectViewKey, string> = {
  list: "목록",
  board: "보드",
  calendar: "캘린더",
  files: "파일",
};

function resolveView(raw: string | null): ProjectViewKey {
  return VIEW_KEYS.includes(raw as ProjectViewKey) ? (raw as ProjectViewKey) : "list";
}

/** 프로젝트 화면 클라이언트 오케스트레이터 — 헤더 + 뷰 탭 + 목록/보드(내부 스크롤). */
export function ProjectView({
  data,
  board,
  calendar,
}: {
  data: ProjectListView;
  board: ProjectBoardView;
  calendar: ProjectCalendarView;
}) {
  const view = resolveView(useSearchParams().get("view"));

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="shrink-0">
        <ProjectHeader
          name={data.project.name}
          description={data.project.description}
          members={data.members}
          memberOverflow={data.memberOverflow}
        />
      </div>

      <div className="mt-4 flex shrink-0 flex-wrap items-end justify-between gap-2 border-b border-[var(--que-border)]">
        <ViewTabs current={view} />
        <div className="flex items-center gap-2 pb-2">
          <IconButton label="필터" variant="outline">
            <SlidersHorizontal className="size-4" aria-hidden />
          </IconButton>
          <Button className="h-10 gap-1.5 rounded-lg bg-[var(--que-brand)] px-3.5 text-white hover:bg-[var(--que-brand-hover)]">
            <Plus className="size-4" aria-hidden />
            새로 추가
          </Button>
        </div>
      </div>

      {view === "board" ? (
        <BoardView groups={board.groups} />
      ) : view === "calendar" ? (
        <CalendarView data={calendar} />
      ) : (
        <div className="-mx-4 min-h-0 flex-1 overflow-y-auto px-4 pt-3 md:-mx-5 md:px-5 xl:-mx-6 xl:px-6">
          {view === "list" ? (
            data.groups.map((group) => <TaskGroupSection key={group.id} group={group} />)
          ) : (
            <div className="flex min-h-[280px] items-center justify-center rounded-xl border border-dashed border-[var(--que-border)] bg-[var(--que-bg-muted)] text-sm text-[var(--que-text-tertiary)]">
              {VIEW_LABEL[view]} 뷰는 준비 중입니다.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
