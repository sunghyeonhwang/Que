"use client";

import { useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  Clock,
  Flag,
  FolderOpen,
  MoreHorizontal,
  Paperclip,
  Plus,
  Users,
  X,
  CalendarDays,
  FileText,
  FileImage,
  File as FileIcon,
} from "lucide-react";
import type { AttachmentKind, PmAttachment, TaskDetailView } from "@/lib/pm-data";
import { Sheet, SheetClose, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { PriorityBadge } from "./priority-badge";
import { MemberAvatars } from "./member-avatars";
import { cn } from "@/lib/utils";

/** hex(#rrggbb)에 2자리 알파를 붙여 옅은 틴트로. */
function tint(hex: string, alpha: string): string {
  return `${hex}${alpha}`;
}

/**
 * 태스크 상세 드로어 — 열림 상태는 URL(`?task=<id>`)로 관리한다.
 * `detail`이 있으면 열리고, 닫으면 현재 URL에서 `task` 파라미터만 제거한다(view/month 보존).
 */
export function TaskDetailDrawer({ detail }: { detail: TaskDetailView | null }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // 열림 상태는 URL(detail 유무)에서 파생한다. 닫힘 애니메이션 동안 마지막 내용을
  // 유지하려고 최근 detail을 상태로 보관한다(렌더 중 조건부 setState = 이전 렌더 정보
  // 저장의 공식 패턴, id가 바뀔 때만 갱신하므로 루프 없음).
  const open = Boolean(detail);
  const [shown, setShown] = useState<TaskDetailView | null>(detail);
  if (detail && detail.id !== shown?.id) {
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
        {shown ? <DrawerBody detail={shown} /> : null}
      </SheetContent>
    </Sheet>
  );
}

function DrawerBody({ detail }: { detail: TaskDetailView }) {
  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* 헤더 */}
      <header className="flex h-14 shrink-0 items-center justify-between border-b border-[var(--que-border)] px-4">
        <span className="text-sm font-medium text-[var(--que-text-secondary)]">작업 세부 정보</span>
        <div className="flex items-center gap-0.5">
          <Button
            variant="ghost"
            aria-label="더보기"
            aria-disabled
            className="size-10 rounded-lg text-[var(--que-text-secondary)]"
          >
            <MoreHorizontal className="size-4" aria-hidden />
          </Button>
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
        <div className="flex items-start justify-between gap-3">
          <h2 className="text-xl leading-snug font-bold text-[var(--que-text)]">{detail.name}</h2>
          <span
            className="mt-1 inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium text-[var(--que-text)]"
            style={{ backgroundColor: tint(detail.groupColor, "1f") }}
          >
            <span
              className="size-1.5 rounded-full"
              style={{ backgroundColor: detail.groupColor }}
              aria-hidden
            />
            {detail.groupName}
          </span>
        </div>

        {/* 필드 */}
        <dl className="mt-5 space-y-1">
          {detail.category ? (
            <FieldRow icon={<FolderOpen className="size-4" aria-hidden />} label="카테고리">
              <span className="text-sm text-[var(--que-text)]">{detail.category}</span>
            </FieldRow>
          ) : null}

          <FieldRow icon={<Flag className="size-4" aria-hidden />} label="우선순위">
            <PriorityBadge priority={detail.priority} />
          </FieldRow>

          <FieldRow icon={<CalendarDays className="size-4" aria-hidden />} label="마감일">
            <span className="text-sm text-[var(--que-text)]">{detail.dueLabel ?? "—"}</span>
          </FieldRow>

          {detail.timeRange ? (
            <FieldRow icon={<Clock className="size-4" aria-hidden />} label="시간">
              <span className="text-sm text-[var(--que-text)]">{detail.timeRange}</span>
            </FieldRow>
          ) : null}

          <FieldRow icon={<Users className="size-4" aria-hidden />} label="담당자">
            {detail.assignees.length > 0 ? (
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
                {detail.assignees.map((m) => (
                  <span key={m.id} className="flex items-center gap-1.5">
                    <MemberAvatars members={[m]} size={24} />
                    <span className="text-sm text-[var(--que-text)]">{m.name}</span>
                  </span>
                ))}
              </div>
            ) : (
              <span className="text-sm text-[var(--que-text)]">—</span>
            )}
          </FieldRow>
        </dl>

        {/* 설명 */}
        <div className="mt-5 border-t border-[var(--que-border)] pt-5">
          <h3 className="text-sm font-medium text-[var(--que-text-secondary)]">설명</h3>
          <p className="mt-2 text-sm leading-relaxed whitespace-pre-line text-[var(--que-text)]">
            {detail.description}
          </p>
        </div>
      </div>

      {/* 첨부 */}
      {detail.attachments.length > 0 ? (
        <footer className="shrink-0 border-t border-[var(--que-border)] px-5 py-4">
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-1.5 text-sm font-medium text-[var(--que-text-secondary)]">
              <Paperclip className="size-4" aria-hidden />
              첨부 파일
            </span>
            <Button
              variant="ghost"
              aria-disabled
              className="h-8 gap-1 rounded-md px-2 text-xs font-medium text-[var(--que-brand)]"
            >
              <Plus className="size-3.5" aria-hidden />
              파일 추가
            </Button>
          </div>
          <ul className="mt-2 flex flex-wrap gap-2">
            {detail.attachments.map((att) => (
              <li key={att.id} className="min-w-0 flex-1 basis-[calc(50%-0.25rem)]">
                <AttachmentCard attachment={att} />
              </li>
            ))}
          </ul>
        </footer>
      ) : null}
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
      <dt className="flex w-28 shrink-0 items-center gap-2 text-sm text-[var(--que-text-secondary)]">
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
          <button
            type="button"
            aria-disabled
            className="font-medium text-[var(--que-brand)]"
          >
            미리보기
          </button>
        </p>
      </div>
    </div>
  );
}
