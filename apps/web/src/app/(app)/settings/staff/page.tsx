import { redirect } from "next/navigation";
import { StaffManager } from "@/components/settings/staff/staff-manager";
import { getCurrentUser } from "@/lib/current-user";
import { getManagedUsers, AVATAR_PALETTE } from "@/lib/users-admin";

export const dynamic = "force-dynamic";

/**
 * 설정 > 직원 관리 — 관리자 전용. 비관리자가 URL로 직접 오면 설정 홈으로 돌린다
 * (탭 숨김 + 이 서버 redirect + 서버 액션 canManageUsers = 3중 게이트).
 */
export default async function SettingsStaffPage() {
  const user = await getCurrentUser();
  if (user.role !== "admin") redirect("/settings");

  const users = await getManagedUsers({ role: user.role });

  // 이미 쓰이는 아바타색 → 폼이 "미사용색"을 제안하는 데 쓴다(서버 createUser가 최종 확정).
  const usedColors = new Set(users.map((u) => u.avatarColor));
  const suggestedColors = AVATAR_PALETTE.filter((c) => !usedColors.has(c));

  return (
    <StaffManager
      users={users}
      currentUserId={user.id}
      palette={[...AVATAR_PALETTE]}
      usedColors={[...usedColors]}
      suggestedColor={suggestedColors[0] ?? AVATAR_PALETTE[0]}
    />
  );
}
