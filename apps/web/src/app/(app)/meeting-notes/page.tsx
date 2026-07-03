import { canViewMeetingNote } from "@que/core";
import { PageHeader } from "@/components/app/page-header";
import { NoteList, type NoteListItem } from "@/components/notes/note-list";
import { UploadNoteForm } from "@/components/notes/upload-note-form";
import { getCurrentUser } from "@/lib/current-user";
import { getDb } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function MeetingNotesPage() {
  const user = await getCurrentUser();
  const db = getDb();
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
        title="회의록"
        subtitle="Plaud 회의록을 업로드하고 Action 추출 대상으로 관리합니다 — 원문은 항상 보존됩니다"
      />
      <div className="grid gap-4 xl:grid-cols-[minmax(0,26rem)_minmax(0,1fr)]">
        <UploadNoteForm projects={db.projects} />
        <div>
          <h2 className="mb-2 text-base font-semibold">업로드된 회의록</h2>
          <NoteList notes={notes} />
        </div>
      </div>
    </div>
  );
}
