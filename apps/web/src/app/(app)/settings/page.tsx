import { cookies } from "next/headers";
import { FontSettings } from "@/components/settings/font-settings";

export const dynamic = "force-dynamic";

/** 설정 > 모양 — 폰트·테마·밀도. */
export default async function SettingsAppearancePage() {
  const cookieStore = await cookies();
  const ko = cookieStore.get("font-ko")?.value ?? "suit";
  const latin = cookieStore.get("font-latin")?.value ?? "inter";
  const theme = cookieStore.get("theme")?.value ?? "light";
  const density = cookieStore.get("density")?.value ?? "default";

  return (
    <FontSettings
      initialKo={ko}
      initialLatin={latin}
      initialTheme={theme}
      initialDensity={density}
    />
  );
}
