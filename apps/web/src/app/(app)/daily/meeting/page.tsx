import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { canManageMilestone } from "@que/core";
import { buildWeeklyAgenda } from "@/lib/meeting-agenda";
import { buildMilestoneAgendaQueue } from "@/lib/milestone-agenda";
import { collectTodayActions } from "@/lib/meeting-minutes";
import { getCurrentUser } from "@/lib/current-user";
import { getDb } from "@/lib/db";
import { MeetingMode, type MeetingModeProps } from "@/components/daily/meeting-mode";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// 주간 통합 회의 진행 모드(기획 §1·§1-f). 전원 조회 가능, 진행 컨트롤(회의록 저장)은 admin만.
// 회의 화면은 데이터 섹션이 본체이므로 pro 요약은 생성하지 않는다(withSummary: false — 요약은 Slack용).
export default async function MeetingPage() {
  const user = await getCurrentUser();
  const now = new Date();
  const db = await getDb();

  const [agenda] = await Promise.all([buildWeeklyAgenda(db, now, { withSummary: false })]);
  const queue = buildMilestoneAgendaQueue(db, now);
  const todayDecisionCount = collectTodayActions(db, now).length;

  // 마일스톤 안건별 결정 권한(담당자·관리자). UI 노출만 조정하고 서버가 최종 강제한다.
  const milestoneAgenda: MeetingModeProps["milestoneAgenda"] = queue.map((m) => {
    const project = db.projects.find((p) => p.id === m.projectId);
    return {
      id: m.id,
      title: m.title,
      projectName: m.projectName,
      dueDateKey: m.dueDateKey,
      risk: m.risk,
      progress: m.progress,
      doneCount: m.doneCount,
      totalCount: m.totalCount,
      blockedCount: m.blockedCount,
      blockedTitles: m.blockedTitles,
      canManage: canManageMilestone(user, project),
    };
  });

  return (
    <div className="flex min-h-full flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">주간 통합 회의</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {agenda.date} · 5섹션 진행 — 지난주 요약부터 팀 라운드까지
          </p>
        </div>
        <Link
          href="/daily"
          className="inline-flex h-10 items-center gap-2 rounded-lg border border-[var(--que-border)] px-3 text-sm font-medium text-[var(--que-text-secondary)] hover:bg-[var(--que-bg-muted)]"
        >
          <ArrowLeft className="size-4" aria-hidden />
          데일리로
        </Link>
      </div>

      <MeetingMode
        date={agenda.date}
        isAdmin={user.role === "admin"}
        lastWeek={agenda.lastWeek}
        thisWeek={agenda.thisWeek}
        milestoneAgenda={milestoneAgenda}
        decisions={agenda.decisions}
        teamRound={agenda.teamRound}
        todayDecisionCount={todayDecisionCount}
      />
    </div>
  );
}
