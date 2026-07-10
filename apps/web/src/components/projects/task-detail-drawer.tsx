"use client";

import { useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  AlertTriangle,
  CalendarDays,
  GitBranch,
  Circle,
  Flag,
  MoreHorizontal,
  Trash2,
  User,
  X,
} from "lucide-react";
import type { StatusDetail } from "@que/core";
import type { ProjectMeta, TaskDetail, TaskPriority, BoardColumnKey } from "@/lib/projects-data";
import {
  COLUMN_LABEL,
  COLUMN_ORDER,
  SIMPLE_COLUMN_STATUS,
  TONE_STYLE,
  COLUMN_TONE,
  dueDateToIso,
} from "@/lib/pm-columns";
import {
  deleteTaskAction,
  moveTaskAction,
  reassignTaskAction,
  setTaskPredecessorsAction,
  updateTaskDetailsAction,
} from "@/app/(app)/projects/pm-actions";
import { useSafeAction } from "@/components/app/use-safe-action";
import { Sheet, SheetClose, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Command,
  CommandEmpty,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { TaskComments } from "@/components/app/task-comments";
import { StatusBadge } from "@/components/app/status-badge";
import { MemberAvatars } from "./member-avatars";
import { BlockedStatusDialog, type BlockedStatus } from "./blocked-status-dialog";
import { cn } from "@/lib/utils";

const PRIORITY_ITEMS: Record<TaskPriority, string> = {
  high: "높음",
  normal: "보통",
  low: "낮음",
};

/**
 * 태스크 상세/편집 드로어 — 열림 상태는 URL(`?task=<id>`)로 관리한다.
 * `detail`이 있으면 열리고, 닫으면 현재 URL에서 `task` 파라미터만 제거한다(view/month 보존).
 * 제목·설명·우선순위·마감은 로컬 편집 후 '저장'(updateTaskDetailsAction)으로 커밋한다.
 * 담당자 변경은 reassignTaskAction, 상태(열) 이동은 moveTaskAction, 삭제는 deleteTaskAction.
 */
export function TaskDetailDrawer({
  detail,
  meta,
}: {
  detail: TaskDetail | null;
  /** 열린 태스크의 프로젝트 메타(담당자 재지정 목록). 전체 보기·태스크 없음이면 null. */
  meta: ProjectMeta | null;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const open = Boolean(detail);
  const [shown, setShown] = useState<TaskDetail | null>(detail);
  // 닫힘 애니메이션 동안 마지막 detail/meta를 유지한다(전체 보기에선 닫을 때 meta가 null이 됨).
  const [shownMeta, setShownMeta] = useState<ProjectMeta | null>(meta);
  if (detail && detail !== shown) {
    setShown(detail);
    setShownMeta(meta);
  }

  function close() {
    const params = new URLSearchParams(searchParams.toString());
    params.delete("task");
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }

  return (
    <Sheet
      open={open}
      onOpenChange={(next) => {
        if (!next) close();
      }}
    >
      <SheetContent
        showCloseButton={false}
        className="w-full gap-0 p-0 data-[side=right]:w-full data-[side=right]:sm:max-w-[460px]"
      >
        <SheetTitle className="sr-only">작업 세부 정보</SheetTitle>
        {shown && shownMeta ? (
          // key로 태스크 전환 시 편집 폼 상태를 초기화한다.
          <DrawerBody key={shown.taskId} detail={shown} meta={shownMeta} onClose={close} />
        ) : null}
      </SheetContent>
    </Sheet>
  );
}

function DrawerBody({
  detail,
  meta,
  onClose,
}: {
  detail: TaskDetail;
  meta: ProjectMeta;
  onClose: () => void;
}) {
  const { run, pending } = useSafeAction();

  const [title, setTitle] = useState(detail.title);
  const [description, setDescription] = useState(detail.description ?? "");
  const [priority, setPriority] = useState<TaskPriority>(detail.priority);
  const [dueDate, setDueDate] = useState(detail.dueDate ?? "");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [blockedOpen, setBlockedOpen] = useState(false);

  const { canEdit } = detail;
  const titleEmpty = title.trim().length === 0;

  const normDesc = description.trim() === "" ? null : description.trim();
  const normDue = dueDate === "" ? null : dueDate;

  // 바뀐 필드만 추려 patch를 만든다.
  const patch: Parameters<typeof updateTaskDetailsAction>[0] = { taskId: detail.taskId };
  if (title.trim() !== detail.title) patch.title = title.trim();
  if (normDesc !== detail.description) patch.description = normDesc;
  if (priority !== detail.priority) patch.priority = priority;
  if (normDue !== detail.dueDate) patch.endAt = normDue ? dueDateToIso(normDue) : null;
  const dirty = Object.keys(patch).length > 1; // taskId 외에 하나라도 있으면 dirty

  const assigneeItems = Object.fromEntries(meta.members.map((m) => [m.id, m.name]));

  function save() {
    if (titleEmpty || !dirty) return;
    run(() => updateTaskDetailsAction(patch), { success: "작업을 저장했습니다" });
  }

  function moveToColumn(key: BoardColumnKey) {
    if (key === detail.columnKey) return;
    if (key === "blocked") {
      setBlockedOpen(true);
      return;
    }
    run(() => moveTaskAction({ taskId: detail.taskId, to: SIMPLE_COLUMN_STATUS[key] }), {
      success: `"${detail.title}" → ${COLUMN_LABEL[key]}`,
    });
  }

  function confirmBlocked(to: BlockedStatus, statusDetail: StatusDetail) {
    run(() => moveTaskAction({ taskId: detail.taskId, to, detail: statusDetail }), {
      success: `"${detail.title}" 상태를 변경했습니다`,
      onSuccess: () => setBlockedOpen(false),
    });
  }

  function reassign(assigneeId: string) {
    if (!assigneeId || assigneeId === detail.assignee?.id) return;
    const name = meta.members.find((m) => m.id === assigneeId)?.name ?? "담당자";
    run(() => reassignTaskAction({ taskId: detail.taskId, assigneeId }), {
      success: `담당자를 ${name}(으)로 변경했습니다`,
    });
  }

  function remove() {
    run(() => deleteTaskAction({ taskId: detail.taskId }), {
      success: "작업을 삭제했습니다",
      onSuccess: () => {
        setConfirmOpen(false);
        onClose();
      },
    });
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* 헤더 */}
      <header className="flex h-14 shrink-0 items-center justify-between border-b border-[var(--que-border)] px-4">
        <span className="text-sm font-medium text-[var(--que-text-secondary)]">작업 세부 정보</span>
        <div className="flex items-center gap-0.5">
          {canEdit && (
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <Button
                    variant="ghost"
                    aria-label="더보기"
                    className="size-10 rounded-lg text-[var(--que-text-secondary)]"
                  />
                }
              >
                <MoreHorizontal className="size-4" aria-hidden />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-40">
                <DropdownMenuItem
                  variant="destructive"
                  className="h-10 gap-2"
                  onClick={() => setConfirmOpen(true)}
                >
                  <Trash2 className="size-4" aria-hidden />
                  삭제
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
          <SheetClose
            render={
              <Button
                variant="ghost"
                aria-label="상세 닫기"
                className="size-10 rounded-lg text-[var(--que-text-secondary)]"
              />
            }
          >
            <X className="size-4" aria-hidden />
          </SheetClose>
        </div>
      </header>

      {/* 본문(스크롤) */}
      <div className="min-h-0 flex-1 overflow-y-auto px-5 pt-5 pb-4">
        {/* 제목 */}
        <div>
          <label htmlFor="task-title" className="sr-only">
            작업 이름
          </label>
          {canEdit ? (
            <>
              <Input
                id="task-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                aria-invalid={titleEmpty}
                placeholder="작업 이름"
                className="h-auto rounded-md border-transparent bg-transparent px-2 py-1.5 text-xl leading-snug font-semibold text-[var(--que-text)] hover:border-[var(--que-border)] md:text-xl"
              />
              {titleEmpty ? (
                <p className="mt-1 px-2 text-xs text-[var(--que-error)]">작업 이름을 입력하세요.</p>
              ) : null}
            </>
          ) : (
            <h2 className="px-2 py-1.5 text-xl leading-snug font-semibold text-[var(--que-text)]">
              {detail.title}
            </h2>
          )}
        </div>

        {/* 상태(열 이동) */}
        <div className="mt-5">
          <p className="mb-2 flex items-center gap-2 px-0.5 text-sm text-[var(--que-text-secondary)]">
            <Circle className="size-4 text-[var(--que-text-tertiary)]" aria-hidden />
            상태
            <span className="ml-1">
              <StatusBadge status={detail.status} />
            </span>
          </p>
          {canEdit ? (
            <div className="grid grid-cols-2 gap-2" role="group" aria-label="상태 변경">
              {COLUMN_ORDER.map((key) => {
                const active = key === detail.columnKey;
                const tone = TONE_STYLE[COLUMN_TONE[key]];
                return (
                  <Button
                    key={key}
                    variant="outline"
                    disabled={active || pending}
                    onClick={() => moveToColumn(key)}
                    className={cn(
                      "h-10 justify-start gap-2 border-[var(--que-border)]",
                      active && "border-[var(--que-brand)] bg-[var(--que-brand-subtle)]",
                    )}
                  >
                    <span
                      className="size-2.5 shrink-0 rounded-full"
                      style={{ backgroundColor: tone.dot }}
                      aria-hidden
                    />
                    {COLUMN_LABEL[key]}
                  </Button>
                );
              })}
            </div>
          ) : null}
        </div>

        {/* 필드 */}
        <dl className="mt-5 space-y-1">
          <FieldRow icon={<Flag className="size-4" aria-hidden />} label="우선순위">
            {canEdit ? (
              <Select
                items={PRIORITY_ITEMS}
                value={priority}
                onValueChange={(v) => v && setPriority(v as TaskPriority)}
              >
                <SelectTrigger
                  aria-label="우선순위 선택"
                  className="h-10 min-h-10 w-full border-[var(--que-border)]"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(PRIORITY_ITEMS) as TaskPriority[]).map((p) => (
                    <SelectItem key={p} value={p}>
                      {PRIORITY_ITEMS[p]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <span className="text-sm text-[var(--que-text)]">{PRIORITY_ITEMS[detail.priority]}</span>
            )}
          </FieldRow>

          <FieldRow icon={<CalendarDays className="size-4" aria-hidden />} label="마감일">
            {canEdit ? (
              <div className="w-full">
                <Input
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  aria-label="마감일"
                  className="h-10 min-h-10 border-[var(--que-border)]"
                />
                {detail.isOverdue ? (
                  <p className="mt-1 flex items-center gap-1 text-xs font-medium text-[var(--que-error)]">
                    <AlertTriangle className="size-3.5 shrink-0" aria-hidden />
                    기한이 지났습니다.
                  </p>
                ) : null}
              </div>
            ) : (
              <span
                className={cn(
                  "flex items-center gap-1.5 text-sm text-[var(--que-text)]",
                  detail.isOverdue && "font-medium text-[var(--que-error)]",
                )}
              >
                {detail.isOverdue ? (
                  <AlertTriangle className="size-3.5 shrink-0" aria-hidden />
                ) : null}
                {detail.dueLabel ?? "미정"}
                {detail.isOverdue ? <span className="sr-only"> (기한 초과)</span> : null}
              </span>
            )}
          </FieldRow>

          <FieldRow icon={<User className="size-4" aria-hidden />} label="담당자">
            {canEdit ? (
              <Select
                items={assigneeItems}
                value={detail.assignee?.id ?? ""}
                onValueChange={(v) => v && reassign(v)}
              >
                <SelectTrigger
                  aria-label="담당자 변경"
                  className="h-10 min-h-10 w-full gap-2 border-[var(--que-border)]"
                >
                  <SelectValue placeholder="담당자 선택" />
                </SelectTrigger>
                <SelectContent>
                  {meta.members.map((m) => (
                    <SelectItem key={m.id} value={m.id}>
                      <MemberAvatars members={[m]} size={22} />
                      {m.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <span className="flex items-center gap-2 text-sm text-[var(--que-text)]">
                {detail.assignee ? (
                  <>
                    <MemberAvatars members={[detail.assignee]} size={22} />
                    {detail.assignee.name}
                  </>
                ) : (
                  "미배정"
                )}
              </span>
            )}
          </FieldRow>

          {/* 선행 작업(E-9) — "앞의 일이 끝나야 시작". 후보는 같은 프로젝트·순환 불가 항목만
              서버가 걸러 내려준다(predecessorOptions). 토글 즉시 커밋(담당자 변경과 동일 패턴). */}
          {(detail.predecessorIds.length > 0 || (canEdit && detail.predecessorOptions.length > 0)) && (
            <FieldRow icon={<GitBranch className="size-4" aria-hidden />} label="선행 작업">
              <div className="flex flex-col gap-1.5">
                {detail.predecessorIds.length > 0 ? (
                  <div className="flex flex-wrap gap-1.5">
                    {detail.predecessorIds.map((id) => {
                      const opt = detail.predecessorOptions.find((o) => o.id === id);
                      return (
                        <span
                          key={id}
                          className="rounded-md bg-[var(--que-bg-muted)] px-2 py-0.5 text-xs text-[var(--que-text)]"
                        >
                          {opt?.title ?? id}
                        </span>
                      );
                    })}
                  </div>
                ) : (
                  <span className="text-sm text-[var(--que-text-tertiary)]">없음</span>
                )}
                {canEdit && detail.predecessorOptions.length > 0 && (
                  <details className="group">
                    <summary className="cursor-pointer list-none text-xs font-medium text-[var(--que-brand)] select-none">
                      연결 편집 <span className="group-open:hidden">▾</span>
                      <span className="hidden group-open:inline">▴</span>
                    </summary>
                    {/* 검색형 선택 — 후보가 수십 개면 스크롤로 못 찾는다. 검색은 제목 기준,
                        목록 기본 순서는 마감일 최신순(서버 정렬). 선택 즉시 커밋(기존 패턴 유지). */}
                    <Command className="mt-1.5 rounded-lg border border-[var(--que-border)] bg-transparent">
                      <CommandInput placeholder="작업 이름으로 검색" aria-label="선행 작업 검색" />
                      <CommandList className="max-h-44">
                        <CommandEmpty>일치하는 작업이 없습니다.</CommandEmpty>
                        {detail.predecessorOptions.map((o) => {
                          const checked = detail.predecessorIds.includes(o.id);
                          return (
                            <CommandItem
                              key={o.id}
                              // 제목이 겹칠 수 있어 id를 붙여 유일하게(검색은 제목으로 걸린다).
                              value={`${o.title} ${o.id}`}
                              data-checked={checked}
                              disabled={pending}
                              onSelect={() => {
                                const next = checked
                                  ? detail.predecessorIds.filter((id) => id !== o.id)
                                  : [...detail.predecessorIds, o.id];
                                run(
                                  () =>
                                    setTaskPredecessorsAction({
                                      taskId: detail.taskId,
                                      predecessorIds: next,
                                    }),
                                  { success: "선행 작업을 저장했습니다" },
                                );
                              }}
                              className="min-h-10 cursor-pointer"
                            >
                              <span className="min-w-0 flex-1 truncate text-[var(--que-text)]">{o.title}</span>
                              <span className="shrink-0 text-[11px] text-[var(--que-text-tertiary)]">
                                {o.dueLabel ? `${o.dueLabel} · ` : ""}
                                {o.statusLabel}
                              </span>
                            </CommandItem>
                          );
                        })}
                      </CommandList>
                    </Command>
                  </details>
                )}
                <p className="text-[11px] leading-relaxed text-[var(--que-text-tertiary)]">
                  선행 작업이 끝나야 이 작업을 시작할 수 있습니다. 간트 보기에서 화살표로 연결되고,
                  선행이 늦어지면 일정 주의가 표시됩니다.
                </p>
              </div>
            </FieldRow>
          )}
        </dl>

        {/* 설명 */}
        <div className="mt-5 border-t border-[var(--que-border)] pt-5">
          <label
            htmlFor="task-description"
            className="text-sm font-medium text-[var(--que-text-secondary)]"
          >
            설명
          </label>
          {canEdit ? (
            <Textarea
              id="task-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="설명을 입력하세요."
              className="mt-2 min-h-24 border-[var(--que-border)] text-sm leading-relaxed"
            />
          ) : (
            <p className="mt-2 text-sm leading-relaxed whitespace-pre-wrap text-[var(--que-text)]">
              {detail.description ?? "설명 없음"}
            </p>
          )}
        </div>

        {!canEdit ? (
          <p className="mt-5 rounded-lg border border-dashed border-[var(--que-border)] p-3 text-sm text-[var(--que-text-secondary)]">
            이 작업은 본인, 프로젝트 담당자, 관리자만 수정할 수 있습니다. 아래 댓글로 의견이나 도움
            요청을 남길 수 있습니다.
          </p>
        ) : null}

        {/* 최근 변경 이력 — core ChangeLog(via:web) 읽기 전용 표시. 누가·무엇을·언제. */}
        {detail.activity.length > 0 ? (
          <div className="mt-5 border-t border-[var(--que-border)] pt-5">
            <p className="text-sm font-medium text-[var(--que-text-secondary)]">최근 변경</p>
            <ul className="mt-3 space-y-2.5">
              {detail.activity.map((item) => (
                <li key={item.id} className="flex gap-2 text-sm leading-snug">
                  <span
                    className="mt-1.5 size-1.5 shrink-0 rounded-full bg-[var(--que-text-tertiary)]"
                    aria-hidden
                  />
                  <span className="min-w-0 text-[var(--que-text)]">
                    <span className="font-medium">{item.actorName}</span>님이 {item.text}
                    <span className="ml-1 text-xs text-[var(--que-text-tertiary)]">
                      · {item.timeLabel}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {/* 댓글·도움 요청 — 타인 작업에도 항상 노출(기획 권한 모델) */}
        <div className="mt-5 border-t border-[var(--que-border)] pt-5">
          <TaskComments taskId={detail.taskId} comments={detail.comments} />
        </div>
      </div>

      {/* 저장 바 */}
      {canEdit ? (
        <footer className="flex shrink-0 items-center justify-end gap-2 border-t border-[var(--que-border)] px-5 py-3">
          <Button onClick={save} disabled={!dirty || titleEmpty || pending} className="h-10 px-5">
            저장
          </Button>
        </footer>
      ) : null}

      {/* 홀드·문제 이동 사유 */}
      <BlockedStatusDialog
        open={blockedOpen}
        onOpenChange={setBlockedOpen}
        taskTitle={detail.title}
        pending={pending}
        onConfirm={confirmBlocked}
      />

      {/* 삭제 확인 */}
      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>작업 삭제</DialogTitle>
            <DialogDescription>
              &quot;{detail.title}&quot; 작업을 삭제하면 목록에서 사라지고 취소 상태로 보관됩니다.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose render={<Button variant="outline" className="h-10" />}>취소</DialogClose>
            <Button variant="destructive" className="h-10" disabled={pending} onClick={remove}>
              삭제
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function FieldRow({
  icon,
  label,
  children,
}: {
  icon: React.ReactNode;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-10 items-center gap-3 py-1">
      <dt className="flex w-24 shrink-0 items-center gap-2 text-sm text-[var(--que-text-secondary)]">
        <span className="text-[var(--que-text-tertiary)]">{icon}</span>
        {label}
      </dt>
      <dd className="min-w-0 flex-1">{children}</dd>
    </div>
  );
}
