"use client";

import { useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  CalendarDays,
  Clock,
  Flag,
  FolderOpen,
  Layers,
  MoreHorizontal,
  Paperclip,
  Plus,
  Trash2,
  Users,
  X,
  FileText,
  FileImage,
  File as FileIcon,
} from "lucide-react";
import type {
  AttachmentKind,
  PmAttachment,
  PmPriority,
  ProjectMeta,
  TaskDetailView,
} from "@/lib/pm-data";
import { deleteTaskAction, updateTaskAction } from "@/app/(app)/projects/pm-actions";
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
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
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
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { MemberAvatars } from "./member-avatars";
import { cn } from "@/lib/utils";

const PRIORITY_ITEMS: Record<PmPriority, string> = {
  high: "높음",
  normal: "보통",
  low: "낮음",
};

/** 담당자 id 집합이 순서 무관하게 같은지. */
function sameIds(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  const set = new Set(b);
  return a.every((id) => set.has(id));
}

/**
 * 태스크 상세/편집 드로어 — 열림 상태는 URL(`?task=<id>`)로 관리한다.
 * `detail`이 있으면 열리고, 닫으면 현재 URL에서 `task` 파라미터만 제거한다(view/month 보존).
 * 편집은 로컬 상태로 모아 '저장' 시 updateTaskAction으로 커밋한다(mock in-place).
 */
