"use client";

import * as Sentry from "@sentry/nextjs";

// 에러 리포팅 진입점. 콘솔 로깅 + Sentry 전송(DSN 미설정이면 Sentry가 no-op).
// 호출부는 이 함수만 알면 된다. context는 Sentry 태그로 부착(필터/검색용).

export function reportError(error: unknown, context?: Record<string, string>): void {
  console.error("[que-error-report]", context ?? {}, error);
  Sentry.captureException(error, context ? { tags: context } : undefined);
}
