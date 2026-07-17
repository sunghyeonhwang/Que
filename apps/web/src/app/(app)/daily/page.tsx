import Link from "next/link";
import { format } from "date-fns";
import { ko } from "date-fns/locale";
import { Presentation } from "lucide-react";
import { canManageMilestone } from "@que/core";
import { PageHeader } from "@/components/app/page-header";
import { LinkTabs } from "@/components/app/link-tabs";
import { StandupForm, type BlockerCandidate } from "@/components/daily/standup-form";
import { StandupBoard, type BoardMember } from "@/components/daily/standup-board";
import { WeeklyRetro } from "@/components/daily/weekly-retro";
import { TeamSummaryPanel } from "@/components/daily/team-summary-panel";
import {
  CrisisDecisionCards,
  type CrisisCard,
} from "@/components/daily/crisis-decision-cards";
import { OkrBoard } from "@/components/okr/okr-board";
import {
  ChangeRequestCard,
  type ChangeRequestCardData,
} from "@/components/change/change-request-card";
import {
  CreateChangeRequestDialog,
  type ChangeRequestProjectOption,
} from "@/components/change/create-change-request-dialog";
import { detectCrisisTriggers } from "@/lib/notifications/crisis";
import { getCurrentUser } from "@/lib/current-user";
import { getDailyData, kstDateKey } from "@/lib/daily-data";
import { getWeeklyRetroData } from "@/lib/weekly-retro-data";
import { getOkrData } from "@/lib/okr-data";
import { getOpenChangeRequests } from "@/lib/change-request-data";
import { getDb } from "@/lib/db";

export const dynamic = "force-dynamic";

const DAILY_TABS = [
  { key: "today", label: "오늘", href: "/daily" },
  { key: "okr", label: "OKR", href: "/daily?tab=okr" },
  { key: "retro", label: "회고", href: "/daily?tab=retro" },
];

