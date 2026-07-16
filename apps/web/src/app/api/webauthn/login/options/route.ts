import { generateAuthenticationOptions } from "@simplewebauthn/server";
import { isWebauthnEnabled, resolveRp, setChallengeCookie } from "@/lib/auth/webauthn";

// POST /api/webauthn/login/options — 로그인 옵션 발급(비인증 허용).
// 디스커버러블 자격증명이라 allowCredentials를 생략한다(이메일 없이 패스키만으로 로그인).
// 챌린지는 userId 없이 서명 쿠키로 심는다.

const NO_STORE = { "Cache-Control": "no-store" };

function fail(status: number, message: string): Response {
  return Response.json({ error: message }, { status, headers: NO_STORE });
}

export async function POST(request: Request) {
  try {
    if (!isWebauthnEnabled()) return fail(501, "이 환경에서는 패스키를 사용할 수 없습니다.");

    const { rpID } = resolveRp(request.headers.get("host"));
    const options = await generateAuthenticationOptions({
      rpID,
      userVerification: "preferred",
      // allowCredentials 생략 — 디스커버러블(resident key).
    });

    await setChallengeCookie({ challenge: options.challenge });
    return Response.json(options, { headers: NO_STORE });
  } catch {
    return fail(500, "패스키 로그인 옵션 생성에 실패했습니다.");
  }
}
