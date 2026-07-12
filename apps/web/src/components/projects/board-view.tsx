"use client";

import { useState, type DragEvent } from "react";
import { LayoutGroup, motion } from "motion/react";
import Link from "next/link";
import { Plus, CalendarDays, MessageSquare, Lock, AlertTriangle } from "lucide-react";
import { TASK_STATUS_LABELS, type StatusDetail } from "@que/core";
import type { BoardColumn, TaskCard, BoardColumnKey } from "@/lib/projects-data";
import { SIMPLE_COLUMN_STATUS, TONE_STYLE, COLUMN_TONE } from "@/lib/pm-columns";
import { moveTaskAction } from "@/app/(app)/projects/pm-actions";
import { useSafeAction } from "@/components/app/use-safe-action";
import { IconButton } from "@/components/app/icon-button";
import { StatusBadge } from "@/components/app/status-badge";
import { PriorityBadge } from "./priority-badge";
import { MemberAvatars } from "./member-avatars";
import { PmDoneCircle } from "./pm-done-circle";
import { TaskCardMenu } from "./task-card-menu";
import { AddTaskInline } from "./add-task-inline";
import { BlockedStatusDialog, type BlockedStatus } from "./blocked-status-dialog";
import { cn } from "@/lib/utils";

const DRAG_MIME = "application/x-que-task";

type DragState = { taskId: string; taskTitle: string; fromColumn: BoardColumnKey } | null;
type BlockedTarget = { taskId: string; taskTitle: string } | null;

/** 보드(칸반) 뷰 — status 고정 4열(가로 스크롤), 카드=core Task(세로 스크롤).
 *  카드 클릭 → 상세 드로어. 이동: 데스크톱 HTML5 드래그(=열 이동) + 모든 기기 공용 ⋮ 메뉴.
 *  홀드·문제 열로 이동하면 사유 Dialog를 거친다(취소 시 카드 원위치 — 낙관 이동 안 함). */
export function BoardView({
  columns,
  projectId,
  taskHref,
  showProject = false,
  allowCreate = true,
}: {
  columns: BoardColumn[];
  projectId: string;
  taskHref: (taskId: string) => string;
  /** 전체 보기: 각 카드에 소속 프로젝트명 라벨 표시. */
  showProject?: boolean;
  /** 태스크 추가(+) 노출 여부. 전체 보기에선 대상 프로젝트가 없어 false. */
  allowCreate?: boolean;
}) {
  const { run, pending } = useSafeAction();
  const [drag, setDrag] = useState<DragState>(null);
  const [blocked, setBlocked] = useState<BlockedTarget>(null);

  // 예정/진행중/완료로 즉시 이동. 홀드·문제 열은 사유 Dialog로 위임.
  const moveTo = (card: { taskId: string; taskTitle: string }, key: BoardColumnKey) => {
    if (key === "blocked") {
      setBlocked({ taskId: card.taskId, taskTitle: card.taskTitle });
      return;
    }
    run(() => moveTaskAction({ taskId: card.taskId, to: SIMPLE_COLUMN_STATUS[key] }), {
      success: `"${card.taskTitle}" 이동됨`,
    });
  };

  const confirmBlocked = (to: BlockedStatus, detail: StatusDetail) => {
    if (!blocked) return;
    const target = blocked;
    run(() => moveTaskAction({ taskId: target.taskId, to, detail }), {
      success: `"${target.taskTitle}" 이동됨`,
      onSuccess: () => setBlocked(null),
    });
  };

  return (
    <div className="-mx-4 min-h-0 flex-1 overflow-x-auto px-4 pt-3 md:-mx-5 md:px-5 xl:-mx-6 xl:px-6">
      {/* LayoutGroup — 4열이 같은 layoutId 공간을 공유해, 열 이동 시 카드가 순간이동 대신 보간된다. */}
      <LayoutGroup>
        <div className="flex h-full min-h-0 gap-4">
          {columns.map((column) => (
            <Column
              key={column.key}
              column={column}
              projectId={projectId}
              taskHref={taskHref}
              showProject={showProject}
              allowCreate={allowCreate}
              drag={drag}
              onDragStart={setDrag}
              onDragEnd={() => setDrag(null)}
              onDropTask={(card) => moveTo(card, column.key)}
              onBlocked={(card) => setBlocked(card)}
            />
          ))}
        </div>
      </LayoutGroup>

      <BlockedStatusDialog
        open={blocked !== null}
        onOpenChange={(next) => {
          if (!next) setBlocked(null);
        }}
        taskTitle={blocked?.taskTitle ?? ""}
        pending={pending}
        onConfirm={confirmBlocked}
      />
    </div>
  );
}

