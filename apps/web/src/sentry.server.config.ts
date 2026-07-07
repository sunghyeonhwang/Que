import * as Sentry from "@sentry/nextjs";

// 서버(Node 런타임) Sentry 초기화. instrumentation.ts의 register()가 nodejs 런타임에서 import한다.
// DSN 미설정(로컬 dev)이면 no-op.
Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  enabled: !!process.env.NEXT_PUBLIC_SENTRY_DSN,
  tracesSampleRate: 0,
});
