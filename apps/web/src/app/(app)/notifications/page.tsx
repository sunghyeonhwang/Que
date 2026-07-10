import { getCurrentUser } from "@/lib/current-user";
import { getViewerAlerts } from "@/lib/alerts-data";
import { PageHeader } from "@/components/app/page-header";
import { NotificationList } from "@/components/app/notification-list";

export const dynamic = "force-dynamic";

/**
 * 알림 센터 — C-3a. 상단바 종에서 "모두 보기"로 진입(메뉴에는 없음 — 상단바 진입 표준 패턴).
 * Que의 알림은 상태 파생 스냅샷이라 항목이 해결되면 자동으로 사라진다 — 이력 보관함이 아니다.
 * 읽음은 뱃지·강조에만 영향을 주고 표시는 유지된다.
 * 소스는 viewer-scoped(getViewerAlerts) — 본인 관련 신호만이라 상단바 벨·사원 홈 우선 확인과
 * 같은 모집단·수치를 쓴다(벨 개인화, 홈 명세 §3).
 */
export default async function NotificationsPage() {
  const user = await getCurrentUser();
  const alerts = await getViewerAlerts(user, new Date(), { all: true });

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-5">
      <PageHeader
        title="알림"
        subtitle="지금 확인·응답할 내 항목입니다. 해결되면 목록에서 자동으로 사라집니다."
      />
      <NotificationList items={alerts.items} unreadCount={alerts.unreadCount} />
    </div>
  );
}
