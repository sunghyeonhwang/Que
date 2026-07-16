import { PasswordSettings } from "@/components/settings/password-settings";
import { PasskeySettings } from "@/components/settings/passkey-settings";
import { listMyPasskeys } from "@/app/(app)/settings/passkey-actions";

export const dynamic = "force-dynamic";

/** 설정 > 보안 — 본인 비밀번호 변경 + 패스키(WebAuthn) 관리. */
export default async function SettingsSecurityPage() {
  const passkeys = await listMyPasskeys();
  return (
    <div className="flex flex-col gap-6">
      <PasswordSettings />
      <PasskeySettings passkeys={passkeys} />
    </div>
  );
}