function Column({
  column,
  projectId,
  taskHref,
  showProject,
  allowCreate,
  drag,
  onDragStart,
  onDragEnd,
  onDropTask,
  onBlocked,
}: {
  column: BoardColumn;
  projectId: string;
  taskHref: (taskId: string) => string;
  showProject: boolean;
  allowCreate: boolean;
  drag: DragState;
  onDragStart: (state: DragState) => void;
  onDragEnd: () => void;
  onDropTask: (card: { taskId: string; taskTitle: string }) => void;
  onBlocked: (card: { taskId: string; taskTitle: string }) => void;
}) {
  const [adding, setAdding] = useState(false);
  const [isOver, setIsOver] = useState(false);
  const tone = TONE_STYLE[COLUMN_TONE[column.key]];

  // 다른 열에서 온 카드만 드롭 대상으로 취급(같은 열 재정렬은 미지원).
  const canDrop = drag !== null && drag.fromColumn !== column.key;

  const onDragOver = (event: DragEvent) => {
    if (!canDrop) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
    if (!isOver) setIsOver(true);
  };

  const onDrop = (event: DragEvent) => {
    setIsOver(false);
    if (!canDrop || !drag) return;
    event.preventDefault();
    onDropTask({ taskId: drag.taskId, taskTitle: drag.taskTitle });
  };

  const showAdd = allowCreate && column.key === "scheduled";

  return (
    <section
      onDragOver={onDragOver}
      onDragLeave={() => setIsOver(false)}
      onDrop={onDrop}
      className={cn(
        // 고정폭 대신 flex-1+최소폭 — 와이드 화면에선 4열이 남는 폭을 나눠 늘어나고,
        // 좁으면 min-w 바닥 아래로 줄지 않고 부모 overflow-x 스크롤로 전환(2026-07-11 요청 6).
        "flex h-full min-h-0 min-w-[318px] flex-1 shrink-0 flex-col rounded-xl border transition-colors sm:min-w-[340px]",
        isOver
          ? "border-[var(--que-brand)] ring-2 ring-[var(--que-brand)]/30"
          : "border-[var(--que-border)]",
      )}
      style={{ backgroundColor: tone.tint }}
    >
      <header className="flex h-14 shrink-0 items-center gap-2 pr-1.5 pl-3.5">
        <span className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: tone.dot }} aria-hidden />
        <h2 className="text-sm font-semibold text-[var(--que-text)]">{column.label}</h2>
        <span
          className="flex h-5 min-w-5 items-center justify-center rounded-full bg-[var(--que-bg)]/70 px-1.5 text-xs font-medium text-[var(--que-text-secondary)]"
          aria-label={`${column.count}개`}
        >
          {column.count}
        </span>
        {showAdd && (
          <div className="ml-auto flex items-center">
            <IconButton
              label="예정 열에 태스크 추가"
              onClick={() => setAdding(true)}
              className="size-10 text-[var(--que-text-secondary)]"
            >
              <Plus className="size-4" aria-hidden />
            </IconButton>
          </div>
        )}
      </header>

      <div className="flex min-h-0 flex-1 flex-col gap-2.5 overflow-y-auto px-2.5 pt-0.5 pb-3">
        {adding && showAdd && (
          <div className="rounded-xl border border-[var(--que-border)] bg-[var(--que-bg)] p-2">
            <AddTaskInline
              projectId={projectId}
              onClose={() => setAdding(false)}
              className="min-h-0 border-b-0 px-0 py-0"
            />
          </div>
        )}
        {column.cards.length === 0 ? (
          <p className="px-1 py-6 text-center text-xs text-[var(--que-text-tertiary)]">
            {isOver ? "여기에 놓기" : "태스크 없음"}
          </p>
        ) : (
          column.cards.map((card) => (
            <BoardCard
              key={card.taskId}
              card={card}
              href={taskHref(card.taskId)}
              showProject={showProject}
              onDragStart={onDragStart}
              onDragEnd={onDragEnd}
              onBlocked={onBlocked}
            />
          ))
        )}
      </div>
    </section>
  );
}

