import { ChevronLeft } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AdminResetPassword } from "@/components/members/admin-reset-password";
import { AdminPasskey } from "@/components/members/admin-passkey";
import { adminListPasskeys } from "@/app/(app)/members/[id]/passkey-admin-actions";
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

  // 관리자에게만 패스키 목록을 로드한다(adminListPasskeys가 비관리자에게 빈 배열을 반환하지만
  // 불필요한 조회를 피하려 게이트한다).
  const passkeys = me.role === "admin" ? await adminListPasskeys(detail.user.id) : [];

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
            <>
              <AdminResetPassword targetId={detail.user.id} targetName={detail.user.name} />
              <AdminPasskey
                targetId={detail.user.id}
                targetName={detail.user.name}
                passkeys={passkeys}
              />
            </>
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
