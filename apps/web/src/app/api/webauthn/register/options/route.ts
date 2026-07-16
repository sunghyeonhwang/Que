import { generateRegistrationOptions } from "@simplewebauthn/server";
import { isoUint8Array } from "@simplewebauthn/server/helpers";
import { auth } from "@/auth";
import {
  isWebauthnEnabled,
  resolveRp,
  getUserAuthInfo,
  listCredentialTransports,
  setChallengeCookie,
} from "@/lib/auth/webauthn";

// POST /api/webauthn/register/options — 패스키 등록 옵션 발급(인증 필수).
// 성공 시 PublicKeyCredentialCreationOptionsJSON을 그대로 반환하고, 챌린지는 서명 쿠키로 심는다.

const NO_STORE = { "Cache-Control": "no-store" };

function fail(status: number, message: string): Response {
  return Response.json({ error: message }, { status, headers: NO_STORE });
}

export async function POST(request: Request) {
  try {
    // mock/dev(키 없음)에서는 패스키 비활성 — SSO 선례대로 501.
    if (!isWebauthnEnabled()) return fail(501, "이 환경에서는 패스키를 사용할 수 없습니다.");

    // 인증 게이트(첫 줄). API라 redirect 대신 401 JSON을 반환한다.
    const session = await auth();
    const userId = session?.user?.id;
    if (!userId) return fail(401, "로그인이 필요합니다.");
    const info = await getUserAuthInfo(userId);
    if (!info || !info.active) return fail(401, "로그인이 필요합니다.");

    const { rpName, rpID } = resolveRp(request.headers.get("host"));
    // 중복 등록 방지 — 이미 등록된 자격증명은 제외한다.
    const existing = await listCredentialTransports(userId);

    const options = await generateRegistrationOptions({
      rpName,
      rpID,
      userID: isoUint8Array.fromUTF8String(info.id),
      userName: info.email,
      userDisplayName: info.name,
      attestationType: "none",
      excludeCredentials: existing.map((c) => ({ id: c.id, transports: c.transports })),
      // 디스커버러블(resident key) — 이메일 입력 없이 패스키만으로 로그인.
      authenticatorSelection: { residentKey: "required", userVerification: "preferred" },
    });

    await setChallengeCookie({ challenge: options.challenge, userId });
    return Response.json(options, { headers: NO_STORE });
  } catch {
    // 상세 원인은 노출하지 않는다(일반화된 메시지).
    return fail(500, "패스키 등록 옵션 생성에 실패했습니다.");
  }
}
