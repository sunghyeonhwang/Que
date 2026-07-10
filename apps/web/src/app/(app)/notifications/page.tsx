import { getCurrentUser } from "@/lib/current-user";
import { getAlerts } from "@/lib/alerts-data";
import { PageHeader } from "@/components/app/page-header";
import { NotificationList } from "@/components/app/notification-list";

export const dynamic = "force-dynamic";

/**
 * 알림 센터 — C-3a. 상단바 종에서 "모두 보기"로 진입(메뉴에는 없음 — 상단바 진입 표준 패턴).
 * Que의 알림은 상태 파생 스냅샷("지금 주의할 것")이라 항목이 해결되면 자동으로 사라진다 —
 * 이력 보관함이 아니다. 읽음은 뱃지·강조에만 영향을 주고 표시는 유지된다.
 */
export default async function NotificationsPage() {
  const user = await getCurrentUser();
  const alerts = await getAlerts(user, new Date(), { all: true });

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-5">
      <PageHeader
        title="알림"
        subtitle="지금 주의가 필요한 항목입니다. 해결되면 목록에서 자동으로 사라집니다."
      />
      <NotificationList items={alerts.items} unreadCount={alerts.unreadCount} />
    </div>
  );
}
