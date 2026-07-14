"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { format } from "date-fns";
import { FileText, Pencil } from "lucide-react";
import {
  extractActionsAction,
  updateMeetingNoteTitleAction,
} from "@/app/(app)/meeting-notes/actions";
import { useSafeAction } from "@/components/app/use-safe-action";
import { ToneBadge } from "@/components/app/tone-badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import { stripMarkdown } from "@/lib/markdown";
import { cn } from "@/lib/utils";

export interface NoteListItem {
  id: string;
  title: string;
  fileName: string;
  projectName?: string;
  meetingAt: string;
  uploaderName: string;
  extractionStatus: "pending" | "done";
  candidateCount: number;
  markdownBody: string;
  visibility: "team" | "project" | "admin" | "restricted";
  restrictedCount?: number;
  /** 제목 편집 가능(업로더·관리자 — 서버 조립). 연필 노출 게이트: UI 숨김+서버 강제 3중 관례. */
  canEdit?: boolean;
}

/** 업로드된 회의록 목록. 원문 미리보기(Sheet)와 Action 추출 버튼을 제공한다.
 *  highlightId(전역 검색 딥링크 /meeting-notes?note=<id>)가 있으면 해당 행을 강조·스크롤한다. */
export function NoteList({
  notes,
  highlightId,
}: {
  notes: NoteListItem[];
  highlightId?: string;
}) {
  return (
    <div className="flex flex-col gap-2">
      {notes.length === 0 && (
        <p className="rounded-xl border border-dashed border-[var(--que-border)] bg-[var(--que-bg-muted)] py-10 text-center text-sm text-[var(--que-text-tertiary)]">
          업로드된 회의록이 없습니다.
        </p>
      )}
      {notes.map((note) => (
        <NoteRow key={note.id} note={note} highlighted={note.id === highlightId} />
      ))}
    </div>
  );
}

function NoteRow({ note, highlighted }: { note: NoteListItem; highlighted: boolean }) {
  const { run, pending } = useSafeAction();
  const rowRef = useRef<HTMLDivElement | null>(null);

  // 제목 인라인 편집(업로더·관리자만 — 서버 강제, 실패 시 토스트+원복). sr-only SheetTitle 유지.
  const { run: runTitle, pending: titlePending } = useSafeAction();
  const [title, setTitle] = useState(note.title);
  const [editingTitle, setEditingTitle] = useState(false);
  const titleCommittedRef = useRef(true);

  const beginTitleEdit = () => {
    setTitle(note.title);
    titleCommittedRef.current = false;
    setEditingTitle(true);
  };
  const commitTitle = () => {
    if (titleCommittedRef.current) return;
    titleCommittedRef.current = true;
    setEditingTitle(false);
    const trimmed = title.trim();
    if (!trimmed) {
      setTitle(note.title);
      return;
    }
    if (trimmed === note.title) return;
    runTitle(() => updateMeetingNoteTitleAction({ meetingNoteId: note.id, title: trimmed }), {
      success: "회의록 제목을 수정했습니다.",
      onError: () => setTitle(note.title), // 저장 실패 시 표시 원복
    });
  };
  const cancelTitleEdit = () => {
    titleCommittedRef.current = true;
    setTitle(note.title);
    setEditingTitle(false);
  };

  // 딥링크로 강조된 행은 마운트 시 화면 안으로 스크롤한다.
  useEffect(() => {
    if (highlighted) rowRef.current?.scrollIntoView({ block: "center" });
  }, [highlighted]);

  const extract = () => {
    run(() => extractActionsAction(note.id), {
      success: "Action 후보를 추출했습니다. Action 화면에서 확정해주세요.",
    });
  };

  return (
    <div
      ref={rowRef}
      className={cn(
        "flex min-h-12 scroll-mt-4 flex-wrap items-center gap-2 rounded-xl border bg-[var(--que-bg)] px-3.5 py-3",
        highlighted
          ? "border-[var(--que-brand)] bg-[var(--que-brand-subtle)] ring-2 ring-[var(--que-brand)]"
          : "border-[var(--que-border)]",
      )}
    >
      <span
        className="hidden size-9 shrink-0 items-center justify-center rounded-lg bg-[var(--que-brand-subtle)] text-[var(--que-brand)] sm:flex"
        aria-hidden
      >
        <FileText className="size-[18px]" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-[var(--que-text)]">{note.title}</p>
        <p className="truncate text-xs text-[var(--que-text-tertiary)]">
          {note.fileName} · {format(new Date(note.meetingAt), "M/d")} ·{" "}
          {note.projectName ?? "프로젝트 미지정"} · 업로드 {note.uploaderName}
        </p>
      </div>
      {note.visibility === "admin" && <ToneBadge tone="violet">관리자 전용</ToneBadge>}
      {note.visibility === "restricted" && (
        <ToneBadge tone="violet">지정 인원 {note.restrictedCount ?? 0}명만</ToneBadge>
      )}
      {note.extractionStatus === "pending" ? (
        <ToneBadge tone="amber">추출 대기</ToneBadge>
      ) : (
        <ToneBadge tone="blue">후보 {note.candidateCount}건</ToneBadge>
      )}

      <Sheet>
        <SheetTrigger
          render={<Button variant="outline" size="sm" className="h-10 rounded-lg" />}
        >
          원문
        </SheetTrigger>
        <SheetContent side="right" className="w-full max-w-lg p-5">
          <SheetHeader className="p-0 pb-3 text-left">
            {editingTitle ? (
              <>
                {/* 편집 중에도 접근성용 제목 유지(sr-only) — task-status-sheet 선례 */}
                <SheetTitle className="sr-only">{title}</SheetTitle>
                <Input
                  autoFocus
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      commitTitle();
                    } else if (e.key === "Escape") {
                      e.preventDefault();
                      cancelTitleEdit();
                    }
                  }}
                  onBlur={commitTitle}
                  aria-label={`${note.title} 제목 수정 입력`}
                  className="h-10 w-full rounded-lg text-base font-semibold"
                />
              </>
            ) : (
              <div className="flex items-center gap-2">
                <SheetTitle className="min-w-0 flex-1">{title}</SheetTitle>
                {note.canEdit && (
                  <Button
                    type="button"
                    variant="ghost"
                    aria-label="제목 수정"
                    className="size-10 shrink-0 rounded-lg p-0 text-[var(--que-text-tertiary)]"
                    disabled={titlePending}
                    onClick={beginTitleEdit}
                  >
                    <Pencil className="size-4" aria-hidden />
                  </Button>
                )}
              </div>
            )}
            <SheetDescription>{note.fileName} — 원문은 항상 보존됩니다</SheetDescription>
          </SheetHeader>
          <ScrollArea className="h-[calc(100dvh-8rem)] rounded-lg border border-[var(--que-border)] p-3">
            <div className="whitespace-pre-wrap text-xs leading-relaxed text-[var(--que-text-secondary)]">
              {stripMarkdown(note.markdownBody)}
            </div>
          </ScrollArea>
        </SheetContent>
      </Sheet>

      {note.extractionStatus === "pending" ? (
        <Button
          size="sm"
          className="h-10 rounded-lg bg-[var(--que-brand)] px-3.5 text-[var(--que-on-brand)] hover:bg-[var(--que-brand-hover)]"
          disabled={pending}
          onClick={extract}
        >
          {pending ? "추출 중…" : "Action 추출"}
        </Button>
      ) : (
        <Link
          href={`/action?note=${note.id}`}
          className={cn(buttonVariants({ variant: "outline", size: "sm" }), "h-10 rounded-lg")}
        >
          후보 보기
        </Link>
      )}
    </div>
  );
}
