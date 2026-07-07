import * as Sentry from "@sentry/nextjs";

// 엣지 런타임 Sentry 초기화. instrumentation.ts의 register()가 edge 런타임에서 import한다.
// 참고: Next 16에서 proxy.ts는 기본 Node.js 런타임으로 돌아 서버 config가 커버한다 — 이 edge
// config는 향후 edge 런타임 라우트가 생길 때를 위한 보험이다. DSN 미설정이면 no-op.
Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  enabled: !!process.env.NEXT_PUBLIC_SENTRY_DSN,
  tracesSampleRate: 0,
});
