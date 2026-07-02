"use client";

// 에러 리포팅 진입점 — 현재는 콘솔 로깅만 한다.
// Sentry DSN이 결정되면 여기서 Sentry.captureException으로 교체한다
// (docs/que-error-reporting-plan.md 3장). 호출부는 이 함수만 알면 된다.

export function reportError(error: unknown, context?: Record<string, string>): void {
  console.error("[que-error-report]", context ?? {}, error);
}
