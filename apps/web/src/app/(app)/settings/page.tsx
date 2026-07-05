import { cookies } from "next/headers";
import { PageHeader } from "@/components/app/page-header";
import { FontSettings } from "@/components/settings/font-settings";
import { PasswordSettings } from "@/components/settings/password-settings";
import { TokenSettings } from "@/components/settings/token-settings";
import { getCurrentUser } from "@/lib/current-user";
import { listPats } from "@/lib/auth/tokens";

export const dynamic = "force-dynamic";

/** 설정 — 모양(폰트)·보안(비밀번호)·액세스 토큰(MCP·CLI). */
export default async function SettingsPage() {
  const user = await getCurrentUser();
  const tokens = await listPats(user.id);
  const cookieStore = await cookies();
  const ko = cookieStore.get("font-ko")?.value ?? "suit";
  const latin = cookieStore.get("font-latin")?.value ?? "inter";
  const theme = cookieStore.get("theme")?.value ?? "light";
  const density = cookieStore.get("density")?.value ?? "default";

  return (
    <div className="flex flex-col gap-5">
      <PageHeader title="설정" subtitle="모양과 보안을 설정합니다." />
      <FontSettings
        initialKo={ko}
        initialLatin={latin}
        initialTheme={theme}
        initialDensity={density}
      />
      <PasswordSettings />
      <TokenSettings tokens={tokens} />
    </div>
  );
}
