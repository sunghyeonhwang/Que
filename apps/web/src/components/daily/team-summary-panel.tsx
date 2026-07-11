"use client";

import { RefreshCw, Sparkles } from "lucide-react";
import { format } from "date-fns";
import { regenerateTeamSummaryAction } from "@/app/(app)/daily/actions";
import { useSafeAction } from "@/components/app/use-safe-action";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

// 데일리 스탠드업 AI 팀 요약 패널(기획 §3② · §4 ⑶). "오늘의 팀" 그리드 아래 배치.
// 생성 전: 대기 카드(전원 제출 즉시/11:00 생성 안내) + admin "지금 생성" 버튼.
// 생성 후: content를 섹션별로 렌더 + 하단 메타(생성 시각·모델·제출 시점·재생성).
// violet(응답대기 의미)은 쓰지 않는다 — 중립 카드 + 섹션 제목만 사용.

/** 직렬화 가능한 요약 부분집합(서버→클라이언트). */
export interface TeamSummaryView {
  content: string;
  model: "flash" | "pro";
  /** ISO 날짜시간. */
  generatedAt: string;
  /** 요약 생성 시점에 제출돼 있던 인원 수. */
  submittedAtGen: number;
}

interface TeamSummaryPanelProps {
  summary?: TeamSummaryView;
  /** 현재(실시간) 제출 인원. */
  submittedCount: number;
  totalCount: number;
  isAdmin: boolean;
}

interface Section {
  title: string;
  body: string;
}

// AI 팀 요약 content는 [막힘 클러스터] / [어제→오늘 흐름] / [추천 액션] 대괄호 머리글 + 본문의
// plain text 구조다(standup-summary.ts SUMMARY_SYSTEM 계약). 머리글 기준으로 섹션을 나눈다.
function parseSections(content: string): Section[] {
  const sections: Section[] = [];
  let cur: Section | null = null;
  for (const line of content.split(/\r?\n/)) {
    const m = line.match(/^\s*\[([^\]]+)\]\s*(.*)$/);
    if (m) {
      if (cur) sections.push(cur);
      cur = { title: m[1].trim(), body: m[2].trim() };
    } else if (cur) {
      cur.body += (cur.body ? "\n" : "") + line;
    } else {
      // 머리글 이전 선행 텍스트(있으면 제목 없는 블록으로).
      cur = { title: "", body: line };
    }
  }
  if (cur) sections.push(cur);
  return sections
    .map((s) => ({ title: s.title, body: s.body.trim() }))
    .filter((s) => s.title || s.body);
}

const MODEL_LABEL: Record<TeamSummaryView["model"], string> = {
  pro: "Gemini Pro",
  flash: "Gemini Flash",
};

export function TeamSummaryPanel({
  summary,
  submittedCount,
  totalCount,
  isAdmin,
}: TeamSummaryPanelProps) {
  const { run, pending } = useSafeAction();

  const regenerate = () => {
    run(() => regenerateTeamSummaryAction(), {
      success: "팀 요약을 새로 생성했습니다.",
    });
  };

  // 생성 전 — 대기 카드.
  if (!summary) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <Sparkles className="size-4 shrink-0" aria-hidden />
            AI 팀 요약
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <p className="text-sm text-muted-foreground">
            AI 팀 요약은 전원 제출 즉시 또는 11:00에 생성됩니다 · 현재{" "}
            <span className="tabular-nums text-foreground">
              {submittedCount}/{totalCount}
            </span>{" "}
            제출
          </p>
          {isAdmin && (
            <div className="flex flex-col gap-1.5">
              <Button className="h-10 w-fit" onClick={regenerate} disabled={pending}>
                {pending ? (
                  <RefreshCw className="size-4 animate-spin" aria-hidden />
                ) : (
                  <Sparkles className="size-4" aria-hidden />
                )}
                {pending ? "생성 중…" : "지금 생성"}
              </Button>
              <p className="text-xs text-muted-foreground">
                {pending
                  ? "AI가 팀 요약을 작성하고 있습니다. 수십 초 걸릴 수 있으니 기다려 주세요."
                  : "관리자만 즉시 생성할 수 있습니다. pro 모델 호출이라 수십 초 걸립니다."}
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    );
  }

  // 생성 후 — 섹션별 렌더 + 메타.
  const sections = parseSections(summary.content);
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <Sparkles className="size-4 shrink-0" aria-hidden />
          AI 팀 요약
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="flex flex-col gap-4">
          {sections.length > 0 ? (
            sections.map((s, i) => (
              <section key={`${s.title}-${i}`} className="flex flex-col gap-1">
                {s.title && (
                  <h3 className="text-sm font-semibold text-foreground">{s.title}</h3>
                )}
                <p className="whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">
                  {s.body}
                </p>
              </section>
            ))
          ) : (
            <p className="whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">
              {summary.content}
            </p>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 border-t pt-3 text-xs text-muted-foreground">
          <span className="tabular-nums">
            생성 {format(new Date(summary.generatedAt), "HH:mm")}
          </span>
          <span aria-hidden>·</span>
          <Badge variant="outline" className="font-normal">
            {MODEL_LABEL[summary.model]}
          </Badge>
          <span aria-hidden>·</span>
          <span className="tabular-nums">
            {summary.submittedAtGen}/{totalCount} 제출 시점
          </span>
          {isAdmin && (
            <Button
              variant="ghost"
              size="sm"
              className="ms-auto h-9"
              onClick={regenerate}
              disabled={pending}
            >
              <RefreshCw
                className={pending ? "size-3.5 animate-spin" : "size-3.5"}
                aria-hidden
              />
              {pending ? "재생성 중…" : "재생성"}
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
