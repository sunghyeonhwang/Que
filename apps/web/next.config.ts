import type { NextConfig } from "next";
import path from "node:path";
import { withSentryConfig } from "@sentry/nextjs";

const nextConfig: NextConfig = {
  // 모노레포 루트를 명시해 워크스페이스 루트 추론 경고를 막는다.
  turbopack: {
    root: path.join(__dirname, "../.."),
  },
};

// Sentry 래핑. 오류 캡처는 instrumentation 파일들이 담당하고, 여기선 빌드 계측만.
// 소스맵 업로드는 SENTRY_AUTH_TOKEN + SENTRY_ORG + SENTRY_PROJECT 세 env가 모두 있어야
// 동작한다(빌드 시점, Vercel env) — 미설정이면 조용히 건너뛰고 미니파이 스택으로 캡처.
// 활성 절차는 HANDOFF "Sentry" 절 참고.
export default withSentryConfig(nextConfig, {
  silent: !process.env.CI,
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  // 서버 파일까지 넓게 업로드해 읽는 스택 커버리지를 높인다(업로드 활성 시에만 의미).
  widenClientFileUpload: true,
  sourcemaps: {
    // 업로드 후 클라 번들에서 소스맵 제거 — 소스 코드가 브라우저에 노출되지 않게.
    deleteSourcemapsAfterUpload: true,
  },
});
