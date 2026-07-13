import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { corsHeadersFor, resolveAllowedOrigin } from "@/lib/api/cors";

// Next.js 16: middleware는 proxy로 개명(파일 규약 proxy.ts, 프로젝트당 1개). 세 관심사를 함께 처리한다.
// (1) 공개 읽기전용 현황판 호스트 라우팅 — view 호스트면 모든 경로를 /view로 rewrite + noindex.
// (2) 회의용 통합 간트 호스트 라우팅 — gant 호스트면 루트(/)를 /gantt로 rewrite + noindex.
//     view와 달리 인증이 필요하므로(관리자·대표 전용) 루트만 rewrite하고 /login·/gantt 등 다른
//     경로는 그대로 통과시킨다 → getCurrentUser의 로그인 리다이렉트·재로그인 흐름이 정상 동작한다.
// (3) /api/* CORS — DayBlocks(todo.griff.co.kr) 등 브라우저 앱이 Que REST API를 호출하도록
//     화이트리스트 origin에만 ACAO를 에코. Bearer(PAT) 인증이라 쿠키 credentials 불필요 → ACA-Credentials 없음.
//     인증·도메인 규칙은 각 라우트(withApi)가 그대로 강제 — 여기선 CORS 헤더만 다룬다.

const VIEW_HOSTS = new Set(["view.griff.co.kr", "view.localhost"]);
const GANTT_HOSTS = new Set(["gant.griff.co.kr", "gant.localhost"]);
// (4) 폰트 페어링 공개 사이트 — font 호스트면 모든 경로를 /font로 rewrite(인증 없음, 인덱스 허용).
const FONT_HOSTS = new Set(["font.griff.co.kr", "font.localhost"]);

/** Host 헤더(:port 제거) 소문자. NextRequest.headers 우선, 없으면 nextUrl.host. */
function hostnameOf(request: NextRequest): string {
  const raw = request.headers.get("host") ?? request.nextUrl.host;
  return raw.split(":")[0].toLowerCase();
}

function isViewHost(request: NextRequest): boolean {
  return VIEW_HOSTS.has(hostnameOf(request));
}

function isGanttHost(request: NextRequest): boolean {
  return GANTT_HOSTS.has(hostnameOf(request));
}

function isFontHost(request: NextRequest): boolean {
  return FONT_HOSTS.has(hostnameOf(request));
}

/** /api/* 요청에 CORS를 붙인다(프리플라이트 포함). */
function handleApiCors(request: NextRequest): NextResponse {
  const allowedOrigin = resolveAllowedOrigin(request.headers.get("origin"));

  // 프리플라이트(OPTIONS)는 라우트까지 가지 않고 여기서 응답한다.
  if (request.method === "OPTIONS") {
    // 화이트리스트 밖(또는 origin 없음)이면 CORS 헤더 없이 204 — 브라우저가 차단한다.
    return new NextResponse(null, {
      status: 204,
      headers: allowedOrigin ? corsHeadersFor(allowedOrigin) : undefined,
    });
  }

  const response = NextResponse.next();
  // 실제 요청: 화이트리스트 매칭 시에만 ACAO를 부여한다.
  if (allowedOrigin) {
    for (const [key, value] of Object.entries(corsHeadersFor(allowedOrigin))) {
      response.headers.set(key, value);
    }
  }
  return response;
}

export function proxy(request: NextRequest): NextResponse {
  if (request.nextUrl.pathname.startsWith("/api")) {
    return handleApiCors(request);
  }

  if (isGanttHost(request)) {
    // 회의용 간트 호스트: 루트만 /gantt로 rewrite. 그 외 경로(/gantt·/login·/change-password 등)는
    // 그대로 통과 → 인증 게이트(getCurrentUser)의 로그인 리다이렉트 루프를 피한다.
    if (request.nextUrl.pathname === "/") {
      const url = request.nextUrl.clone();
      url.pathname = "/gantt";
      const response = NextResponse.rewrite(url);
      response.headers.set("X-Robots-Tag", "noindex, nofollow");
      return response;
    }
    const response = NextResponse.next();
    response.headers.set("X-Robots-Tag", "noindex, nofollow");
    return response;
  }

  if (isFontHost(request)) {
    // 폰트 페어링 사이트: view처럼 전 경로 rewrite — 공개·비인증이라 그대로 /font 하나로 수렴.
    const url = request.nextUrl.clone();
    if (url.pathname !== "/font") url.pathname = "/font";
    return NextResponse.rewrite(url);
  }

  if (!isViewHost(request)) {
    // view·gant 어느 호스트도 아니면 아무것도 하지 않는다.
    return NextResponse.next();
  }

  const url = request.nextUrl.clone();
  // 이미 /view 하위면 재rewrite하지 않고 헤더만 붙인다(rewrite 루프 방지).
  if (url.pathname !== "/view") {
    url.pathname = "/view";
  }
  const response = NextResponse.rewrite(url);
  response.headers.set("X-Robots-Tag", "noindex, nofollow");
  return response;
}

export const config = {
  matcher: [
    // (1) view 호스트 rewrite용 — api·_next(정적/이미지)·favicon·robots·sitemap·확장자 정적 파일 제외.
    "/((?!api|_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml|.*\\.[\\w]+$).*)",
    // (2) CORS용 — /api/* 전체(위 패턴이 제외하므로 별도 등록).
    "/api/:path*",
  ],
};
