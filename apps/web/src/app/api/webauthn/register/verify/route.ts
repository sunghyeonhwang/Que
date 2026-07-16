import { verifyRegistrationResponse } from "@simplewebauthn/server";
import type { RegistrationResponseJSON } from "@simplewebauthn/server";
import { auth } from "@/auth";
import {
  isWebauthnEnabled,
  resolveRp,
  readAndClearChallenge,
  insertCredential,
  publicKeyToBase64url,
  normalizeDeviceName,
} from "@/lib/auth/webauthn";

// POST /api/webauthn/register/verify — 등록 검증·저장(인증 필수).
// body: { response: RegistrationResponseJSON, deviceName?: string }
// 챌린지 쿠키의 userId가 현재 세션과 일치해야 저장한다(교차 사용자 등록 차단).

const NO_STORE = { "Cache-Control": "no-store" };

function fail(status: number, message: string): Response {
  return Response.json({ error: message }, { status, headers: NO_STORE });
}

export async function POST(request: Request) {
  try {
    if (!isWebauthnEnabled()) return fail(501, "이 환경에서는 패스키를 사용할 수 없습니다.");

    const session = await auth();
    const userId = session?.user?.id;
    if (!userId) return fail(401, "로그인이 필요합니다.");

    const body = (await request.json().catch(() => null)) as {
      response?: RegistrationResponseJSON;
      deviceName?: string;
    } | null;
    if (!body?.response) return fail(400, "요청 형식이 올바르지 않습니다.");

    const challenge = await readAndClearChallenge();
    // 챌린지가 없거나 등록 흐름의 userId가 현재 세션과 다르면 거부.
    if (!challenge || challenge.userId !== userId) {
      return fail(400, "등록 세션이 만료되었습니다. 다시 시도해주세요.");
    }

    const { rpID, expectedOrigin } = resolveRp(request.headers.get("host"));
    const verification = await verifyRegistrationResponse({
      response: body.response,
      expectedChallenge: challenge.challenge,
      expectedOrigin,
      expectedRPID: rpID,
      requireUserVerification: false, // 옵션에서 "preferred"라 강제하지 않는다.
    });

    if (!verification.verified || !verification.registrationInfo) {
      return fail(400, "패스키 등록 검증에 실패했습니다.");
    }

    const { credential } = verification.registrationInfo;
    const deviceName = normalizeDeviceName(body.deviceName);
    const ok = await insertCredential({
      id: credential.id,
      userId,
      publicKey: publicKeyToBase64url(credential.publicKey),
      counter: credential.counter,
      transports: credential.transports ?? [],
      deviceName,
    });
    if (!ok) return fail(409, "이미 등록된 패스키이거나 저장에 실패했습니다.");

    return Response.json(
      { ok: true, credential: { id: credential.id, deviceName } },
      { headers: NO_STORE },
    );
  } catch {
    return fail(500, "패스키 등록에 실패했습니다.");
  }
}
