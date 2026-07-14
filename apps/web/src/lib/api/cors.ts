// CORS 허용 origin 관리 — DayBlocks(todo.griff.co.kr) 등 브라우저 앱이 Que REST API를 호출할 수 있게 한다.
// Bearer(PAT) 인증이라 쿠키(credentials)는 불필요 → ACA-Credentials는 넣지 않는다.
// 허용 origin은 env QUE_CORS_ORIGINS(콤마 구분) 화이트리스트. 매칭될 때만 ACAO를 에코한다.

const DEFAULT_ORIGINS = [
  "https://todo.griff.co.kr",
  // 개발용 로컬(DayBlocks Vite dev 서버 기본 포트 포함)
  "http://localhost:5173",
  "http://localhost:3000",
  "http://127.0.0.1:5173",
];

/** env(콤마 구분) + 기본값을 합친 허용 origin 집합. */
export function allowedOrigins(): Set<string> {
  const fromEnv = (process.env.QUE_CORS_ORIGINS ?? "")
    .split(",")
    .map((o) => o.trim())
    .filter(Boolean);
  return new Set([...DEFAULT_ORIGINS, ...fromEnv]);
}

/** origin이 화이트리스트에 있으면 그 origin을, 없으면 null을 반환한다. */
export function resolveAllowedOrigin(origin: string | null): string | null {
  if (!origin) return null;
  return allowedOrigins().has(origin) ? origin : null;
}

export const CORS_ALLOW_METHODS = "GET, POST, PATCH, DELETE, OPTIONS";
export const CORS_ALLOW_HEADERS = "Authorization, Content-Type, X-Que-Via";
export const CORS_MAX_AGE = "86400";

/** 허용된 origin에 대한 공통 CORS 헤더(응답에 세팅할 항목). credentials 없음. */
export function corsHeadersFor(allowedOrigin: string): Record<string, string> {
  return {
    "Access-Control-Allow-Origin": allowedOrigin,
    "Access-Control-Allow-Methods": CORS_ALLOW_METHODS,
    "Access-Control-Allow-Headers": CORS_ALLOW_HEADERS,
    "Access-Control-Max-Age": CORS_MAX_AGE,
    // origin별로 응답이 달라지므로 캐시 오염 방지.
    Vary: "Origin",
  };
}

/** 쿠키(credentials) 동반 요청을 허용해야 하는 라우트 전용 CORS 헤더.
 *  현재 유일 소비자: /api/auth/sso(브라우저 세션 쿠키 → PAT 교환).
 *  ACA-Credentials:true는 ACAO 와일드카드(*)와 함께 쓰면 스펙 위반이므로, 반드시
 *  화이트리스트에서 에코한 구체 origin(allowedOrigin)과만 조합한다. */
export function corsHeadersWithCredentials(allowedOrigin: string): Record<string, string> {
  return {
    ...corsHeadersFor(allowedOrigin),
    "Access-Control-Allow-Credentials": "true",
  };
}
