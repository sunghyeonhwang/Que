import { getCurrentUser } from "@/lib/current-user";
import { getClientFilter, getClientFilterName } from "@/lib/client-filter";
import { getGradeHomeData } from "@/lib/home-grade-data";
import { ClientFilterBadge } from "@/components/app/client-filter-badge";
import { MemberAvatars } from "@/components/projects/member-avatars";
import { AddTaskDialog } from "@/components/app/add-task-dialog";
import { StaffHome } from "@/components/home/staff-home";
import { ManagerHome } from "@/components/home/manager-home";
import { CeoHome } from "@/components/home/ceo-home";

export const dynamic = "force-dynamic";

/** 1~12 정수만 통과, 아니면 현재월 폴백 */
function parseMonth(raw: string | string[] | undefined, fallback: number): number {
  const v = Array.isArray(raw) ? raw[0] : raw;
  const n = Number(v);
  return Number.isInteger(n) && n >= 1 && n <= 12 ? n : fallback;
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

  const [clientId, clientName] = await Promise.all([
    getClientFilter(),
    getClientFilterName(),
  ]);

  const data = await getGradeHomeData(user, now, { hm, clientId });

  const heading =
    data.grade === "manager"
      ? { title: "어디가 막혔나", subtitle: "오늘 팀의 병목·충돌·부하를 먼저 봅니다." }
      : data.grade === "ceo"
        ? { title: "전사 조망", subtitle: "전사 진척·프로젝트·클라이언트 현황을 한눈에." }
        : {
            title: `어서오세요, ${data.givenName}님!`,
            subtitle: "오늘 내 일과 내게 온 요청을 확인하세요.",
          };

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
          <MemberAvatars members={data.headerMembers} overflow={data.memberOverflow} size={32} />
          <AddTaskDialog currentUserId={user.id} />
        </div>
      </header>

      {data.grade === "staff" && <StaffHome data={data} month={hm} />}
      {data.grade === "manager" && <ManagerHome data={data} />}
      {data.grade === "ceo" && <CeoHome data={data} month={hm} />}

      {/* 우하단 플로팅 작업 추가(FAB) — 상단바 버튼과 같은 자연어 모달을 연다. */}
      <div className="pointer-events-none fixed right-5 bottom-5 z-30 md:right-8 md:bottom-8">
        <div className="pointer-events-auto">
          <AddTaskDialog currentUserId={user.id} variant="fab" />
        </div>
      </div>
    </div>
  );
}
