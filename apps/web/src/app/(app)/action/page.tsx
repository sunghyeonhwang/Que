import Link from "next/link";
import { format } from "date-fns";
import { canViewMeetingNote, formatProjectLabel } from "@que/core";
import { type ActionRowData } from "@/components/action/action-row";
import { ActionBulkList } from "@/components/action/action-bulk-list";
import { CarryoverFollowup } from "@/components/action/carryover-followup";
import {
  NoteFilterSelect,
  type NoteFilterOption,
} from "@/components/action/note-filter-select";
import { PageHeader } from "@/components/app/page-header";
import { NoteTabs } from "@/components/app/note-tabs";
import { NoteSummaryCards } from "@/components/notes/note-summary-cards";
import { StatusBadge } from "@/components/app/status-badge";
import { getCurrentUser } from "@/lib/current-user";
import { getNoteSummary } from "@/lib/notes-summary";
import { businessDaysElapsed } from "@/lib/daily-data";
import { getPreviousNoteCarryover } from "@/lib/meeting-carryover";
import { getDb } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function ActionPage({
  searchParams,
}: {
  searchParams: Promise<{ note?: string }>;
}) {
  const params = await searchParams;
  const now = new Date();
  const user = await getCurrentUser();
  const db = await getDb();
  const summary = await getNoteSummary(user);
  // 열람 권한 없는 회의록(관리자 전용/지정 인원)에서 나온 Action은 여기서도 보이면 안 된다.
  const visibleNotes = db.meetingNotes.filter((n) => canViewMeetingNote(user, n));
  const noteById = new Map(visibleNotes.map((n) => [n.id, n]));
  const projectById = new Map(db.projects.map((p) => [p.id, p]));
  const clientById = new Map(db.clients.map((c) => [c.id, c]));
  const projectLabel = (projectId?: string): string | undefined => {
    if (!projectId) return undefined;
    const project = projectById.get(projectId);
    if (!project) return undefined;
    return formatProjectLabel(project, project.clientId ? clientById.get(project.clientId) : undefined);
  };
  const userById = new Map(db.users.map((u) => [u.id, u]));

  // Action 확정/편집 시 프로젝트 재배정을 위한 옵션(라벨에 "클라이언트 · 프로젝트" 병기).
  const projectOptions = db.projects.map((p) => ({
    id: p.id,
    name: formatProjectLabel(p, p.clientId ? clientById.get(p.clientId) : undefined),
  }));

  // 인라인 프로젝트 생성 다이얼로그의 클라이언트 선택 옵션(선택사항).
  const clientOptions = db.clients.map((c) => ({ id: c.id, name: c.name }));

  // 회의록별 미처리(needs_review/candidate/held) Action 수 — 옵션 조립·기본 선택에 쓴다.
  const UNRESOLVED = new Set(["needs_review", "candidate", "held"]);
  const unresolvedByNote = new Map<string, number>();
  for (const item of db.actionItems) {
    if (!noteById.has(item.meetingNoteId)) continue;
    if (UNRESOLVED.has(item.status)) {
      unresolvedByNote.set(
        item.meetingNoteId,
        (unresolvedByNote.get(item.meetingNoteId) ?? 0) + 1,
      );
    }
  }
  // 미처리가 남은 회의록만(최근 meetingAt순) — 전부 처리된 회의록은 드롭다운에서 제외.
  const unresolvedNotes = visibleNotes
    .filter((n) => (unresolvedByNote.get(n.id) ?? 0) > 0)
    .sort((a, b) => b.meetingAt.localeCompare(a.meetingAt));

  // 선택 해석:
  // - ?note=all → 명시적 전체
  // - ?note=<유효 회의록> → 그 회의록(전부 처리됐어도 딥링크 유지 위해 옵션에 동적 포함)
  // - 그 외(없음/무효) → 미처리가 남은 최신 회의록, 없으면 전체
  const requested = params.note;
  const selected =
    requested === "all"
      ? "all"
      : requested && noteById.has(requested)
        ? requested
        : (unresolvedNotes[0]?.id ?? "all");
  const noteFilter = selected === "all" ? undefined : selected;

  // (명세 B-6) 지난 회의 팔로업 — 선택된 회의록의 직전 동종 회의록에서 미처리로 남은 Action.
  // 열람 불가·미처리 0건이면 null(존재 노출 금지·절 생략). 상세 UI(배너 정식 디자인)는 frontend 단계 몫.
  const carryover = noteFilter ? getPreviousNoteCarryover(db, user, noteFilter, now) : null;

  // 드롭다운 옵션(서버 조립): 전체 + 미처리 회의록 + (딥링크로 온 처리완료 회의록 동적 포함).
  const optionNotes = [...unresolvedNotes];
  if (selected !== "all" && !optionNotes.some((n) => n.id === selected)) {
    const extra = noteById.get(selected);
    if (extra) optionNotes.push(extra);
  }
  optionNotes.sort((a, b) => b.meetingAt.localeCompare(a.meetingAt));
  const noteOptions: NoteFilterOption[] = [
    { value: "all", label: "전체 회의록" },
    ...optionNotes.map((n) => {
      const count = unresolvedByNote.get(n.id) ?? 0;
      const md = format(new Date(n.meetingAt), "M/d");
      const tail = count > 0 ? `미처리 ${count}건` : "처리 완료";
      return { value: n.id, label: `${n.title} · ${md} · ${tail}` };
    }),
  ];

  const rows: ActionRowData[] = [...db.actionItems]
    .filter((item) => noteById.has(item.meetingNoteId))
    .filter((item) => !noteFilter || item.meetingNoteId === noteFilter)
    .sort((a, b) => {
      // 처리 안 된 후보 먼저, 그 안에서 확인 필요 우선
      const rank = (s: string) =>
        s === "needs_review" ? 0 : s === "candidate" ? 1 : s === "held" ? 2 : 3;
      return rank(a.status) - rank(b.status) || b.createdAt.localeCompare(a.createdAt);
    })
    .map((item) => ({
      id: item.id,
      title: item.title,
      sourceText: item.sourceText,
      noteName: noteById.get(item.meetingNoteId)?.fileName ?? item.meetingNoteId,
      status: item.status,
      assigneeId: item.assigneeId,
      projectId: item.projectId,
      dueDate: item.dueAt ? format(new Date(item.dueAt), "yyyy-MM-dd") : undefined,
      dueTime: item.dueAt ? format(new Date(item.dueAt), "HH:mm") : undefined,
      projectName: projectLabel(item.projectId),
      // (명세 A-1) 미처리(확인필요·후보)만 에이징 표기 — 생성 기준 경과 영업일(오늘=0).
      ageBusinessDays:
        item.status === "needs_review" || item.status === "candidate"
          ? businessDaysElapsed(item.createdAt, now)
          : undefined,
    }));

  const needsReview = rows.filter((r) => r.status === "needs_review").length;

  const createdTasks = db.actionItems
    .filter((item) => item.status === "created" && item.createdTaskId)
    .flatMap((item) => {
      const task = db.tasks.find((t) => t.id === item.createdTaskId);
      return task ? [task] : [];
    });

  return (
    <div>
      <PageHeader
        title="확인필요"
        subtitle={`회의록에서 추출된 Task 후보를 확정합니다 · 확인 필요 ${needsReview}건`}
      />

      <NoteSummaryCards summary={summary} />

      <NoteTabs active="action" />

      <NoteFilterSelect value={selected} options={noteOptions} />

      {/* 우측 '생성된 Task' 24rem→36rem(1.5배 — 2026-07-15 사용자 요청). */}
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,36rem)]">
        <div className="flex max-h-[calc(100dvh-18rem)] flex-col gap-2 overflow-y-auto pr-0.5">
          {/* (명세 B-6) 지난 회의 팔로업 — 접이식 정식 블록. carryover가 null이면 미렌더. */}
          {carryover && <CarryoverFollowup carryover={carryover} />}
          {rows.length === 0 && (
            <p className="rounded-xl border border-dashed border-[var(--que-border)] bg-[var(--que-bg-muted)] py-10 text-center text-sm text-[var(--que-text-tertiary)]">
              후보가 없습니다. 회의록을 업로드하면 Action이 자동으로 추출됩니다.
            </p>
          )}
          {/* 일괄 처리 목록 — 미처리 행 체크박스 선택 + 전체 보류/무시(2026-07-21). */}
          <ActionBulkList rows={rows} projects={projectOptions} clients={clientOptions} />
        </div>

        <section className="flex h-fit flex-col rounded-xl border border-[var(--que-border)] bg-[var(--que-bg)]">
          <header className="border-b border-[var(--que-border)] px-4 py-3">
            <h2 className="text-base font-semibold text-[var(--que-text)]">생성된 Task</h2>
          </header>
          <div className="flex flex-col gap-2 p-4">
            {createdTasks.length === 0 && (
              <p className="text-sm text-[var(--que-text-tertiary)]">아직 생성된 Task가 없습니다.</p>
            )}
            {createdTasks.map((task) => (
              <Link
                key={task.id}
                href={`/now?task=${task.id}`}
                className="flex min-h-11 items-center gap-2 rounded-lg border border-[var(--que-border)] px-3 py-2 transition-colors hover:bg-[var(--que-bg-muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium text-[var(--que-text)]">
                    {task.title}
                  </span>
                  <span className="block truncate text-xs text-[var(--que-text-tertiary)]">
                    담당 {userById.get(task.assigneeId)?.name ?? task.assigneeId}
                    {task.endAt ? ` · 마감 ${format(new Date(task.endAt), "M/d HH:mm")}` : ""}
                  </span>
                </span>
                <StatusBadge status={task.status} />
              </Link>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}

