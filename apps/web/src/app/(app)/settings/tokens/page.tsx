import { TokenSettings } from "@/components/settings/token-settings";
import { getCurrentUser } from "@/lib/current-user";
import { listPats } from "@/lib/auth/tokens";

export const dynamic = "force-dynamic";

/** 설정 > 토큰 — MCP·CLI 액세스 토큰(PAT). */
export default async function SettingsTokensPage() {
  const user = await getCurrentUser();
  const tokens = await listPats(user.id);
  return <TokenSettings tokens={tokens} />;
}
