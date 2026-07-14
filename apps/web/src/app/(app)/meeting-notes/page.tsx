import { canViewMeetingNote, formatProjectLabel } from "@que/core";
import { PageHeader } from "@/components/app/page-header";
import { NoteTabs } from "@/components/app/note-tabs";
import { NoteList, type NoteListItem } from "@/components/notes/note-list";
import { NoteSummaryCards } from "@/components/notes/note-summary-cards";
import { UploadNoteForm } from "@/components/notes/upload-note-form";
import { getCurrentUser } from "@/lib/current-user";
import { getNoteSummary } from "@/lib/notes-summary";
import { getDb } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function MeetingNotesPage({
  searchParams,
}: {
  searchParams: Promise<{ note?: string }>;
}) {
  const { note: highlightNoteId } = await searchParams;
  const user = await getCurrentUser();
  const db = await getDb();
  const summary = await getNoteSummary(user);
  const userById = new Map(db.users.map((u) => [u.id, u]));
  const projectById = new Map(db.projects.map((p) => [p.id, p]));
  const clientById = new Map(db.clients.map((c) => [c.id, c]));
  const projectLabel = (projectId?: string): string | undefined => {
    if (!projectId) return undefined;
    const project = projectById.get(projectId);
    if (!project) return undefined;
    return formatProjectLabel(project, project.clientId ? clientById.get(project.clientId) : undefined);
  };
  // 다중 프로젝트 라벨 — projectIds 우선, 없으면 단일 projectId. 넘치면 "· N개"로 축약.
  const multiProjectLabel = (ids: string[] | undefined, single?: string): string | undefined => {
    const source = ids?.length ? ids : single ? [single] : [];
    const labels = source.map(projectLabel).filter((l): l is string => Boolean(l));
    if (labels.length === 0) return undefined;
    if (labels.length === 1) return labels[0];
    return `${labels[0]} · ${labels.length}개`;
  };
  // 업로드 폼 프로젝트 선택 — 옵션 라벨에 "클라이언트 · 프로젝트"를 병기해 어느 거래처 건인지 명확히.
  const projectOptions = db.projects.map((p) => ({
    id: p.id,
    name: formatProjectLabel(p, p.clientId ? clientById.get(p.clientId) : undefined),
  }));

  const notes: NoteListItem[] = [...db.meetingNotes]
    // 공개 범위: admin 전용/지정 인원 전용 회의록은 관리자·업로더(+지정 인원)만
    .filter((note) => canViewMeetingNote(user, note))
    .sort((a, b) => b.meetingAt.localeCompare(a.meetingAt))
    .map((note) => ({
      id: note.id,
      title: note.title,
      fileName: note.fileName,
      projectName: multiProjectLabel(note.projectIds, note.projectId),
      meetingAt: note.meetingAt,
      uploaderName: userById.get(note.uploaderId)?.name ?? note.uploaderId,
      extractionStatus: note.extractionStatus,
      candidateCount: db.actionItems.filter((a) => a.meetingNoteId === note.id).length,
      markdownBody: note.markdownBody,
      visibility: note.visibility,
      restrictedCount: note.restrictedUserIds?.length,
      // 제목 편집 권한(업로더·관리자) — 서버 판정을 내려 연필 노출을 게이트(core가 재강제).
      canEdit: note.uploaderId === user.id || user.role === "admin",
    }));

  return (
    <div>
      <PageHeader
        title="회의록"
        subtitle="Plaud 회의록을 업로드하고 Action 추출 대상으로 관리합니다 — 원문은 항상 보존됩니다"
      />

      <NoteSummaryCards summary={summary} />

      <NoteTabs active="notes" />

      <div className="grid gap-4 xl:grid-cols-[minmax(0,26rem)_minmax(0,1fr)]">
        <UploadNoteForm projects={projectOptions} />
        {/* 좁은 폭(태블릿 가로 등)에서는 목록을 위로, xl 2열에서는 원래 순서(폼 좌·목록 우). */}
        <div className="order-first min-w-0 xl:order-none">
          <div className="mb-2 flex items-baseline gap-2">
            <h2 className="text-base font-semibold text-[var(--que-text)]">업로드된 회의록</h2>
            <span className="text-xs text-[var(--que-text-tertiary)] tabular-nums">
              {notes.length}건
            </span>
          </div>
          <div className="max-h-[calc(100dvh-16rem)] overflow-y-auto pr-0.5">
            <NoteList notes={notes} highlightId={highlightNoteId} />
          </div>
        </div>
      </div>
    </div>
  );
}
