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
// 소스맵 업로드는 SENTRY_AUTH_TOKEN이 있어야 동작한다 → 현재 미설정이라 업로드는 건너뛰고
// (미니파이 스택으로 캡처), 후속에서 토큰 추가 시 활성화된다.
export default withSentryConfig(nextConfig, {
  silent: !process.env.CI,
});
