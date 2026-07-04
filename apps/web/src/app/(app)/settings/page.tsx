import { cookies } from "next/headers";
import { PageHeader } from "@/components/app/page-header";
import { FontSettings } from "@/components/settings/font-settings";
import { getCurrentUser } from "@/lib/current-user";

export const dynamic = "force-dynamic";

/** 설정 — 모양(폰트) 등. 폰트는 한글/영문 별도 선택, 쿠키로 유지(브라우저 단위). */
export default async function SettingsPage() {
  await getCurrentUser();
  const cookieStore = await cookies();
  const ko = cookieStore.get("font-ko")?.value ?? "suit";
  const latin = cookieStore.get("font-latin")?.value ?? "inter";

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="설정" subtitle="모양과 환경을 설정합니다." />
      <FontSettings initialKo={ko} initialLatin={latin} />
    </div>
  );
}
