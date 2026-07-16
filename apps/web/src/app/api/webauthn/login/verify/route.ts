import { verifyAuthenticationResponse } from "@simplewebauthn/server";
import type { AuthenticationResponseJSON } from "@simplewebauthn/server";
import {
  isWebauthnEnabled,
  resolveRp,
  readAndClearChallenge,
  getCredentialById,
  getUserAuthInfo,
  base64urlToPublicKey,
  updateCredentialCounter,
  issueLoginToken,
} from "@/lib/auth/webauthn";

// POST /api/webauthn/login/verify — 로그인 검증(비인증 허용).
// body: { response: AuthenticationResponseJSON }
// 성공 시 원타임 로그인 토큰(60초)을 반환한다 → 프론트가 Auth.js "passkey" 프로바이더로 교환.
// 여기서는 세션을 만들지 않는다(토큰 소진·세션 생성은 auth.ts authorize에서).

const NO_STORE = { "Cache-Control": "no-store" };

function fail(status: number, message: string): Response {
  return Response.json({ error: message }, { status, headers: NO_STORE });
}

export async function POST(request: Request) {
  try {
    if (!isWebauthnEnabled()) return fail(501, "이 환경에서는 패스키를 사용할 수 없습니다.");

    const body = (await request.json().catch(() => null)) as {
      response?: AuthenticationResponseJSON;
    } | null;
    if (!body?.response) return fail(400, "요청 형식이 올바르지 않습니다.");

    const challenge = await readAndClearChallenge();
    if (!challenge) return fail(400, "로그인 세션이 만료되었습니다. 다시 시도해주세요.");

    // 인증 응답의 credential id로 저장된 자격증명을 찾는다.
    const stored = await getCredentialById(body.response.id);
    if (!stored) return fail(401, "등록되지 않은 패스키입니다.");

    // 자격증명 소유자가 활성 계정인지 확인(비활성/퇴사 계정 차단).
    const info = await getUserAuthInfo(stored.userId);
    if (!info || !info.active) return fail(401, "로그인할 수 없는 계정입니다.");

    const { rpID, expectedOrigin } = resolveRp(request.headers.get("host"));
    const verification = await verifyAuthenticationResponse({
      response: body.response,
      expectedChallenge: challenge.challenge,
      expectedOrigin,
      expectedRPID: rpID,
      requireUserVerification: false,
      credential: {
        id: stored.id,
        publicKey: base64urlToPublicKey(stored.publicKey),
        counter: stored.counter,
        transports: stored.transports,
      },
    });

    if (!verification.verified) return fail(401, "패스키 인증에 실패했습니다.");

    // 서명 카운터 갱신(리플레이 방지) — 실패해도 로그인은 진행(토큰 재사용은 nonce가 막는다).
    await updateCredentialCounter(stored.id, verification.authenticationInfo.newCounter);

    const token = await issueLoginToken(stored.userId);
    return Response.json({ token }, { headers: NO_STORE });
  } catch {
    return fail(500, "패스키 로그인에 실패했습니다.");
  }
}
