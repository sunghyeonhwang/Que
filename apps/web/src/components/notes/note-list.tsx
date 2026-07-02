"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { format } from "date-fns";
import { toast } from "sonner";
import { extractActionsAction } from "@/app/(app)/meeting-notes/actions";
import { Badge } from "@/components/ui/badge";
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
}

/** 업로드된 회의록 목록. 원문 미리보기(Sheet)와 Action 추출 버튼을 제공한다. */
export function NoteList({ notes }: { notes: NoteListItem[] }) {
  return (
    <div className="flex flex-col gap-2">
      {notes.length === 0 && (
        <p className="py-6 text-center text-sm text-muted-foreground">
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
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const extract = () => {
    startTransition(async () => {
      const result = await extractActionsAction(note.id);
      if (result.ok) {
        toast.success("Action 후보를 추출했습니다. Action 화면에서 확정해주세요.");
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  };

  return (
    <div className="flex min-h-12 flex-wrap items-center gap-2 rounded-md border px-3 py-2">
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{note.title}</p>
        <p className="truncate text-xs text-muted-foreground">
          {note.fileName} · {format(new Date(note.meetingAt), "M/d")} ·{" "}
          {note.projectName ?? "프로젝트 미지정"} · 업로드 {note.uploaderName}
        </p>
      </div>
      {note.extractionStatus === "pending" ? (
        <Badge variant="secondary">추출 대기</Badge>
      ) : (
        <Badge variant="outline">후보 {note.candidateCount}건</Badge>
      )}

      <Sheet>
        <SheetTrigger
          render={<Button variant="outline" size="sm" className="h-10" />}
        >
          원문
        </SheetTrigger>
        <SheetContent side="right" className="w-full max-w-lg p-5">
          <SheetHeader className="p-0 pb-3 text-left">
            <SheetTitle>{note.title}</SheetTitle>
            <SheetDescription>{note.fileName} — 원문은 항상 보존됩니다</SheetDescription>
          </SheetHeader>
          <ScrollArea className="h-[calc(100dvh-8rem)] rounded-md border p-3">
            <pre className="text-xs whitespace-pre-wrap">{note.markdownBody}</pre>
          </ScrollArea>
        </SheetContent>
      </Sheet>

      {note.extractionStatus === "pending" ? (
        <Button size="sm" className="h-10" disabled={pending} onClick={extract}>
          {pending ? "추출 중…" : "Action 추출"}
        </Button>
      ) : (
        <Link
          href={`/action?note=${note.id}`}
          className={cn(buttonVariants({ variant: "secondary", size: "sm" }), "h-10")}
        >
          후보 보기
        </Link>
      )}
    </div>
  );
}