function BoardCard({
  card,
  href,
  showProject,
  onDragStart,
  onDragEnd,
  onBlocked,
}: {
  card: TaskCard;
  href: string;
  showProject: boolean;
  onDragStart: (state: DragState) => void;
  onDragEnd: () => void;
  onBlocked: (card: { taskId: string; taskTitle: string }) => void;
}) {
  const [dragging, setDragging] = useState(false);
  const editable = card.canEdit;
  // 컬럼 라벨이 상태를 그대로 말해주는 status(예정/진행중/완료)는 시각 뱃지를 생략(밀도 보존).
  // 컬럼이 애매한 status(예정 열의 시간변경필요, 홀드·문제 열의 홀드/문제발생)만 뱃지를 노출한다.
  const columnConveysStatus =
    card.status === "scheduled" || card.status === "in_progress" || card.status === "done";

  const handleDragStart = (event: DragEvent) => {
    if (!editable) {
      event.preventDefault();
      return;
    }
    event.dataTransfer.setData(DRAG_MIME, card.taskId);
    event.dataTransfer.effectAllowed = "move";
    setDragging(true);
    onDragStart({ taskId: card.taskId, taskTitle: card.title, fromColumn: card.columnKey });
  };

  const handleDragEnd = () => {
    setDragging(false);
    onDragEnd();
  };

  return (
    // motion.div는 layout 래퍼 전용 — 4열 공유 layoutId로 changeTaskStatus 후 서버 리렌더 시
    // 카드가 옛 위치에서 새 위치로 스프링 보간된다(이동 시에만 동작). 네이티브 HTML5 드래그
    // 핸들러는 motion이 재정의하는 onDragStart/End와 타입이 충돌하므로 안쪽 일반 div에 둔다.
    <motion.div
      layout
      layoutId={card.taskId}
      transition={{ type: "spring", visualDuration: 0.25, bounce: 0.2 }}
    >
      <div
        draggable={editable}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        className={cn(
          "relative rounded-xl border border-[var(--que-border)] bg-[var(--que-bg)] p-3.5 shadow-sm transition-shadow hover:shadow-md",
          editable ? (dragging ? "cursor-grabbing opacity-50" : "cursor-grab") : "cursor-default",
        )}
      >
        {/* 카드 전체 클릭 → 상세 드로어. 링크는 native drag 비활성(카드 컨테이너 draggable 우선). */}
        <Link
          href={href}
          scroll={false}
          draggable={false}
          aria-label={`${card.title} 상세 열기`}
          className="absolute inset-0 z-10 rounded-xl focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[var(--que-brand)]"
        />

        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2">
            {/* 완료 버튼 — 카드 클릭 Link(z-10) 위(z-20)에서 전파 차단(DoneCircle 내장). 읽기전용 카드는 미노출. */}
            {editable && (
              <PmDoneCircle
                taskId={card.taskId}
                taskTitle={card.title}
                done={card.status === "done"}
                className="relative z-20 -my-1.5 -ml-1.5"
              />
            )}
            <PriorityBadge priority={card.priority} />
          </div>
          {editable ? (
            <TaskCardMenu
              taskId={card.taskId}
              taskTitle={card.title}
              currentColumn={card.columnKey}
              onBlocked={() => onBlocked({ taskId: card.taskId, taskTitle: card.title })}
              className="-mt-1.5 -mr-1.5"
            />
          ) : (
            <span
              className="relative z-20 flex size-6 items-center justify-center text-[var(--que-text-tertiary)]"
              title="읽기 전용"
              aria-label="읽기 전용"
            >
              <Lock className="size-3.5" aria-hidden />
            </span>
          )}
        </div>
        <h3 className="mt-1.5 text-sm leading-snug font-semibold text-[var(--que-text)]">
          {card.title}
        </h3>

        {/* 전체 보기: 이 카드가 어느 프로젝트 소속인지 소형 라벨로 밝힌다(단일 보기는 중복이라 생략). */}
        {showProject && card.projectName ? (
          <span className="mt-1.5 inline-flex max-w-full items-center truncate rounded border border-[var(--que-border)] px-1.5 py-0.5 text-xs text-[var(--que-text-tertiary)]">
            {card.projectName}
          </span>
        ) : null}

        {/* 상태: 컬럼이 애매한 경우만 시각 뱃지, 그 외엔 색맹·스크린리더용 sr-only 텍스트. */}
        {columnConveysStatus ? (
          <span className="sr-only">상태: {TASK_STATUS_LABELS[card.status]}</span>
        ) : (
          <div className="mt-2">
            <StatusBadge status={card.status} />
          </div>
        )}

        <div
          className={cn(
            "mt-3 flex items-center gap-1.5 text-xs",
            card.isOverdue
              ? "font-medium text-[var(--que-error)]"
              : "text-[var(--que-text-tertiary)]",
          )}
        >
          {card.isOverdue ? (
            <AlertTriangle className="size-3.5 shrink-0" aria-hidden />
          ) : (
            <CalendarDays className="size-3.5 shrink-0" aria-hidden />
          )}
          <span>{card.dueLabel ?? "마감일 미정"}</span>
          {card.isOverdue ? <span className="sr-only">(기한 초과)</span> : null}
        </div>

        <div className="mt-3 flex items-center justify-between gap-2">
          <MemberAvatars members={card.assignee ? [card.assignee] : []} size={26} />
          <span
            className="flex items-center gap-1 text-xs text-[var(--que-text-tertiary)]"
            aria-label={`댓글 ${card.commentCount}개`}
          >
            <MessageSquare className="size-3.5 shrink-0" aria-hidden />
            {card.commentCount}
          </span>
        </div>
      </div>
    </motion.div>
  );
}
