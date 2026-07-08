import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { corsHeadersFor, resolveAllowedOrigin } from "@/lib/api/cors";

// Next.js 16: middleware는 proxy로 개명(파일 규약 proxy.ts, 프로젝트당 1개). 두 관심사를 함께 처리한다.
// (1) 공개 읽기전용 현황판 호스트 라우팅 — view 호스트면 모든 경로를 /view로 rewrite + noindex.
// (2) /api/* CORS — DayBlocks(todo.griff.co.kr) 등 브라우저 앱이 Que REST API를 호출하도록
//     화이트리스트 origin에만 ACAO를 에코. Bearer(PAT) 인증이라 쿠키 credentials 불필요 → ACA-Credentials 없음.
//     인증·도메인 규칙은 각 라우트(withApi)가 그대로 강제 — 여기선 CORS 헤더만 다룬다.

const VIEW_HOSTS = new Set(["view.griff.co.kr", "view.localhost"]);

function isViewHost(request: NextRequest): boolean {
  // Host 헤더(:port 제거)로 판정. NextRequest.headers 우선, 없으면 nextUrl.hostname.
  const raw = request.headers.get("host") ?? request.nextUrl.host;
  const host = raw.split(":")[0].toLowerCase();
  return VIEW_HOSTS.has(host);
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

  if (!isViewHost(request)) {
    // view 호스트가 아니면 아무것도 하지 않는다.
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
