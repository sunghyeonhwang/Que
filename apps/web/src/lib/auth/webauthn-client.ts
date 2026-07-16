// 패스키(WebAuthn) 브라우저 흐름 헬퍼 — 클라이언트 컴포넌트 전용.
// @simplewebauthn/browser의 startRegistration/startAuthentication로 기기 서명 ceremony를 실행하고,
// 앞뒤로 /api/webauthn/* 라우트를 호출한다. 서버 계약(webauthn.ts·route.ts)과 1:1 대응.
//
// 결과는 예외 대신 판별 유니온으로 돌려준다(호출부가 취소·비활성·실패를 분기하기 쉽게):
//  - "ok"        : 성공
//  - "cancelled" : 사용자가 브라우저 프롬프트를 닫음(NotAllowedError/AbortError) — 조용히 무시
//  - "disabled"  : 501(mock/dev 등 기능 비활성 환경) — 안내만
//  - "error"     : 그 외 실패(사람이 읽을 message 포함)
import { useSyncExternalStore } from "react";
import { startRegistration, startAuthentication } from "@simplewebauthn/browser";
import type {
  PublicKeyCredentialCreationOptionsJSON,
  PublicKeyCredentialRequestOptionsJSON,
} from "@simplewebauthn/browser";

/** 이 브라우저가 WebAuthn(패스키)을 지원하는가. SSR에서는 항상 false. */
export function isPasskeySupported(): boolean {
  return typeof window !== "undefined" && typeof window.PublicKeyCredential === "function";
}

// 지원 여부는 정적 capability라 변하지 않는다 — 구독은 no-op.
const noopSubscribe = () => () => {};

/**
 * 패스키 지원 여부를 hydration-safe하게 구독한다(login-form의 useRememberedEmail 선례).
 * effect 내 setState 없이 마운트 후 실제 값으로 갱신된다.
 * @param serverDefault SSR/첫 프레임 기본값. 로그인처럼 미지원 시 "숨김"이 안전하면 false(기본),
 *   설정 카드처럼 "일단 지원 가정"이 자연스러우면 true(미지원 안내가 깜빡이지 않게).
 */
export function usePasskeySupported(serverDefault = false): boolean {
  return useSyncExternalStore(noopSubscribe, isPasskeySupported, () => serverDefault);
}

/** 사용자가 프롬프트를 취소·중단한 에러인가(에러 토스트 없이 넘길 대상). */
function isCancel(err: unknown): boolean {
  return err instanceof Error && (err.name === "NotAllowedError" || err.name === "AbortError");
}

export type RegisterOutcome =
  | { status: "ok"; deviceName: string }
  | { status: "cancelled" }
  | { status: "disabled" }
  | { status: "error"; message: string };

export type AuthOutcome =
  | { status: "ok"; token: string }
  | { status: "cancelled" }
  | { status: "disabled" }
  | { status: "error"; message: string };

const GENERIC_ERROR = "패스키 처리 중 문제가 발생했습니다. 잠시 후 다시 시도해주세요.";

async function readError(res: Response): Promise<string> {
  try {
    const body = (await res.json()) as { error?: string };
    return body.error || GENERIC_ERROR;
  } catch {
    return GENERIC_ERROR;
  }
}

/** 패스키 등록: options → 기기 서명 → verify. */
export async function registerPasskey(deviceName?: string): Promise<RegisterOutcome> {
  let optsRes: Response;
  try {
    optsRes = await fetch("/api/webauthn/register/options", { method: "POST" });
  } catch {
    return { status: "error", message: GENERIC_ERROR };
  }
  if (optsRes.status === 501) return { status: "disabled" };
  if (!optsRes.ok) return { status: "error", message: await readError(optsRes) };

  const optionsJSON = (await optsRes.json()) as PublicKeyCredentialCreationOptionsJSON;

  let attResp;
  try {
    attResp = await startRegistration({ optionsJSON });
  } catch (err) {
    if (isCancel(err)) return { status: "cancelled" };
    // InvalidStateError = 이 기기에 이미 등록됨 등.
    return { status: "error", message: "이 기기에서 패스키를 만들 수 없습니다. 이미 등록된 기기일 수 있습니다." };
  }

  let verifyRes: Response;
  try {
    verifyRes = await fetch("/api/webauthn/register/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ response: attResp, deviceName }),
    });
  } catch {
    return { status: "error", message: GENERIC_ERROR };
  }
  if (verifyRes.status === 501) return { status: "disabled" };
  if (!verifyRes.ok) return { status: "error", message: await readError(verifyRes) };

  const data = (await verifyRes.json()) as { credential?: { deviceName?: string } };
  return { status: "ok", deviceName: data.credential?.deviceName ?? "내 기기" };
}

/** 패스키 로그인: options → 기기 서명 → verify. 성공 시 원타임 로그인 토큰 반환. */
export async function authenticatePasskey(): Promise<AuthOutcome> {
  let optsRes: Response;
  try {
    optsRes = await fetch("/api/webauthn/login/options", { method: "POST" });
  } catch {
    return { status: "error", message: GENERIC_ERROR };
  }
  if (optsRes.status === 501) return { status: "disabled" };
  if (!optsRes.ok) return { status: "error", message: await readError(optsRes) };

  const optionsJSON = (await optsRes.json()) as PublicKeyCredentialRequestOptionsJSON;

  let authResp;
  try {
    authResp = await startAuthentication({ optionsJSON });
  } catch (err) {
    if (isCancel(err)) return { status: "cancelled" };
    return { status: "error", message: GENERIC_ERROR };
  }

  let verifyRes: Response;
  try {
    verifyRes = await fetch("/api/webauthn/login/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ response: authResp }),
    });
  } catch {
    return { status: "error", message: GENERIC_ERROR };
  }
  if (verifyRes.status === 501) return { status: "disabled" };
  if (!verifyRes.ok) return { status: "error", message: await readError(verifyRes) };

  const data = (await verifyRes.json()) as { token?: string };
  if (!data.token) return { status: "error", message: GENERIC_ERROR };
  return { status: "ok", token: data.token };
}
