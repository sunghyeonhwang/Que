import { ChevronLeft } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AdminResetPassword } from "@/components/members/admin-reset-password";
import { MemberActivityFeed } from "@/components/members/member-activity-feed";
import { MemberContributionGrid } from "@/components/members/member-contribution-grid";
import { MemberProfileCard } from "@/components/members/member-profile-card";
import { PerformanceLineChart } from "@/components/performance/performance-line-chart";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getCurrentUser } from "@/lib/current-user";
import { getMemberDetail } from "@/lib/members-data";

export const dynamic = "force-dynamic";

// 멤버 세부 정보(서버) — 조회 전용. 프로필/최근 활동/히트맵/작업 성과.
export default async function MemberDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const me = await getCurrentUser();
  const { id } = await params;
  const detail = await getMemberDetail(id);
  if (!detail) notFound();

  return (
    <div>
      <header className="mb-4">
        <Link
          href="/members"
          className="inline-flex items-center gap-1 text-sm text-[var(--que-text-secondary)] transition-colors hover:text-[var(--que-text)]"
        >
          <ChevronLeft className="size-4" aria-hidden />
          <span className="text-2xl font-semibold tracking-tight text-[var(--que-text)]">
            멤버 세부 정보
          </span>
        </Link>
      </header>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="flex flex-col gap-6">
          <MemberProfileCard detail={detail} />
          {me.role === "admin" && (
            <AdminResetPassword targetId={detail.user.id} targetName={detail.user.name} />
          )}
          <MemberActivityFeed activities={detail.activities} />
        </div>
        <div className="flex flex-col gap-6">
          <MemberContributionGrid heatmap={detail.heatmap} />
          <Card>
            <CardHeader>
              <CardTitle>작업 성과</CardTitle>
            </CardHeader>
            <CardContent>
              <PerformanceLineChart data={detail.performanceTrend} />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
