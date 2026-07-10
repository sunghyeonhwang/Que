import * as Sentry from "@sentry/nextjs";

// 성능 트레이싱 샘플레이트 — 기본 10%(8명 팀 트래픽에서 무료 할당 안).
// NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE로 조절(0=끔). 빌드 시점 주입.
const parsedRate = Number(process.env.NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE ?? "0.1");
// 비숫자·범위 밖 env는 0.1로 폴백 — NaN이 Sentry에 넘어가지 않게.
const TRACES_SAMPLE_RATE = Number.isFinite(parsedRate) && parsedRate >= 0 && parsedRate <= 1 ? parsedRate : 0.1;

// 서버(Node 런타임) Sentry 초기화. instrumentation.ts의 register()가 nodejs 런타임에서 import한다.
// DSN 미설정(로컬 dev)이면 no-op.
Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  enabled: !!process.env.NEXT_PUBLIC_SENTRY_DSN,
  tracesSampleRate: TRACES_SAMPLE_RATE,
});
