"use client";

import { useEffect } from "react";
import { reportError } from "@/lib/report-error";

// 앱 셸 자체가 죽었을 때의 최후 방어선 — 루트 layout을 대체하므로 html/body를 직접 렌더한다.
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    reportError(error, { boundary: "global", digest: error.digest ?? "" });
  }, [error]);

  return (
    <html lang="ko">
      <body style={{ fontFamily: "sans-serif", padding: "4rem 1rem", textAlign: "center" }}>
        <h1 style={{ fontSize: "1.25rem", fontWeight: 600 }}>문제가 생겼습니다</h1>
        {/* 자동 전달(Sentry) 연동 전에는 "전달됐다"고 말하지 않는다 — que-error-reporting-plan.md 2.1 원칙 */}
        <p style={{ marginTop: "0.5rem", color: "#666", fontSize: "0.875rem" }}>
          오류가 기록됐습니다. 자동 전달은 아직 준비 중이니, 아래 오류 코드를 개발팀에 직접
          알려주세요.
        </p>
        {error.digest && (
          <p style={{ marginTop: "0.5rem", fontFamily: "monospace", color: "#666" }}>
            오류 코드: {error.digest}
          </p>
        )}
        <button
          onClick={reset}
          style={{
            marginTop: "1rem",
            minHeight: 40,
            padding: "0 1rem",
            border: "1px solid #ccc",
            borderRadius: 8,
            cursor: "pointer",
          }}
        >
          다시 시도
        </button>
      </body>
    </html>
  );
}
