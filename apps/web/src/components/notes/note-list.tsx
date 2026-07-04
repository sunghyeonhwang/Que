"use client";

import Link from "next/link";
import { format } from "date-fns";
import { FileText } from "lucide-react";
import { extractActionsAction } from "@/app/(app)/meeting-notes/actions";
import { useSafeAction } from "@/components/app/use-safe-action";
import { ToneBadge } from "@/components/app/tone-badge";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
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
}

/** 업로드된 회의록 목록. 원문 미리보기(Sheet)와 Action 추출 버튼을 제공한다. */
export function NoteList({ notes }: { notes: NoteListItem[] }) {
  return (
    <div className="flex flex-col gap-2">
      {notes.length === 0 && (
        <p className="rounded-xl border border-dashed border-[var(--que-border)] bg-[var(--que-bg-muted)] py-10 text-center text-sm text-[var(--que-text-tertiary)]">
          업로드된 회의록이 없습니다.
        </p>
      )}
      {notes.map((note) => (
        <NoteRow key={note.id} note={note} />
      ))}
    </div>
  );
}

function NoteRow({ note }: { note: NoteListItem }) {
  const { run, pending } = useSafeAction();

  const extract = () => {
    run(() => extractActionsAction(note.id), {
      success: "Action 후보를 추출했습니다. Action 화면에서 확정해주세요.",
    });
  };

  return (
    <div className="flex min-h-12 flex-wrap items-center gap-2 rounded-xl border border-[var(--que-border)] bg-[var(--que-bg)] px-3.5 py-3">
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
            <SheetTitle>{note.title}</SheetTitle>
            <SheetDescription>{note.fileName} — 원문은 항상 보존됩니다</SheetDescription>
          </SheetHeader>
          <ScrollArea className="h-[calc(100dvh-8rem)] rounded-lg border border-[var(--que-border)] p-3">
            <pre className="text-xs whitespace-pre-wrap">{note.markdownBody}</pre>
          </ScrollArea>
        </SheetContent>
      </Sheet>

      {note.extractionStatus === "pending" ? (
        <Button
          size="sm"
          className="h-10 rounded-lg bg-[var(--que-brand)] px-3.5 text-white hover:bg-[var(--que-brand-hover)]"
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
