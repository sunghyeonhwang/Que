import Link from "next/link";
import { Activity, Building2, LineChart, UserCog, Users } from "lucide-react";
import { PageHeader } from "@/components/app/page-header";
import { MemberCard } from "@/components/members/member-card";
import { TeamKpiCard } from "@/components/members/team-kpi-card";
import { buttonVariants } from "@/components/ui/button";
import { getCurrentUser } from "@/lib/current-user";
import { getTeamOverview } from "@/lib/members-data";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

/** 팀 개요 — 멤버·역할·최근 활동 요약(조회 전용, CLAUDE.md 스펙).
 * 멤버 추가/편집/제거는 미구현이라 출시 시 노출하지 않는다(데모 컨트롤 숨김). */
export default async function MembersPage() {
  const user = await getCurrentUser();
  const { kpis, members } = await getTeamOverview();
  const isAdmin = user.role === "admin";

  return (
    <div>
      <PageHeader
        title="팀 개요"
        subtitle="멤버, 역할, 최근 활동을 확인하세요."
        actions={
          isAdmin ? (
            <Link
              href="/settings/staff"
              className={cn(buttonVariants({ variant: "outline" }), "h-11")}
            >
              <UserCog className="size-4" aria-hidden />
              직원 관리
            </Link>
          ) : undefined
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <TeamKpiCard icon={Users} label="총 멤버" value={kpis.totalMembers} />
        <TeamKpiCard icon={Activity} label="오늘 활동" value={kpis.activeToday} />
        <TeamKpiCard icon={Building2} label="총 부서" value={kpis.totalDepartments} />
        <TeamKpiCard
          icon={LineChart}
          label="평균 완료 작업"
          value={kpis.avgCompletedPerWeek}
          unit="/주"
        />
      </div>

      <h2 className="mt-8 mb-3 text-sm font-semibold text-[var(--que-text-secondary)]">모든 팀</h2>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {members.map((member) => (
          <MemberCard key={member.id} member={member} />
        ))}
      </div>
    </div>
  );
}
