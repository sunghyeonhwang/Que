import { NotificationSettings } from "@/components/settings/notification-settings";
import { getMyNotificationPrefs } from "@/app/(app)/settings/notification-actions";

export const dynamic = "force-dynamic";

/** 설정 > 알림 — 본인 정기 안내 알림 개인 설정(끌 수 있는 4종 토글). */
export default async function SettingsNotificationsPage() {
  const prefs = await getMyNotificationPrefs();
  return <NotificationSettings prefs={prefs} />;
}
