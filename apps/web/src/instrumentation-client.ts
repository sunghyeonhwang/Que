import * as Sentry from "@sentry/nextjs";

// 클라이언트(브라우저) Sentry 초기화 (Next 15.3+/16의 instrumentation-client 훅).
// DSN(NEXT_PUBLIC_SENTRY_DSN)은 프로덕션·프리뷰 빌드에만 주입된다 → 로컬 dev에선 미설정이라
// Sentry가 no-op(아무것도 전송 안 함). DSN은 공개용 식별자라 클라 번들 노출이 정상이다.
Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  enabled: !!process.env.NEXT_PUBLIC_SENTRY_DSN,
  // 에러 리포팅 중심 — 성능 트레이싱/리플레이는 후속(필요 시 상향).
  tracesSampleRate: 0,
});

// App Router 클라 네비게이션 계측.
export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
