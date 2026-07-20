import { type NextRequest, NextResponse } from "next/server";

/**
 * 로그아웃 라우트 — 세션 쿠키의 모든 변형을 한 응답에서 소거한다.
 *
 * 왜 서버 액션이 아니라 Route Handler인가(2026-07-20 글래도스 반려 이행):
 * 2026-07-16 쿠키 도메인 확대(.griff.co.kr, SSO) 이전에 로그인한 브라우저에는 같은 이름의
 * 세션 쿠키가 2개 공존한다(구형=호스트 전용, 신형=Domain=.griff.co.kr). 삭제는 name+domain+path가
 * 일치해야 하므로 두 변형 각각에 Set-Cookie를 보내야 하는데, Next의 cookies() 저장소는
 * **이름 키로 대체(replace)** 라 같은 이름의 두 소거를 한 응답에 싣지 못한다(서버 액션·signOut의
 * 구조적 한계 — 실증: ResponseCookies 연속 set 시 마지막 1개만 발신). Route Handler는
 * headers.append("Set-Cookie", …)로 같은 이름의 헤더를 여러 개 발신할 수 있다.
 *
 * - JWT 세션(어댑터 없음)이라 쿠키 소거가 곧 로그아웃 완결 — 서버측 세션 무효화 대상 없음.
 * - 요청에 실제 존재하는 쿠키만 대상으로 하므로 멱등. 청크(`.0`…)·구명(접두 없는 이름) 커버.
 * - __Secure- 접두 쿠키는 Secure 속성 필수(없으면 브라우저가 소거를 무시) — 접두에서 파생.
 * - CSRF: 로그아웃은 파괴적 상태 변경이 아니고 SameSite=Lax가 크로스사이트 POST의 쿠키 동반을
 *   차단하므로 별도 토큰 없이 POST만 허용한다.
 * - 구형 쿠키는 maxAge 7일이라 2026-07-23 이후 자연 소멸하지만, 향후 쿠키 이름/도메인 전환이
 *   또 있을 때 같은 증상이 재발하지 않도록 이 소거는 상시 유지한다.
 */
const SESSION_COOKIE_RE = /^(__Secure-)?authjs\.session-token(\.\d+)?$/;
const COOKIE_DOMAIN = ".griff.co.kr";

export async function POST(req: NextRequest) {
  const res = NextResponse.json({ ok: true });
  for (const c of req.cookies.getAll()) {
    if (!SESSION_COOKIE_RE.test(c.name)) continue;
    const secure = c.name.startsWith("__Secure-") ? "; Secure" : "";
    const base = `${c.name}=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax${secure}`;
    // 호스트 전용 변형(도메인 속성 없음) — 구형 쿠키가 지워지는 경로.
    res.headers.append("Set-Cookie", base);
    // 도메인 변형 — 신형(SSO) 쿠키. 로그아웃이니 서브도메인 세션 동반 종료가 의도.
    res.headers.append("Set-Cookie", `${base}; Domain=${COOKIE_DOMAIN}`);
  }
  return res;
}
