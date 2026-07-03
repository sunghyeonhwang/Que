import Link from "next/link";
import { format } from "date-fns";
import { canViewMeetingNote } from "@que/core";
import { ActionRow, type ActionRowData } from "@/components/action/action-row";
import { PageHeader } from "@/components/app/page-header";
import { NoteTabs } from "@/components/app/note-tabs";
import { StatusBadge } from "@/components/app/status-badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getCurrentUser } from "@/lib/current-user";
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
  // 열람 권한 없는 회의록(관리자 전용/지정 인원)에서 나온 Action은 여기서도 보이면 안 된다.
  const visibleNotes = db.meetingNotes.filter((n) => canViewMeetingNote(user, n));
  const noteById = new Map(visibleNotes.map((n) => [n.id, n]));
  const projectById = new Map(db.projects.map((p) => [p.id, p]));
  const userById = new Map(db.users.map((u) => [u.id, u]));

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
      dueDate: item.dueAt ? format(new Date(item.dueAt), "yyyy-MM-dd") : undefined,
      projectName: item.projectId ? projectById.get(item.projectId)?.name : undefined,
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
        title="Action"
        subtitle={`회의록에서 추출된 Task 후보를 확정합니다 · 확인 필요 ${needsReview}건`}
      />

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
        <div className="flex flex-col gap-2">
          {rows.length === 0 && (
            <p className="py-6 text-center text-sm text-muted-foreground">
              후보가 없습니다. 회의록 화면에서 Action을 추출해주세요.
            </p>
          )}
          {rows.map((row) => (
            <ActionRow key={row.id} item={row} />
          ))}
        </div>

        <Card className="h-fit">
          <CardHeader>
            <CardTitle className="text-base">생성된 Task</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            {createdTasks.length === 0 && (
              <p className="text-sm text-muted-foreground">아직 생성된 Task가 없습니다.</p>
            )}
            {createdTasks.map((task) => (
              <div key={task.id} className="flex items-center gap-2 rounded-md border px-3 py-2">
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">{task.title}</span>
                  <span className="block truncate text-xs text-muted-foreground">
                    담당 {userById.get(task.assigneeId)?.name ?? task.assigneeId}
                    {task.endAt ? ` · 마감 ${format(new Date(task.endAt), "M/d HH:mm")}` : ""}
                  </span>
                </span>
                <StatusBadge status={task.status} />
              </div>
            ))}
          </CardContent>
        </Card>
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
        "flex h-10 items-center rounded-md border px-3 text-sm transition-colors",
        active ? "bg-primary text-primary-foreground" : "hover:bg-accent",
      )}
    >
      {label}
    </Link>
  );
}