// 데일리(기획 §4) — URL 탭(오늘 보드 | OKR). 전사 리듬이라 클라이언트 필터와 무관하게 전원을 본다.
// 오늘 보드: ⑴ 내 체크인 폼 ⑵ 전원 카드 그리드 ⑶ AI 팀 요약. OKR: 분기 목표+월 핵심결과 트리.
export default async function DailyPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; period?: string; week?: string }>;
}) {
  const { tab, period, week } = await searchParams;
  const user = await getCurrentUser();
  const now = new Date();

  // OKR 탭 — 오늘 보드 데이터는 건너뛰고 OKR 트리만 조회한다.
  if (tab === "okr") {
    const [okr, db] = await Promise.all([getOkrData(user, { period }), getDb()]);
    const members = db.users
      .filter((u) => u.active !== false)
      .map((u) => ({ id: u.id, name: u.name, avatarColor: u.avatarColor }));

    return (
      <div className="flex flex-col gap-4">
        <PageHeader
          title="데일리"
          subtitle="분기 목표(Objective)와 월 핵심결과(KR)로 오늘 하는 일이 어떤 목표에 기여하는지 봅니다."
        />
        <LinkTabs label="데일리 보기 전환" active="okr" tabs={DAILY_TABS} />
        <OkrBoard
          period={okr.period}
          periods={okr.periods}
          objectives={okr.objectives}
          canManageObjectives={okr.canManageObjectives}
          members={members}
          currentMonth={okr.month}
        />
      </div>
    );
  }

  // 회고 탭 — 오늘 보드 데이터는 건너뛰고 주간 회고만 조회한다. `?week=YYYY-MM-DD`(그 주 월요일)로 이동.
  if (tab === "retro") {
    const retro = await getWeeklyRetroData(user, week, now);
    // 주 이동 링크 계산(정오 파싱으로 경계 흔들림 방지). 미래 주는 이동 불가.
    const shiftKey = (key: string, days: number): string => {
      const d = new Date(`${key}T12:00:00`);
      d.setDate(d.getDate() + days);
      return kstDateKey(d);
    };
    const prevWeek = shiftKey(retro.weekStart, -7);
    const nextWeek = shiftKey(retro.weekStart, 7);
    const todayKey = kstDateKey(now);
    // 다음 주 월요일이 오늘 이후면 미래 → 이동 불가. 미래가 불가하므로 !canGoNext ⇔ 이번 주.
    const canGoNext = nextWeek <= todayKey;

    return (
      <div className="flex flex-col gap-4">
        <PageHeader
          title="데일리"
          subtitle="지난 한 주(월~금)의 스탠드업을 되돌아봅니다 — 제출 흐름·포커스·막힘·AI 요약."
        />
        <LinkTabs label="데일리 보기 전환" active="retro" tabs={DAILY_TABS} />
        <WeeklyRetro
          data={retro}
          prevHref={`/daily?tab=retro&week=${prevWeek}`}
          nextHref={canGoNext ? `/daily?tab=retro&week=${nextWeek}` : undefined}
          isCurrentWeek={!canGoNext}
        />
      </div>
    );
  }

  const [data, db, openChangeRequests] = await Promise.all([
    getDailyData(user, now),
    getDb(),
    getOpenChangeRequests(now),
  ]);

  const isAdmin = user.role === "admin";

  // OS-2b 외부 변경 대응 카드(부록 C). 진행 중(종결 전) 변경만 상단 노출. 단계 진행은 담당·admin.
  const changeCards: {
    data: ChangeRequestCardData;
    canManage: boolean;
  }[] = openChangeRequests.map((v) => {
    const project = db.projects.find((p) => p.id === v.changeRequest.projectId);
    return {
      data: {
        id: v.changeRequest.id,
        title: v.changeRequest.title,
        stage: v.changeRequest.stage,
        projectName: v.projectName,
        milestoneTitle: v.milestoneTitle,
        impactDeadline: v.changeRequest.impactDeadline,
        relatedTaskCount: v.relatedTaskCount,
        stageLog: v.stageLog.map((l) => ({ stage: l.stage, at: l.at, byName: l.byName })),
      },
      canManage: isAdmin || project?.ownerId === user.id,
    };
  });

  // 외부 변경 접수 대상 프로젝트(담당·admin) + 각 프로젝트의 마일스톤(선택 연결용).
  const changeProjectOptions: ChangeRequestProjectOption[] = db.projects
    .filter((p) => isAdmin || p.ownerId === user.id)
    .map((p) => ({
      id: p.id,
      name: p.name,
      milestones: db.milestones
        .filter((m) => m.projectId === p.id)
        .map((m) => ({ id: m.id, title: m.title })),
    }));

  // 긴급 결정 대기(기획 §1-e) — 판정은 서버 detectCrisisTriggers 재사용(이중 로직 금지).
  // 담당자·관리자만 결정 버튼을 노출(canManageMilestone). 서버 액션이 최종 강제한다.
  const crisisCards: CrisisCard[] = detectCrisisTriggers(db, now).map((t) => {
    const project = db.projects.find((p) => p.id === t.projectId);
    return {
      milestoneId: t.milestoneId,
      title: t.title,
      projectName: t.projectName,
      dueDateKey: t.dueDateKey,
      reasonText: t.reasonText,
      progress: t.progress,
      doneCount: t.doneCount,
      totalCount: t.totalCount,
      canManage: canManageMilestone(user, project),
    };
  });

  // 다른 멤버의 막힘 작업 제목 해석용(제출자 카드 표시). 파생 개수는 개수만 쓰므로 제목은 여기서만.
  const titleById = new Map(db.tasks.map((t) => [t.id, t.title] as const));

  // 막힘 후보 = 내 미완 작업 중 issue/on_hold(myStandup.blocked). 폼 칩 선택지.
  const blockerCandidates: BlockerCandidate[] = (data.myStandup?.blocked ?? []).map((t) => ({
    id: t.id,
    title: t.title,
    status: t.status,
  }));

  const myEntry = data.myEntry
    ? {
        focus: data.myEntry.focus,
        note: data.myEntry.note,
        blockerText: data.myEntry.blockerText,
        blockedTaskIds: data.myEntry.blockedTaskIds,
        aiDrafted: data.myEntry.aiDrafted,
        submittedAt: data.myEntry.submittedAt,
      }
    : undefined;

  const members: BoardMember[] = data.members.map((m) => {
    const isMe = m.user.id === user.id;
    const entry = m.entry;

    // 파생 4분면 개수: 본인=live myStandup, 타인 제출자=제출 시점 snapshot, 미제출 타인=없음.
    let counts: BoardMember["counts"];
    if (isMe && data.myStandup) {
      counts = {
        done: data.myStandup.yesterdayDone.length,
        carried: data.myStandup.yesterdayUnfinished.length,
        today: data.myStandup.todayPlanned.length,
      };
    } else if (entry) {
      counts = {
        done: entry.snapshotTaskIds.yesterdayDone.length,
        carried: entry.snapshotTaskIds.yesterdayUnfinished.length,
        today: entry.snapshotTaskIds.todayPlanned.length,
      };
    }

    return {
      id: m.user.id,
      name: m.user.name,
      avatarColor: m.user.avatarColor,
      isMe,
      submitted: m.submitted,
      submittedAt: entry?.submittedAt,
      focus: entry?.focus,
      note: entry?.note,
      blockerText: entry?.blockerText,
      blockedTitles: (entry?.blockedTaskIds ?? [])
        .map((id) => titleById.get(id))
        .filter((t): t is string => Boolean(t)),
      blockedTaskIds: entry?.blockedTaskIds ?? [],
      absence: m.absence,
      blockerStreak: m.blockerStreak,
      counts,
      krChips: m.krChips,
    };
  });

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="데일리"
        subtitle={`매일 10시, 어제·오늘·막힘을 팀과 맞춥니다 · ${format(now, "M월 d일 (EEE)", { locale: ko })}`}
        actions={
          <div className="flex items-center gap-2">
            {changeProjectOptions.length > 0 ? (
              <CreateChangeRequestDialog projects={changeProjectOptions} />
            ) : null}
            <Link
              href="/daily/meeting"
              className="inline-flex h-10 items-center gap-2 rounded-lg border border-[var(--que-border)] px-3 text-sm font-medium text-[var(--que-text-secondary)] hover:bg-[var(--que-bg-muted)]"
            >
              <Presentation className="size-4" aria-hidden />
              회의 진행 모드
            </Link>
          </div>
        }
      />

      <LinkTabs label="데일리 보기 전환" active="today" tabs={DAILY_TABS} />

      {/* 긴급 결정 대기 — 트리거가 있을 때만 상단 red 섹션 */}
      <CrisisDecisionCards cards={crisisCards} />

      {/* OS-2b 진행 중 외부 변경 대응 — 있을 때만 상단 노출(긴급 결정 형제) */}
      {changeCards.length > 0 ? (
        <section aria-label="진행 중 외부 변경 대응" className="flex flex-col gap-3">
          <h2 className="text-base font-semibold text-[var(--que-text)]">진행 중 외부 변경 대응</h2>
          {changeCards.map((c) => (
            <ChangeRequestCard
              key={c.data.id}
              data={c.data}
              canManage={c.canManage}
              isAdmin={isAdmin}
            />
          ))}
        </section>
      ) : null}

      {/* ⑴ 내 체크인 폼 — 미제출이면 최상단 강조, 제출 후엔 확정 표기+수정 */}
      <StandupForm blockerCandidates={blockerCandidates} myEntry={myEntry} />

      {/* ⑵ 전원 카드 그리드 */}
      <section aria-label="전원 체크인" className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold">오늘의 팀</h2>
          <span className="text-sm tabular-nums text-muted-foreground">
            {data.submittedCount}/{data.totalCount} 제출
          </span>
        </div>
        <StandupBoard members={members} date={data.date} />
      </section>

      {/* ⑶ AI 팀 요약 패널 — 전원 제출 즉시 또는 11:00 생성. 생성 전엔 대기 카드. */}
      <TeamSummaryPanel
        summary={
          data.teamSummary
            ? {
                content: data.teamSummary.content,
                model: data.teamSummary.model,
                generatedAt: data.teamSummary.generatedAt,
                submittedAtGen: data.teamSummary.submittedUserIds.length,
              }
            : undefined
        }
        submittedCount={data.submittedCount}
        totalCount={data.totalCount}
        isAdmin={user.role === "admin"}
      />
    </div>
  );
}
