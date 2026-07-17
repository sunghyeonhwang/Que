import { canViewMeetingNote, formatProjectLabel } from "@que/core";
import { PageHeader } from "@/components/app/page-header";
import { NoteTabs } from "@/components/app/note-tabs";
import { NoteList, type NoteListItem } from "@/components/notes/note-list";
import { NoteSearch } from "@/components/notes/note-search";
import { NoteSummaryCards } from "@/components/notes/note-summary-cards";
import { UploadNoteForm } from "@/components/notes/upload-note-form";
import {
  DecisionProjectFilter,
  type DecisionProjectOption,
} from "@/components/notes/decision-project-filter";
import { DecisionLogTable } from "@/components/notes/decision-log-table";
import { getCurrentUser } from "@/lib/current-user";
import { getNoteSummary } from "@/lib/notes-summary";
import { getNoteSummaries } from "@/lib/meeting-summary";
import { getDecisionLog } from "@/lib/meeting-decisions";
import { getDb } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function MeetingNotesPage({
  searchParams,
}: {
  searchParams: Promise<{ note?: string; q?: string; tab?: string; project?: string }>;
}) {
  const {
    note: highlightNoteId,
    q: rawQuery,
    tab,
    project: projectParam,
  } = await searchParams;
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

  // (명세 B-4) 결정 로그 탭 — /meeting-notes?tab=decisions. 조회 전용(getDecisionLog가 권한 필터).
  if (tab === "decisions") {
    // 프로젝트 필터 옵션: 열람 가능한 회의록이 실제로 걸린 프로젝트만(무의미한 항목 배제).
    const visibleNotesForProjects = db.meetingNotes.filter((n) => canViewMeetingNote(user, n));
    const projectIdsInNotes = new Set<string>();
    for (const n of visibleNotesForProjects) {
      if (n.projectId) projectIdsInNotes.add(n.projectId);
      for (const pid of n.projectIds ?? []) projectIdsInNotes.add(pid);
    }
    const projectFilterOptions: DecisionProjectOption[] = [
      { value: "all", label: "전체 프로젝트" },
      ...[...projectIdsInNotes]
        .map((pid) => ({ value: pid, label: projectLabel(pid) ?? pid }))
        .sort((a, b) => a.label.localeCompare(b.label, "ko")),
    ];
    const selectedProject =
      projectParam && projectIdsInNotes.has(projectParam) ? projectParam : "all";
    const decisions = await getDecisionLog(user, {
      projectId: selectedProject === "all" ? undefined : selectedProject,
    });

    return (
      <div>
        <PageHeader
          title="회의록"
          subtitle="AI가 회의록에서 추출한 결정 로그입니다 — 원문과 대조하세요"
        />
        <NoteSummaryCards summary={summary} />
        <NoteTabs active="decisions" />
        <div className="mb-4">
          <DecisionProjectFilter value={selectedProject} options={projectFilterOptions} />
        </div>
        <DecisionLogTable entries={decisions} />
      </div>
    );
  }

  // 공개 범위: admin 전용/지정 인원 전용 회의록은 관리자·업로더(+지정 인원)만.
  const visibleNotes = [...db.meetingNotes].filter((note) => canViewMeetingNote(user, note));
  // 요약은 원문 파생물 — 열람 가능한 회의록의 요약만 일괄 조회해 내려보낸다(권한 필터 동일 등급).
  const summaryByNote = await getNoteSummaries(visibleNotes.map((n) => n.id));

  // (명세 A-3) 회의록별 Action 처리 진행률 — 그 회의록발 전체/처리됨(created·ignored·held)을 1패스로 집계.
  const RESOLVED_STATUSES = new Set(["created", "ignored", "held"]);
  const totalByNote = new Map<string, number>();
  const resolvedByNote = new Map<string, number>();
  for (const item of db.actionItems) {
    totalByNote.set(item.meetingNoteId, (totalByNote.get(item.meetingNoteId) ?? 0) + 1);
    if (RESOLVED_STATUSES.has(item.status)) {
      resolvedByNote.set(item.meetingNoteId, (resolvedByNote.get(item.meetingNoteId) ?? 0) + 1);
    }
  }

  // (명세 B-5) 본문 전문 검색(?q=) — **권한 필터(visibleNotes) 이후**에만 적용(비공개 회의록은 검색 자체에서 제외).
  // 제목 + 원문(markdownBody) + AI 요약 부분 일치(대소문자 무시). 하이라이트는 UI 몫(searchQuery 전달).
  const searchQuery = (rawQuery ?? "").trim();
  const needle = searchQuery.toLowerCase();
  const searchedNotes = needle
    ? visibleNotes.filter((n) => {
        const haystack = [n.title, n.markdownBody, summaryByNote.get(n.id)?.content ?? ""]
          .join("\n")
          .toLowerCase();
        return haystack.includes(needle);
      })
    : visibleNotes;

  const notes: NoteListItem[] = searchedNotes
    .sort((a, b) => b.meetingAt.localeCompare(a.meetingAt))
    .map((note) => ({
      id: note.id,
      title: note.title,
      fileName: note.fileName,
      projectName: multiProjectLabel(note.projectIds, note.projectId),
      meetingAt: note.meetingAt,
      uploaderName: userById.get(note.uploaderId)?.name ?? note.uploaderId,
      extractionStatus: note.extractionStatus,
      candidateCount: totalByNote.get(note.id) ?? 0,
      resolvedCount: resolvedByNote.get(note.id) ?? 0,
      totalCount: totalByNote.get(note.id) ?? 0,
      markdownBody: note.markdownBody,
      visibility: note.visibility,
      restrictedCount: note.restrictedUserIds?.length,
      // 제목 편집 권한(업로더·관리자) — 서버 판정을 내려 연필 노출을 게이트(core가 재강제).
      canEdit: note.uploaderId === user.id || user.role === "admin",
      // AI 요약(있으면) — 열람 가능한 회의록만. UI 렌더는 frontend 단계 몫(props 계약만 개방).
      aiSummary: summaryByNote.get(note.id)
        ? {
            content: summaryByNote.get(note.id)!.content,
            generatedAt: summaryByNote.get(note.id)!.generatedAt,
          }
        : undefined,
    }));

  return (
    <div>
      <PageHeader
        title="회의록"
        subtitle="회의록을 업로드하면 Action 추출과 AI 요약이 자동 실행됩니다 — 원문은 항상 보존됩니다"
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
          {/* (명세 B-5) 본문 전문 검색 — ?q= 반영. 매칭 건수는 서버가 필터한 결과 수(notes.length). */}
          <NoteSearch initialQuery={searchQuery} matchCount={notes.length} />
          <div className="max-h-[calc(100dvh-16rem)] overflow-y-auto pr-0.5">
            <NoteList notes={notes} highlightId={highlightNoteId} searchQuery={searchQuery} />
          </div>
        </div>
      </div>
    </div>
  );
}
