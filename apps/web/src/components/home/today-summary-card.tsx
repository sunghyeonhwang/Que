"use client";

import { useState, useTransition } from "react";
import { RefreshCw, Sparkles } from "lucide-react";
import {
  generateHomeBriefingAction,
  type HomeBriefingResult,
} from "@/app/(app)/home/briefing-actions";
import { mdToHtml } from "@/app/(app)/help/help-markdown";
import { Button } from "@/components/ui/button";
import { HomeCard } from "@/components/home/home-card";

// Home/TodaySummary — 규칙 기반 오늘 요약 + 온디맨드 AI 브리핑(전 역할, E-10 Gemini 재사용).
// 규칙 문장(lines)은 항상 표시하고, AI 브리핑은 버튼을 눌렀을 때만 생성한다(자동 실행·비용 없음).
// 생성 결과 하단에는 외부 전송 고지 캡션을 result.scope로 구성해 표시한다(E-10 고지 원칙).

/** 오늘 요약 카드. title은 역할별로 다르다(사원=오늘 요약, 관리자=팀관리 AI 브리핑, 대표=경영 AI 브리핑). */
export function TodaySummaryCard({ title, lines }: { title: string; lines: string[] }) {
  const [result, setResult] = useState<HomeBriefingResult | null>(null);
  const [pending, startTransition] = useTransition();

  const generate = () => {
    startTransition(async () => {
      try {
        setResult(await generateHomeBriefingAction());
      } catch {
        setResult({
          ok: false,
          text: "AI 브리핑 요청이 중단되었습니다. 잠시 후 다시 시도하세요.",
          scope: [],
        });
      }
    });
  };

  return (
    <HomeCard
      title={title}
      action={
        <Button
          variant={result?.ok ? "ghost" : "outline"}
          size="sm"
          className="h-9"
          onClick={generate}
          disabled={pending}
        >
          {result?.ok ? (
            <RefreshCw
              className={pending ? "size-3.5 animate-spin" : "size-3.5"}
              aria-hidden
            />
          ) : (
            <Sparkles className="size-3.5" aria-hidden />
          )}
          {result?.ok ? "다시 생성" : "AI 브리핑 생성"}
        </Button>
      }
    >
      <div className="flex flex-col gap-3">
        {/* 규칙 기반 요약(항상 표시 · AI 폴백) */}
        <ul className="flex flex-col gap-1.5">
          {lines.map((line, i) => (
            <li
              key={i}
              className="flex items-start gap-2 text-sm text-[var(--que-text-secondary)]"
            >
              <span
                className="mt-1.5 size-1.5 shrink-0 rounded-full bg-[var(--que-text-tertiary)]"
                aria-hidden
              />
              <span>{line}</span>
            </li>
          ))}
        </ul>

        {pending && !result && (
          <p className="flex items-center gap-2 text-sm text-[var(--que-text-secondary)]">
            <RefreshCw className="size-4 animate-spin" aria-hidden />
            오늘 데이터를 읽고 브리핑을 만들고 있습니다… (10초 안팎)
          </p>
        )}

        {result && !result.ok && (
          <div className="flex flex-col gap-2 border-t border-[var(--que-border)] pt-3">
            <p role="alert" className="text-sm text-[var(--que-error)]">
              {result.text}
            </p>
            <Button
              variant="outline"
              className="h-10 w-fit"
              onClick={generate}
              disabled={pending}
            >
              다시 시도
            </Button>
          </div>
        )}

        {result?.ok && (
          <div className="flex flex-col gap-2 border-t border-[var(--que-border)] pt-3">
            <div
              className="help-md text-sm leading-relaxed [&_h3]:mt-3 [&_h3]:mb-1 [&_h3]:text-sm [&_h3]:font-semibold [&_li]:mt-1 [&_ul]:list-disc [&_ul]:pl-5"
              // mdToHtml은 원문을 이스케이프한 뒤 제한된 태그만 생성한다(도움말과 동일 경로) — XSS 안전.
              dangerouslySetInnerHTML={{ __html: mdToHtml(result.text) }}
            />
            <p className="border-t border-[var(--que-border)] pt-2 text-[11px] leading-relaxed text-[var(--que-text-tertiary)]">
              AI(Google Gemini)가 {result.scope.join(", ")} 데이터를 읽고 생성한 참고
              의견입니다. 개인 평가가 아니며, 판단과 결정은 사람이 합니다. 생성 시 해당 데이터가
              외부(Google)로 전송됩니다.
            </p>
          </div>
        )}
      </div>
    </HomeCard>
  );
}
