import { getCurrentUser } from "@/lib/current-user";
import { ImportSettings } from "@/components/settings/import-settings";

export const dynamic = "force-dynamic";

/** 설정 > 가져오기 — CSV로 작업·마일스톤 일괄 등록.
 *  전원 접근(작업 생성은 전원 가능) — 마일스톤 등 권한이 필요한 행은 core가 행 단위로 거부한다. */
export default async function SettingsImportPage() {
  await getCurrentUser(); // 인증 게이트(미인증 → /login)
  return <ImportSettings />;
}
