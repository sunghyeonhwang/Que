import { format } from "date-fns";
import { ko } from "date-fns/locale";
import type { MyTaskItem } from "@/lib/my-tasks-data";
import { MemberAvatars } from "@/components/projects/member-avatars";
import { StatusBadge } from "./status-badge";
import { TaskDoneCircle } from "./task-done-circle";
import { TaskStatusSheet, type TaskRowData } from "./task-status-sheet";
import type { TaskCommentView } from "./task-comments";
import { cn } from "@/lib/utils";

// 디자인 태스크 표: 이름 · 설명 · 마감일 · 배정 · 우선순위 · 진행률 · 완료(원형 체크).
// 좁은 폭에서는 설명/마감일/배정/우선순위를 숨겨 가로 스크롤 없이 유지한다(터치 우선).
// 마지막 열은 항상 노출되는 원형 완료 버튼(행 우측 끝).
// - base: 이름 · 진행률 · 완료
// - md: 이름 · 마감일 · 진행률 · 완료
// - lg: 전체 7열
const GRID =
  "grid grid-cols-[minmax(0,1fr)_104px_44px] md:grid-cols-[minmax(0,1fr)_150px_104px_44px] lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1.5fr)_150px_92px_72px_108px_44px] items-center gap-3";

function dueLabel(item: MyTaskItem): string {
  if (!item.dueAt) return "-";
  return format(new Date(item.dueAt), "yyyy년 M월 d일 (EEE)", { locale: ko });
}

export function MyTaskTable({
  items,
  commentsByTask,
}: {
  items: MyTaskItem[];
  commentsByTask: Map<string, TaskCommentView[]>;
}) {
  return (
    <div className="overflow-hidden rounded-xl border border-[var(--que-border)] bg-[var(--que-bg)]">
      <div className="max-h-[calc(100dvh-21rem)] overflow-y-auto">
        {/* 헤더 (sticky) */}
        <div
          className={cn(
            GRID,
            "sticky top-0 z-10 border-b border-[var(--que-border)] bg-[var(--que-bg)] px-4 py-2.5 text-xs font-medium text-[var(--que-text-tertiary)]",
          )}
        >
          <span>이름</span>
          <span className="hidden lg:block">설명</span>
          <span className="hidden md:block">마감일</span>
          <span className="hidden lg:block">배정</span>
          <span className="hidden lg:block">우선순위</span>
          <span>진행률</span>
          <span className="sr-only">완료</span>
        </div>

        {items.length === 0 && (
          <p className="px-4 py-12 text-center text-sm text-[var(--que-text-tertiary)]">
            표시할 작업이 없습니다.
          </p>
        )}

        {items.map((item) => {
          const row: TaskRowData = {
            id: item.id,
            title: item.title,
            status: item.status,
            timeText: dueLabel(item),
            metaText: item.description,
            startAt: item.startAt,
            endAt: item.endAt,
            projectId: item.projectId,
            assigneeId: item.assignees[0]?.id,
            assigneeName: item.assignees[0]?.name,
            comments: commentsByTask.get(item.id) ?? [],
          };
          const isDone = item.status === "done";
          return (
            <div
              key={item.id}
              data-done={isDone ? "" : undefined}
              className={cn(
                GRID,
                "relative min-h-16 border-b border-[var(--que-border)] px-4 py-3.5 transition-colors last:border-b-0 hover:bg-[var(--que-bg-muted)]",
                "data-done:opacity-70",
              )}
            >
              {/* 행 전체 클릭 → 상세 Sheet(기존 상태변경 흐름). 원형 체크는 위로 올려 겹치지 않게. */}
              <TaskStatusSheet
                task={row}
                triggerClassName="absolute inset-0 z-0 rounded-md focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[var(--que-brand)]"
              >
                <span className="sr-only">{item.title} 상세 열기</span>
              </TaskStatusSheet>

              {/* 이름 */}
              <div className="flex min-w-0 items-center">
                <span
                  className={cn(
                    "min-w-0 truncate text-[15px] font-medium transition-colors",
                    isDone
                      ? "text-[var(--que-text-tertiary)] line-through"
                      : "text-[var(--que-text)]",
                  )}
                >
                  {item.title}
                </span>
              </div>

              {/* 설명 */}
              <p className="pointer-events-none hidden min-w-0 truncate text-sm text-[var(--que-text-secondary)] lg:block">
                {item.description ?? "-"}
              </p>

              {/* 마감일 */}
              <span className="pointer-events-none hidden truncate text-sm text-[var(--que-text-secondary)] md:block">
                {dueLabel(item)}
              </span>

              {/* 배정 */}
              <div className="pointer-events-none hidden lg:block">
                <MemberAvatars members={item.assignees} />
              </div>

              {/* 우선순위 — 기존 모델엔 우선순위 필드가 없어 "—"로 표시(범위 밖) */}
              <span className="pointer-events-none hidden text-sm text-[var(--que-text-tertiary)] lg:block">
                —
              </span>

              {/* 진행률(상태 뱃지) */}
              <div className="pointer-events-none relative z-0 flex justify-start">
                <StatusBadge status={item.status} />
              </div>

              {/* 완료(원형 체크) — 행 우측 끝. 행 클릭과 겹치지 않게 z-10 + stopPropagation. */}
              <div className="relative z-10 flex justify-end">
                <TaskDoneCircle taskId={item.id} title={item.title} status={item.status} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
