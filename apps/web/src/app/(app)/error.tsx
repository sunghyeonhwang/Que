"use client";

import { useEffect } from "react";
import Link from "next/link";
import { Button, buttonVariants } from "@/components/ui/button";
import { reportError } from "@/lib/report-error";
import { cn } from "@/lib/utils";

// 앱 셸은 유지한 채 본문만 교체되는 에러 경계 (que-error-reporting-plan.md 2.1).
// 스택트레이스는 절대 노출하지 않고, 대조용 오류 코드(digest)만 보여준다.
export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    reportError(error, { boundary: "app", digest: error.digest ?? "" });
  }, [error]);

  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4 text-center">
      <div>
        <h1 className="text-xl font-semibold">문제가 생겼습니다</h1>
        {/* 자동 전달(Sentry)이 연동되기 전까지는 "전달됐다"고 말하지 않는다 — que-error-reporting-plan.md 2.1 원칙 */}
        <p className="mt-2 text-sm text-muted-foreground">
          오류가 기록됐습니다. 자동 전달은 아직 준비 중이니, 아래 오류 코드를 개발팀에 직접
          알려주세요.
        </p>
        {error.digest && (
          <p className="mt-2 font-mono text-sm text-muted-foreground">
            오류 코드: {error.digest}
          </p>
        )}
      </div>
      <div className="flex gap-2">
        <Button className="h-10" onClick={reset}>
          다시 시도
        </Button>
        <Link href="/today" className={cn(buttonVariants({ variant: "outline" }), "h-10")}>
          오늘 화면으로
        </Link>
      </div>
    </div>
  );
}
