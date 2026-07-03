import Link from "next/link";
import { Plus, MoreHorizontal, CalendarDays, MessageSquare, FileText } from "lucide-react";
import type { BoardViewGroup, BoardViewTask } from "@/lib/pm-data";
import { IconButton } from "@/components/app/icon-button";
import { PriorityBadge } from "./priority-badge";
import { MemberAvatars } from "./member-avatars";

/** 그룹 색(hex)에 알파를 붙여 옅은 틴트로. 8자리 hex(#rrggbbaa). */
function tint(hex: string, alpha: string): string {
  return `${hex}${alpha}`;
}

/** 보드(칸반) 뷰 — 그룹=열(가로 스크롤), 태스크=카드(세로 스크롤). 카드 클릭 → 상세 드로어(P4). */
export function BoardView({
  groups,
  taskHref,
}: {
  groups: BoardViewGroup[];
  taskHref: (taskId: string) => string;
}) {
  return (
    <div className="-mx-4 min-h-0 flex-1 overflow-x-auto px-4 pt-3 md:-mx-5 md:px-5 xl:-mx-6 xl:px-6">
      <div className="flex h-full min-h-0 gap-4">
        {groups.map((group) => (
          <BoardColumn key={group.id} group={group} taskHref={taskHref} />
        ))}
      </div>
    </div>
  );
}

function BoardColumn({
  group,
  taskHref,
}: {
  group: BoardViewGroup;
  taskHref: (taskId: string) => string;
}) {
  return (
    <section
      className="flex h-full min-h-0 w-[318px] shrink-0 flex-col rounded-xl border border-[var(--que-border)] sm:w-[340px]"
      style={{ backgroundColor: tint(group.color, "0f") }}
    >
      <header className="flex h-14 shrink-0 items-center gap-2 pr-1.5 pl-3.5">
        <span
          className="size-2.5 shrink-0 rounded-full"
          style={{ backgroundColor: group.color }}
          aria-hidden
        />
        <h2 className="text-sm font-semibold text-[var(--que-text)]">{group.name}</h2>
        <span
          className="flex h-5 min-w-5 items-center justify-center rounded-full bg-white/70 px-1.5 text-xs font-medium text-[var(--que-text-secondary)]"
          aria-label={`${group.count}개`}
        >
          {group.count}
        </span>
        <div className="ml-auto flex items-center">
          <IconButton label={`${group.name} 태스크 추가`} className="size-10 text-[var(--que-text-secondary)]">
            <Plus className="size-4" aria-hidden />
          </IconButton>
          <IconButton label={`${group.name} 메뉴`} className="size-10 text-[var(--que-text-secondary)]">
            <MoreHorizontal className="size-4" aria-hidden />
          </IconButton>
        </div>
      </header>

      <div className="flex min-h-0 flex-1 flex-col gap-2.5 overflow-y-auto px-2.5 pt-0.5 pb-3">
        {group.tasks.length === 0 ? (
          <p className="px-1 py-6 text-center text-xs text-[var(--que-text-tertiary)]">
            태스크 없음
          </p>
        ) : (
          group.tasks.map((task) => (
            <BoardCard key={task.id} task={task} href={taskHref(task.id)} />
          ))
        )}
      </div>
    </section>
  );
}

function BoardCard({ task, href }: { task: BoardViewTask; href: string }) {
  return (
    <Link
      href={href}
      scroll={false}
      aria-label={`${task.name} 상세 열기`}
      className="block rounded-xl border border-[var(--que-border)] bg-white p-3.5 shadow-sm transition-shadow hover:shadow-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--que-brand)]"
    >
      <PriorityBadge priority={task.priority} />
      <h3 className="mt-2.5 text-sm leading-snug font-semibold text-[var(--que-text)]">
        {task.name}
      </h3>
      <p className="mt-1 line-clamp-2 text-sm leading-snug text-[var(--que-text-secondary)]">
        {task.description}
      </p>

      <div className="mt-3 flex items-center gap-1.5 text-xs text-[var(--que-text-tertiary)]">
        <CalendarDays className="size-3.5 shrink-0" aria-hidden />
        <span>{task.dueLabel ?? "마감일 미정"}</span>
      </div>

      <div className="mt-3 flex items-center justify-between gap-2">
        <MemberAvatars members={task.assignees} size={26} />
        <div className="flex items-center gap-3 text-xs text-[var(--que-text-tertiary)]">
          <span className="flex items-center gap-1" aria-label={`댓글 ${task.commentCount}개`}>
            <MessageSquare className="size-3.5 shrink-0" aria-hidden />
            {task.commentCount}
          </span>
          <span className="flex items-center gap-1" aria-label={`첨부 ${task.attachmentCount}개`}>
            <FileText className="size-3.5 shrink-0" aria-hidden />
            {task.attachmentCount}
          </span>
        </div>
      </div>
    </Link>
  );
}
