import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// 공개 읽기전용 현황판 호스트 라우팅.
// - host가 view 호스트면 모든 경로를 /view로 rewrite하고 X-Robots-Tag: noindex를 부착한다.
// - 그 외 호스트(que 본체)는 즉시 통과 — 영향 0. 미들웨어 인증 게이트는 없다((app) 레이아웃이 담당).
// matcher는 _next·api·정적 파일을 제외해 좁게 잡는다.

const VIEW_HOSTS = new Set(["view.griff.co.kr", "view.localhost"]);

function isViewHost(request: NextRequest): boolean {
  // Host 헤더(:port 제거)로 판정. NextRequest.headers 우선, 없으면 nextUrl.hostname.
  const raw = request.headers.get("host") ?? request.nextUrl.host;
  const host = raw.split(":")[0].toLowerCase();
  return VIEW_HOSTS.has(host);
}

export function proxy(request: NextRequest): NextResponse {
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
    // api·_next(정적/이미지)·favicon·robots·sitemap·확장자 있는 정적 파일 제외한 전 경로.
    "/((?!api|_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml|.*\\.[\\w]+$).*)",
  ],
};
