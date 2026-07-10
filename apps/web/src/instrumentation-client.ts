import * as Sentry from "@sentry/nextjs";

// 성능 트레이싱 샘플레이트 — 기본 10%(8명 팀 트래픽에서 무료 할당 안).
// NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE로 조절(0=끔). 빌드 시점 주입.
const parsedRate = Number(process.env.NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE ?? "0.1");
// 비숫자·범위 밖 env는 0.1로 폴백 — NaN이 Sentry에 넘어가지 않게.
const TRACES_SAMPLE_RATE = Number.isFinite(parsedRate) && parsedRate >= 0 && parsedRate <= 1 ? parsedRate : 0.1;

// 클라이언트(브라우저) Sentry 초기화 (Next 15.3+/16의 instrumentation-client 훅).
// DSN(NEXT_PUBLIC_SENTRY_DSN)은 프로덕션·프리뷰 빌드에만 주입된다 → 로컬 dev에선 미설정이라
// Sentry가 no-op(아무것도 전송 안 함). DSN은 공개용 식별자라 클라 번들 노출이 정상이다.
Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  enabled: !!process.env.NEXT_PUBLIC_SENTRY_DSN,
  tracesSampleRate: TRACES_SAMPLE_RATE,
});

// App Router 클라 네비게이션 계측.
export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
