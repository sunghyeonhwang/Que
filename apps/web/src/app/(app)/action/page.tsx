import Link from "next/link";
import { format } from "date-fns";
import { canViewMeetingNote, formatProjectLabel } from "@que/core";
import { ActionRow, type ActionRowData } from "@/components/action/action-row";
import { PageHeader } from "@/components/app/page-header";
import { NoteTabs } from "@/components/app/note-tabs";
import { NoteSummaryCards } from "@/components/notes/note-summary-cards";
import { StatusBadge } from "@/components/app/status-badge";
import { getCurrentUser } from "@/lib/current-user";
import { getNoteSummary } from "@/lib/notes-summary";
import { getDb } from "@/lib/db";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function ActionPage({
  searchParams,
}: {
  searchParams: Promise<{ note?: string }>;
}) {
  const params = await searchParams;
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

  const noteFilter = params.note && noteById.has(params.note) ? params.note : undefined;

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

      <div className="mb-4 flex flex-wrap gap-2" aria-label="회의록 필터">
        <FilterChip href="/action" active={!noteFilter} label="전체 회의록" />
        {visibleNotes.map((note) => (
          <FilterChip
            key={note.id}
            href={`/action?note=${note.id}`}
            active={noteFilter === note.id}
            label={note.title}
          />
        ))}
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,24rem)]">
        <div className="flex max-h-[calc(100dvh-18rem)] flex-col gap-2 overflow-y-auto pr-0.5">
          {rows.length === 0 && (
            <p className="rounded-xl border border-dashed border-[var(--que-border)] bg-[var(--que-bg-muted)] py-10 text-center text-sm text-[var(--que-text-tertiary)]">
              후보가 없습니다. 회의록 화면에서 Action을 추출해주세요.
            </p>
          )}
          {rows.map((row) => (
            <ActionRow key={row.id} item={row} projects={projectOptions} />
          ))}
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

function FilterChip({ href, active, label }: { href: string; active: boolean; label: string }) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex h-10 items-center rounded-lg border px-3 text-sm font-medium transition-colors",
        active
          ? "border-transparent bg-[var(--que-brand)] text-[var(--que-on-brand)]"
          : "border-[var(--que-border)] text-[var(--que-text-secondary)] hover:bg-[var(--que-bg-muted)]",
      )}
    >
      {label}
    </Link>
  );
}
