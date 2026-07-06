import type { ReactNode } from "react";
import { PageHeader } from "@/components/app/page-header";
import { SettingsTabs } from "@/components/settings/settings-tabs";
import { getCurrentUser } from "@/lib/current-user";

export const dynamic = "force-dynamic";

/**
 * 설정 서브라우트 공통 셸 — 헤더 + 탭(모양/보안/토큰/직원 관리).
 * 직원 관리 탭은 관리자에게만 노출한다. 페이지·서버 액션에서도 별도로 강제한다(UI만 믿지 않음).
 */
export default async function SettingsLayout({ children }: { children: ReactNode }) {
  const user = await getCurrentUser();
  const isAdmin = user.role === "admin";

  return (
    <div className="flex flex-col gap-5">
      <PageHeader title="설정" subtitle="모양과 보안, 계정을 설정합니다." />
      <SettingsTabs isAdmin={isAdmin} />
      {children}
    </div>
  );
}
