import { canViewMeetingNote } from "@que/core";
import { PageHeader } from "@/components/app/page-header";
import { NoteTabs } from "@/components/app/note-tabs";
import { NoteList, type NoteListItem } from "@/components/notes/note-list";
import { NoteSummaryCards } from "@/components/notes/note-summary-cards";
import { UploadNoteForm } from "@/components/notes/upload-note-form";
import { getCurrentUser } from "@/lib/current-user";
import { getNoteSummary } from "@/lib/notes-summary";
import { getDb } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function MeetingNotesPage() {
  const user = await getCurrentUser();
  const db = await getDb();
  const summary = await getNoteSummary(user);
  const userById = new Map(db.users.map((u) => [u.id, u]));
  const projectById = new Map(db.projects.map((p) => [p.id, p]));

  const notes: NoteListItem[] = [...db.meetingNotes]
    // 공개 범위: admin 전용/지정 인원 전용 회의록은 관리자·업로더(+지정 인원)만
    .filter((note) => canViewMeetingNote(user, note))
    .sort((a, b) => b.meetingAt.localeCompare(a.meetingAt))
    .map((note) => ({
      id: note.id,
      title: note.title,
      fileName: note.fileName,
      projectName: note.projectId ? projectById.get(note.projectId)?.name : undefined,
      meetingAt: note.meetingAt,
      uploaderName: userById.get(note.uploaderId)?.name ?? note.uploaderId,
      extractionStatus: note.extractionStatus,
      candidateCount: db.actionItems.filter((a) => a.meetingNoteId === note.id).length,
      markdownBody: note.markdownBody,
      visibility: note.visibility,
      restrictedCount: note.restrictedUserIds?.length,
    }));

  return (
    <div>
      <PageHeader
        title="확인필요"
        subtitle="Plaud 회의록을 업로드하고 Action 추출 대상으로 관리합니다 — 원문은 항상 보존됩니다"
      />

      <NoteSummaryCards summary={summary} />

      <NoteTabs active="notes" />

      <div className="grid gap-4 xl:grid-cols-[minmax(0,26rem)_minmax(0,1fr)]">
        <UploadNoteForm projects={db.projects} />
        <div className="min-w-0">
          <div className="mb-2 flex items-baseline gap-2">
            <h2 className="text-base font-semibold text-[var(--que-text)]">업로드된 회의록</h2>
            <span className="text-xs text-[var(--que-text-tertiary)] tabular-nums">
              {notes.length}건
            </span>
          </div>
          <div className="max-h-[calc(100dvh-16rem)] overflow-y-auto pr-0.5">
            <NoteList notes={notes} />
          </div>
        </div>
      </div>
    </div>
  );
}
