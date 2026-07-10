"use client";

import { useState, useTransition } from "react";
import { RefreshCw, Sparkles } from "lucide-react";
import { analyzeTeamReportAction } from "@/app/(app)/team/report-actions";
import { mdToHtml } from "@/app/(app)/help/help-markdown";
import type { ReportPeriod } from "@/lib/report-data";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

// E-10 분석 AI 카드 — /team 리포트(관리자 뷰) 전용, 온디맨드.
// 버튼을 눌렀을 때만 서버 액션 → Gemini 호출(자동 실행·크론 없음 — 비용·놀람 방지).
// 응답은 도움말과 같은 경량 마크다운 렌더(mdToHtml — 이스케이프 처리라 LLM 출력에도 안전).
// 고지: 참고 의견(개인 평가 아님) + 집계 데이터가 외부(Google Gemini)로 전송됨을 명시.

export function AiAnalysisCard({ period }: { period: ReportPeriod }) {
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, startTransition] = useTransition();

  const generate = () => {
    startTransition(async () => {
      setResult(await analyzeTeamReportAction(period));
    });
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0">
        <CardTitle className="flex items-center gap-2 text-base">
          <Sparkles className="size-4 text-[var(--que-brand)]" aria-hidden />
          AI 분석
        </CardTitle>
        {result?.ok && (
          <Button
            variant="ghost"
            size="sm"
            className="h-9 text-[var(--que-text-secondary)]"
            onClick={generate}
            disabled={pending}
          >
            <RefreshCw className={pending ? "size-3.5 animate-spin" : "size-3.5"} aria-hidden />
            다시 생성
          </Button>
        )}
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {result === null && !pending && (
          <>
            <p className="text-sm text-[var(--que-text-secondary)]">
              이 리포트의 숫자들을 AI가 읽고, 지금 가장 큰 병목과 이번 주에 해볼 조치를
              정리해 드립니다. 버튼을 누를 때만 실행됩니다.
            </p>
            <Button className="h-10 w-fit" onClick={generate}>
              <Sparkles className="size-4" aria-hidden />
              AI 분석 생성
            </Button>
          </>
        )}
        {pending && result === null && (
          <p className="flex items-center gap-2 text-sm text-[var(--que-text-secondary)]">
            <RefreshCw className="size-4 animate-spin" aria-hidden />
            리포트를 분석하고 있습니다… (10초 안팎)
          </p>
        )}
        {result && !result.ok && (
          <div className="flex flex-col gap-2">
            <p role="alert" className="text-sm text-[var(--que-error)]">
              {result.text}
            </p>
            <Button variant="outline" className="h-10 w-fit" onClick={generate} disabled={pending}>
              다시 시도
            </Button>
          </div>
        )}
        {result?.ok && (
          <div
            className="help-md text-sm leading-relaxed [&_h3]:mt-3 [&_h3]:mb-1 [&_h3]:text-sm [&_h3]:font-semibold [&_li]:mt-1 [&_ul]:list-disc [&_ul]:pl-5"
            // mdToHtml은 원문을 이스케이프한 뒤 제한된 태그만 생성한다(도움말과 동일 경로) — XSS 안전.
            dangerouslySetInnerHTML={{ __html: mdToHtml(result.text) }}
          />
        )}
        <p className="border-t border-[var(--que-border)] pt-2 text-[11px] leading-relaxed text-[var(--que-text-tertiary)]">
          AI(Google Gemini)가 이 리포트에 표시되는 집계 데이터(수치·작업명·담당자·막힘 사유)를
          읽고 생성한 참고 의견입니다. 개인 평가가 아니며, 판단과 결정은 사람이 합니다. 생성 시
          해당 데이터가 외부(Google)로 전송됩니다.
        </p>
      </CardContent>
    </Card>
  );
}