export function TaskDetailDrawer({
  detail,
  meta,
}: {
  detail: TaskDetailView | null;
  /** 편집 피커용 프로젝트 메타(담당자·그룹). */
  meta: ProjectMeta;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // 열림 상태는 URL(detail 유무)에서 파생한다. 닫힘 애니메이션 동안 마지막 내용을
  // 유지하려고 최근 detail을 상태로 보관한다. detail은 서버 재렌더마다 새 객체이므로
  // 참조가 바뀔 때(저장→revalidate로 내용이 갱신될 때 포함) 동기화한다 — 저장 후
  // 편집 baseline이 최신화돼 dirty가 해제된다. null(닫힘)일 땐 마지막 내용을 유지.
  const open = Boolean(detail);
  const [shown, setShown] = useState<TaskDetailView | null>(detail);
  if (detail && detail !== shown) {
    setShown(detail);
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
        {shown ? (
          // key로 태스크 전환 시 편집 폼 상태를 초기화한다.
          <DrawerBody key={shown.id} detail={shown} meta={meta} onClose={close} />
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
  detail: TaskDetailView;
  meta: ProjectMeta;
  onClose: () => void;
}) {
  const { run, pending } = useSafeAction();

  const [name, setName] = useState(detail.name);
  const [description, setDescription] = useState(detail.description);
  const [priority, setPriority] = useState<PmPriority>(detail.priority);
  const [dueAt, setDueAt] = useState(detail.dueAt ?? "");
  const [groupId, setGroupId] = useState(detail.groupId);
  const [assigneeIds, setAssigneeIds] = useState<string[]>(detail.assigneeIds);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const nameEmpty = name.trim().length === 0;
  const normDue = dueAt === "" ? null : dueAt;

  // 바뀐 필드만 추려 patch를 만든다(name은 trim해 비교/전송).
  const patch: Parameters<typeof updateTaskAction>[1] = {};
  if (name.trim() !== detail.name) patch.name = name.trim();
  if (description !== detail.description) patch.description = description;
  if (priority !== detail.priority) patch.priority = priority;
  if (normDue !== detail.dueAt) patch.dueAt = normDue;
  if (groupId !== detail.groupId) patch.groupId = groupId;
  if (!sameIds(assigneeIds, detail.assigneeIds)) patch.assigneeIds = assigneeIds;
  const dirty = Object.keys(patch).length > 0;

  const groupItems = Object.fromEntries(meta.groups.map((g) => [g.id, g.name]));
  const currentGroup = meta.groups.find((g) => g.id === groupId);
  const selectedMembers = meta.members.filter((m) => assigneeIds.includes(m.id));

  function save() {
    if (nameEmpty || !dirty) return;
    run(() => updateTaskAction(detail.id, patch), { success: "작업을 저장했습니다" });
  }

  function remove() {
    run(() => deleteTaskAction(detail.id), {
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
        {/* 제목(인라인 편집) */}
        <div>
          <label htmlFor="task-name" className="sr-only">
            작업 이름
          </label>
          <Input
            id="task-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            aria-invalid={nameEmpty}
            placeholder="작업 이름"
            className="h-auto rounded-md border-transparent bg-transparent px-2 py-1.5 text-xl leading-snug font-semibold text-[var(--que-text)] hover:border-[var(--que-border)] md:text-xl"
          />
          {nameEmpty ? (
            <p className="mt-1 px-2 text-xs text-[var(--que-error)]">작업 이름을 입력하세요.</p>
          ) : null}
        </div>

        {/* 필드 */}
        <dl className="mt-5 space-y-1">
          {detail.category ? (
            <FieldRow icon={<FolderOpen className="size-4" aria-hidden />} label="카테고리">
              <span className="text-sm text-[var(--que-text)]">{detail.category}</span>
            </FieldRow>
          ) : null}

          <FieldRow icon={<Layers className="size-4" aria-hidden />} label="상태 그룹">
            <Select
              items={groupItems}
              value={groupId}
              onValueChange={(v) => v && setGroupId(v)}
            >
              <SelectTrigger
                aria-label="상태 그룹 선택"
                className="h-10 min-h-10 w-full gap-2 border-[var(--que-border)]"
              >
                <span
                  className="size-2 shrink-0 rounded-full"
                  style={{ backgroundColor: currentGroup?.color ?? "#9ca3af" }}
                  aria-hidden
                />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {meta.groups.map((g) => (
                  <SelectItem key={g.id} value={g.id}>
                    <span className="flex items-center gap-2">
                      <span
                        className="size-2 rounded-full"
                        style={{ backgroundColor: g.color }}
                        aria-hidden
                      />
                      {g.name}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FieldRow>

          <FieldRow icon={<Flag className="size-4" aria-hidden />} label="우선순위">
            <Select
              items={PRIORITY_ITEMS}
              value={priority}
              onValueChange={(v) => v && setPriority(v as PmPriority)}
            >
              <SelectTrigger
                aria-label="우선순위 선택"
                className="h-10 min-h-10 w-full border-[var(--que-border)]"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(PRIORITY_ITEMS) as PmPriority[]).map((p) => (
                  <SelectItem key={p} value={p}>
                    {PRIORITY_ITEMS[p]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FieldRow>

          <FieldRow icon={<CalendarDays className="size-4" aria-hidden />} label="마감일">
            <Input
              type="date"
              value={dueAt}
              onChange={(e) => setDueAt(e.target.value)}
              aria-label="마감일"
              className="h-10 min-h-10 border-[var(--que-border)]"
            />
          </FieldRow>

          {detail.timeRange ? (
            <FieldRow icon={<Clock className="size-4" aria-hidden />} label="시간">
              <span className="text-sm text-[var(--que-text)]">{detail.timeRange}</span>
            </FieldRow>
          ) : null}

          <FieldRow icon={<Users className="size-4" aria-hidden />} label="담당자">
            <Popover>
              <PopoverTrigger
                render={
                  <Button
                    variant="outline"
                    aria-label="담당자 선택"
                    className="h-auto min-h-10 w-full justify-start gap-2 border-[var(--que-border)] px-2.5 py-1.5 font-normal"
                  />
                }
              >
                {selectedMembers.length > 0 ? (
                  <span className="flex min-w-0 items-center gap-2">
                    <MemberAvatars members={selectedMembers} size={24} />
                    <span className="truncate text-sm text-[var(--que-text)]">
                      {selectedMembers.map((m) => m.name).join(", ")}
                    </span>
                  </span>
                ) : (
                  <span className="text-sm text-[var(--que-text-tertiary)]">담당자 없음</span>
                )}
              </PopoverTrigger>
              <PopoverContent align="start" className="w-64 gap-1 p-1.5">
                <p className="px-1.5 pt-1 pb-1 text-xs font-medium text-[var(--que-text-secondary)]">
                  담당자
                </p>
                <ul>
                  {meta.members.map((m) => {
                    const checked = assigneeIds.includes(m.id);
                    return (
                      <li key={m.id}>
                        <label className="flex min-h-10 cursor-pointer items-center gap-2.5 rounded-md px-1.5 hover:bg-[var(--que-bg-muted)]">
                          <Checkbox
                            checked={checked}
                            onCheckedChange={(next) =>
                              setAssigneeIds((prev) =>
                                next ? [...prev, m.id] : prev.filter((id) => id !== m.id),
                              )
                            }
                            aria-label={`${m.name} 담당 지정`}
                          />
                          <MemberAvatars members={[m]} size={24} />
                          <span className="truncate text-sm text-[var(--que-text)]">{m.name}</span>
                        </label>
                      </li>
                    );
                  })}
                </ul>
              </PopoverContent>
            </Popover>
          </FieldRow>
        </dl>

        {/* 설명 */}
        <div className="mt-5 border-t border-[var(--que-border)] pt-5">
          <label
            htmlFor="task-description"
            className="text-sm font-medium text-[var(--que-text-secondary)]"
          >
            설명
          </label>
          <Textarea
            id="task-description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="설명을 입력하세요."
            className="mt-2 min-h-24 border-[var(--que-border)] text-sm leading-relaxed"
          />
        </div>

        {/* 첨부 */}
        {detail.attachments.length > 0 ? (
          <div className="mt-5 border-t border-[var(--que-border)] pt-5">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-sm font-medium text-[var(--que-text-secondary)]">
                <Paperclip className="size-4" aria-hidden />
                첨부 파일
              </span>
              <Tooltip>
                <TooltipTrigger
                  render={
                    <Button
                      variant="ghost"
                      aria-disabled
                      title="준비 중"
                      className="h-8 gap-1 rounded-md px-2 text-xs font-medium text-[var(--que-brand)]"
                    />
                  }
                >
                  <Plus className="size-3.5" aria-hidden />
                  파일 추가
                </TooltipTrigger>
                <TooltipContent>준비 중</TooltipContent>
              </Tooltip>
            </div>
            <ul className="mt-2 flex flex-wrap gap-2">
              {detail.attachments.map((att) => (
                <li key={att.id} className="min-w-0 flex-1 basis-[calc(50%-0.25rem)]">
                  <AttachmentCard attachment={att} />
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>

      {/* 저장 바 */}
      <footer className="flex shrink-0 items-center justify-end gap-2 border-t border-[var(--que-border)] px-5 py-3">
        <Button
          onClick={save}
          disabled={!dirty || nameEmpty || pending}
          className="h-10 px-5"
        >
          저장
        </Button>
      </footer>

      {/* 삭제 확인 */}
      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>작업 삭제</DialogTitle>
            <DialogDescription>
              &quot;{detail.name}&quot; 작업을 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.
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

const KIND_STYLE: Record<AttachmentKind, { className: string; icon: React.ReactNode }> = {
  pdf: {
    className: "bg-[var(--que-error-bg)] text-[var(--que-error)]",
    icon: <FileText className="size-4" aria-hidden />,
  },
  doc: {
    className: "bg-[var(--que-brand-subtle)] text-[var(--que-brand)]",
    icon: <FileText className="size-4" aria-hidden />,
  },
  img: {
    className: "bg-[var(--que-success-bg)] text-[var(--que-success)]",
    icon: <FileImage className="size-4" aria-hidden />,
  },
  file: {
    className: "bg-[var(--que-bg-muted)] text-[var(--que-text-secondary)]",
    icon: <FileIcon className="size-4" aria-hidden />,
  },
};

function AttachmentCard({ attachment }: { attachment: PmAttachment }) {
  const style = KIND_STYLE[attachment.kind];
  return (
    <div className="flex items-center gap-2.5 rounded-lg border border-[var(--que-border)] p-2.5">
      <span
        className={cn(
          "flex size-9 shrink-0 items-center justify-center rounded-md",
          style.className,
        )}
        aria-hidden
      >
        {style.icon}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-[var(--que-text)]">{attachment.name}</p>
        <p className="mt-0.5 flex items-center gap-1.5 text-xs text-[var(--que-text-tertiary)]">
          <span>{attachment.sizeLabel}</span>
          <span aria-hidden>·</span>
          <Tooltip>
            <TooltipTrigger
              render={
                <button
                  type="button"
                  aria-disabled
                  title="준비 중"
                  className="font-medium text-[var(--que-brand)]"
                />
              }
            >
              미리보기
            </TooltipTrigger>
            <TooltipContent>준비 중</TooltipContent>
          </Tooltip>
        </p>
      </div>
    </div>
  );
}
