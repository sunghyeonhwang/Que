import { PasswordSettings } from "@/components/settings/password-settings";

export const dynamic = "force-dynamic";

/** 설정 > 보안 — 본인 비밀번호 변경. */
export default function SettingsSecurityPage() {
  return <PasswordSettings />;
}
