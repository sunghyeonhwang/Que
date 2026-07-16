"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { format } from "date-fns";
import { FileText, Loader2, Pencil, RefreshCw, Sparkles } from "lucide-react";
import { toast } from "sonner";
import {
  extractActionsAction,
  regenerateNoteSummaryAction,
  updateMeetingNoteTitleAction,
} from "@/app/(app)/meeting-notes/actions";
import { useSafeAction } from "@/components/app/use-safe-action";
import { reportError } from "@/lib/report-error";
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
  /** AI 요약(업로드 시 자동 생성) — 열람 가능한 회의록만 서버가 조립해 내린다. 렌더는 UI 몫. */
  aiSummary?: { content: string; generatedAt: string };
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
        {/* 목록 행 제목 인라인 편집(발견성 ↑) — 시트 안 연필과 같은 state·규약 공유(refresh로 동기). */}
        {editingTitle ? (
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
            className="h-9 w-full rounded-lg text-sm font-medium"
          />
        ) : (
          <div className="flex items-center gap-1">
            <p className="min-w-0 flex-1 truncate text-sm font-medium text-[var(--que-text)]">
              {title}
            </p>
            {note.canEdit && (
              <Button
                type="button"
                variant="ghost"
                aria-label="제목 수정"
                className="size-9 shrink-0 rounded-lg p-0 text-[var(--que-text-tertiary)]"
                disabled={titlePending}
                onClick={(e) => {
                  e.stopPropagation();
                  beginTitleEdit();
                }}
              >
                <Pencil className="size-4" aria-hidden />
              </Button>
            )}
          </div>
        )}
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
        <SheetContent side="right" className="flex w-full max-w-lg flex-col p-5">
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
          <NoteSummaryPanel
            noteId={note.id}
            canEdit={!!note.canEdit}
            initial={note.aiSummary}
          />
          <div className="flex min-h-0 flex-1 flex-col gap-1.5">
            <p className="text-xs font-medium text-[var(--que-text-tertiary)]">원문</p>
            <ScrollArea className="min-h-0 flex-1 rounded-lg border border-[var(--que-border)] p-3">
              <div className="whitespace-pre-wrap text-xs leading-relaxed text-[var(--que-text-secondary)]">
                {stripMarkdown(note.markdownBody)}
              </div>
            </ScrollArea>
          </div>
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

/**
 * 원문 시트 안의 AI 요약 섹션. 업로드 시 자동 생성된 요약을 보여주고, 없으면 생성을,
 * 있으면 재생성을 제공한다(둘 다 업로더·관리자만 — canEdit 게이트, 서버가 최종 강제).
 * 재생성 성공 시 서버가 돌려준 새 요약으로 로컬 state를 즉시 갱신한다(refresh 대기 없이 반영).
 */
function NoteSummaryPanel({
  noteId,
  canEdit,
  initial,
}: {
  noteId: string;
  canEdit: boolean;
  initial?: { content: string; generatedAt: string };
}) {
  const [summary, setSummary] = useState(initial);
  const { pending, startTransition } = useSafeAction();

  const regenerate = () => {
    const isRegen = !!summary;
    startTransition(async () => {
      try {
        const res = await regenerateNoteSummaryAction(noteId);
        if (!res.ok) {
          toast.error(res.error);
          return;
        }
        setSummary({ content: res.summary.content, generatedAt: res.summary.generatedAt });
        toast.success(isRegen ? "AI 요약을 다시 생성했습니다." : "AI 요약을 생성했습니다.");
      } catch (error) {
        reportError(error, { source: "server-action" });
        toast.error("AI 요약 생성 중 오류가 발생했습니다.");
      }
    });
  };

  return (
    <section
      aria-label="AI 요약"
      className="rounded-lg border border-[var(--que-border)] bg-[var(--que-bg-muted)] p-3"
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-1.5">
          <Sparkles className="size-4 shrink-0 text-[var(--que-brand)]" aria-hidden />
          <h3 className="text-sm font-semibold text-[var(--que-text)]">AI 요약</h3>
          {summary && (
            <span className="truncate text-xs text-[var(--que-text-tertiary)]">
              · {format(new Date(summary.generatedAt), "M/d HH:mm")} 생성
            </span>
          )}
        </div>
        {canEdit && summary && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-8 shrink-0 gap-1.5 rounded-md px-2 text-xs text-[var(--que-text-secondary)]"
            disabled={pending}
            onClick={regenerate}
          >
            {pending ? (
              <Loader2 className="size-3.5 animate-spin" aria-hidden />
            ) : (
              <RefreshCw className="size-3.5" aria-hidden />
            )}
            재생성
          </Button>
        )}
      </div>
      {summary ? (
        <NoteSummaryBody content={summary.content} />
      ) : (
        <div className="mt-2 flex flex-col items-start gap-2">
          <p className="text-sm text-[var(--que-text-tertiary)]">AI 요약이 없습니다.</p>
          {canEdit && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-9 gap-1.5 rounded-lg"
              disabled={pending}
              onClick={regenerate}
            >
              {pending ? (
                <Loader2 className="size-4 animate-spin" aria-hidden />
              ) : (
                <Sparkles className="size-4" aria-hidden />
              )}
              {pending ? "생성 중…" : "AI 요약 생성"}
            </Button>
          )}
        </div>
      )}
    </section>
  );
}

/** 요약 본문(md 불릿 텍스트)을 React 요소로 렌더한다 — 불릿 줄은 목록, 그 외는 문단.
 *  텍스트를 React children으로만 넣으므로(자동 이스케이프) dangerouslySetInnerHTML 없이 XSS 안전하다.
 *  강조·코드 마커(**, `)는 표시용으로만 벗긴다(요약 프롬프트는 애초에 이들을 쓰지 않는다). */
function NoteSummaryBody({ content }: { content: string }) {
  const cleanInline = (s: string) =>
    s.replace(/\*\*(.+?)\*\*/g, "$1").replace(/`([^`]+)`/g, "$1");
  const blocks: ReactNode[] = [];
  let bullets: string[] = [];
  const flush = () => {
    if (bullets.length === 0) return;
    const items = bullets;
    blocks.push(
      <ul
        key={`ul-${blocks.length}`}
        className="flex list-disc flex-col gap-1 pl-4 text-sm leading-relaxed text-[var(--que-text-secondary)]"
      >
        {items.map((b, i) => (
          <li key={i}>{cleanInline(b)}</li>
        ))}
      </ul>,
    );
    bullets = [];
  };
  for (const raw of content.replace(/\r\n/g, "\n").split("\n")) {
    const line = raw.trim();
    if (!line) {
      flush();
      continue;
    }
    const bullet = line.match(/^[-*]\s+(.*)$/);
    if (bullet) {
      bullets.push(bullet[1]);
    } else {
      flush();
      blocks.push(
        <p
          key={`p-${blocks.length}`}
          className="text-sm leading-relaxed text-[var(--que-text-secondary)]"
        >
          {cleanInline(line)}
        </p>,
      );
    }
  }
  flush();
  return <div className="mt-2 flex flex-col gap-2">{blocks}</div>;
}
