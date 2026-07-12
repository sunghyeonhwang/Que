import { getCurrentUser } from "@/lib/current-user";
import { getClientFilter, getClientFilterName } from "@/lib/client-filter";
import { getGradeHomeData } from "@/lib/home-grade-data";
import { ClientFilterBadge } from "@/components/app/client-filter-badge";
import { MemberAvatars } from "@/components/projects/member-avatars";
import { AddTaskDialog } from "@/components/app/add-task-dialog";
import { StaffHome } from "@/components/home/staff-home";
import { ManagerHome } from "@/components/home/manager-home";
import { CeoHome } from "@/components/home/ceo-home";
import { OnboardingCard } from "@/components/home/onboarding-card";
import { getOnboardingData, isOnboardingActive } from "@/lib/onboarding-data";

export const dynamic = "force-dynamic";
// AI 브리핑(generateHomeBriefingAction)이 Gemini를 호출하므로 팀 리포트와 같은 상한을 둔다
// (기본 서버리스 함수 타임아웃보다 넉넉히 — 팀 AI 분석 시간초과 사고 선례).
export const maxDuration = 60;

/** 1~12 정수만 통과, 아니면 현재월 폴백 */
function parseMonth(raw: string | string[] | undefined, fallback: number): number {
  const v = Array.isArray(raw) ? raw[0] : raw;
  const n = Number(v);
  return Number.isInteger(n) && n >= 1 && n <= 12 ? n : fallback;
}

/** 업무 흐름 창(주). 4|8|12만 통과, 아니면 8 폴백. */
function parseWorkflowWeeks(raw: string | string[] | undefined): 4 | 8 | 12 {
  const v = Array.isArray(raw) ? raw[0] : raw;
  const n = Number(v);
  return n === 4 || n === 12 ? n : 8;
}

// 홈(개인 대시보드) — 직급별 3분기. 스코프는 세션 사용자(user.id)의 grade에서만 유도한다.
// URL로 grade를 넓힐 수 없다(getGradeHomeData 내부에서 gradeForUser로 재판정).
export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await getCurrentUser();
  const now = new Date();
  const sp = await searchParams;

  const hm = parseMonth(sp.hm, now.getMonth() + 1);
  const wf = parseWorkflowWeeks(sp.wf);

  const [clientId, clientName] = await Promise.all([
    getClientFilter(),
    getClientFilterName(),
  ]);

  const data = await getGradeHomeData(user, now, { hm, wf, clientId });

  // 온보딩 카드: 노출 기간(KST 오늘 <= 종료일)에만 서버에서 판정·렌더한다. 기간 종료 후엔 미렌더.
  const onboarding = isOnboardingActive(now) ? await getOnboardingData(user, now) : null;

  // 화면 제목·helper text는 명세 §0 표를 정본으로 한다.
  const heading =
    data.grade === "manager"
      ? { title: "팀 운영", subtitle: "오늘 조정하거나 확인해야 할 병목·충돌·부하를 봅니다." }
      : data.grade === "ceo"
        ? { title: "전사 현황", subtitle: "전사 진척과 위험, 결정이 필요한 항목을 확인합니다." }
        : { title: "내 하루", subtitle: "오늘 내 작업과 일정, 확인할 요청을 봅니다." };

  // 아바타 스택은 팀 맥락을 조망하는 관리자·대표만 노출한다(명세 §2 — 사원은 개인 맥락만).
  const showAvatars = data.grade === "manager" || data.grade === "ceo";

  return (
    <div className="flex flex-col gap-4">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight text-[var(--que-text)]">
              {heading.title}
            </h1>
            <ClientFilterBadge clientName={clientName} />
          </div>
          <p className="mt-1 text-sm text-[var(--que-text-secondary)]">{heading.subtitle}</p>
        </div>
        <div className="flex items-center gap-3">
          {showAvatars && (
            <MemberAvatars members={data.headerMembers} overflow={data.memberOverflow} size={32} />
          )}
          <AddTaskDialog currentUserId={user.id} />
        </div>
      </header>

      {onboarding && <OnboardingCard data={onboarding} />}

      {data.grade === "staff" && <StaffHome data={data} />}
      {data.grade === "manager" && (
        <ManagerHome data={data} month={hm} canManage={user.role === "admin"} />
      )}
      {data.grade === "ceo" && <CeoHome data={data} month={hm} canManage={user.role === "admin"} />}

      {/* 우하단 플로팅 작업 추가(FAB) — 상단바 버튼과 같은 자연어 모달을 연다.
          폰(<md)에서는 in-flow 하단 탭바(약 53px + safe-area) 위로 여백만큼 띄워 겹치지 않게 한다.
          ≥md는 탭바가 없어(md:hidden) 기존 bottom-8 위치 그대로. */}
      <div className="pointer-events-none fixed right-5 bottom-[calc(53px+1rem+env(safe-area-inset-bottom))] z-30 md:right-8 md:bottom-8">
        <div className="pointer-events-auto">
          <AddTaskDialog currentUserId={user.id} variant="fab" />
        </div>
      </div>
    </div>
  );
}
