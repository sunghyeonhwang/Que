"use client";

import { useCallback, useMemo, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import type {
  ProjectBoard,
  ProjectCalendar,
  ProjectGantt,
  ProjectList,
  ProjectListItem,
  ProjectMeta,
  ProjectMilestone,
} from "@/lib/projects-data";
import { MilestoneStrip } from "./milestone-strip";
import { ProjectHeader } from "./project-header";
import { ProjectScopeSummary } from "./project-scope-summary";
import { ALL_CLIENTS } from "@/lib/projects-scope";
import { ProjectScopeFilters } from "./project-scope-filters";
import { CreateTaskDialog } from "./create-task-dialog";
import { AddMilestoneDialog } from "./add-milestone-dialog";
import { ViewTabs, type ProjectView as ProjectViewKey } from "./view-tabs";
import { ListView } from "./list-view";
import { BoardView } from "./board-view";
import { ProjectCalendarView } from "./calendar-view";
import { GanttView } from "./gantt-view";
import { GanttSuggestDialog } from "./gantt-suggest-dialog";

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
  milestones,
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
  /** 스코프 마일스톤(보드·목록 상단 띠용). 캘린더·간트는 각자 그리드에 배치. */
  milestones: ProjectMilestone[];
  /** 단일 보기의 프로젝트 메타. 전체 보기면 null(스코프 요약으로 대체). */
  meta: ProjectMeta | null;
  isAdmin: boolean;
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const view = resolveView(viewRaw);

  // 미완료만 보기 — 4개 뷰(보드·목록·캘린더·간트) 공통 클라 필터(2026-07-14 사용자 요청:
  // 간트 전용에서 프로젝트 전체로 승격). 보드·목록은 완료 열 자체를 숨기고, 캘린더는 완료 카드만 거른다.
  const [hideDone, setHideDone] = useState(false);
  const boardColumns = useMemo(
    () => (hideDone ? board.columns.filter((c) => c.key !== "done") : board.columns),
    [hideDone, board.columns],
  );
  const listColumns = useMemo(
    () => (hideDone ? list.columns.filter((c) => c.key !== "done") : list.columns),
    [hideDone, list.columns],
  );
  const calendarView = useMemo(
    () =>
      hideDone
        ? { ...calendar, days: calendar.days.map((d) => ({ ...d, cards: d.cards.filter((c) => c.status !== "done") })) }
        : calendar,
    [hideDone, calendar],
  );

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
          {/* 미완료만 보기 — 전 뷰 공통. 완료를 걷어 남은 일에 집중한다(즉시 반응). */}
          <button
            type="button"
            onClick={() => setHideDone((v) => !v)}
            aria-pressed={hideDone}
            className={
              "inline-flex min-h-10 items-center gap-1.5 rounded-lg border px-3 text-xs font-medium transition-colors " +
              (hideDone
                ? "border-[var(--que-brand)] bg-[var(--que-brand-subtle)] text-[var(--que-brand)]"
                : "border-[var(--que-border)] text-[var(--que-text-secondary)] hover:bg-[var(--que-bg-muted)]")
            }
          >
            미완료만 보기
          </button>
          {/* AI 연결 제안은 간트 + 단일 프로젝트에서만 — 선행 연결은 같은 프로젝트 안에서만 가능하다. */}
          {view === "gantt" && !isAllProjects && meta ? (
            <GanttSuggestDialog projectId={viewProjectId} />
          ) : null}
          {/* 전체 보기에선 생성 버튼을 숨긴다 — 생성은 대상 프로젝트가 필요하다. */}
          {!isAllProjects && meta ? (
            <CreateTaskDialog projectId={viewProjectId} meta={meta} />
          ) : null}
          {/* 마일스톤 추가 — 특정 프로젝트면 프리필(고정), 전체 보기면 폼에서 프로젝트 선택.
              권한·생성은 /planning과 같은 core 경로(createMilestoneAction)로 강제. */}
          <AddMilestoneDialog
            projects={projects.map((p) => ({ id: p.id, name: p.name }))}
            lockedProjectId={isAllProjects ? undefined : viewProjectId || undefined}
          />
        </div>
      </div>

      {/* 보드·목록엔 그리드 셀이 없으므로 상단 띠로 다가오는 마일스톤을 노출.
          캘린더는 날짜 셀, 간트는 전용 레인에 이미 칩이 뜬다. */}
      {(view === "board" || view === "list") && (
        <div className="shrink-0">
          <MilestoneStrip milestones={milestones} />
        </div>
      )}

      {view === "board" ? (
        <BoardView
          columns={boardColumns}
          projectId={viewProjectId}
          taskHref={taskHref}
          showProject={isAllProjects}
          allowCreate={!isAllProjects}
        />
      ) : view === "calendar" ? (
        <ProjectCalendarView data={calendarView} taskHref={taskHref} showProject={isAllProjects} />
      ) : view === "gantt" ? (
        <GanttView data={gantt} taskHref={taskHref} showProject={isAllProjects} hideDone={hideDone} />
      ) : (
        <ListView
          columns={listColumns}
          projectId={viewProjectId}
          taskHref={taskHref}
          showProject={isAllProjects}
          allowCreate={!isAllProjects}
        />
      )}
    </div>
  );
}
