import Link from "next/link";
import { CircleHelp } from "lucide-react";
import { PageHeader } from "@/components/app/page-header";
import { mdToHtml } from "../help/help-markdown";
import { HelpToc } from "../help/help-toc";
import { FAQ_SECTIONS } from "./faq-content";

export const dynamic = "force-dynamic";

// 기타 > 설계 FAQ — "왜 이렇게 만들었나" 류 질문 모음. 콘텐츠는 faq-content.ts,
// 렌더러(mdToHtml)와 목차(HelpToc)는 도움말 것을 재사용한다(복제 금지). 구조·스타일은 /help와 동일.
export default function FaqPage() {
  const sections = FAQ_SECTIONS.map((s) => ({ ...s, html: mdToHtml(s.md) }));
  const toc = sections.map(({ id, title }) => ({ id, title }));

  return (
    <div>
      <PageHeader
        title="설계 FAQ"
        subtitle="Que가 왜 이렇게 만들어졌는지 — 규칙 뒤의 이유를 설명합니다."
        actions={
          <Link
            href="/help"
            className="flex h-10 items-center gap-1.5 rounded-lg border border-[var(--que-border)] px-3 text-sm font-medium text-[var(--que-text-secondary)] hover:bg-[var(--que-bg-muted)]"
          >
            <CircleHelp className="size-4" aria-hidden />
            사용법은 도움말
          </Link>
        }
      />

      <div className="grid gap-8 lg:grid-cols-[210px_minmax(0,1fr)]">
        <div className="hidden lg:block">
          <HelpToc items={toc} />
        </div>

        <div className="flex min-w-0 flex-col gap-5">
          {sections.map((s, idx) => (
            <section
              key={s.id}
              id={s.id}
              className="scroll-mt-24 rounded-xl border border-[var(--que-border)] bg-[var(--que-bg)] p-5 shadow-[var(--que-shadow-sm)] md:p-6"
            >
              <h2 className="mb-4 flex items-center gap-2.5 text-xl font-semibold tracking-tight text-[var(--que-text)]">
                <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-[var(--que-brand-subtle)] text-sm font-semibold tabular-nums text-[var(--que-brand)]">
                  {idx + 1}
                </span>
                {s.title}
              </h2>
              <div className="help-prose" dangerouslySetInnerHTML={{ __html: s.html }} />
            </section>
          ))}

          <p className="px-1 pb-2 text-center text-sm text-[var(--que-text-tertiary)]">
            화면별 사용법·자주 하는 일이 궁금하면{" "}
            <Link href="/help" className="text-[var(--que-brand)] hover:underline">
              도움말
            </Link>{" "}
            화면을 참고하세요.
          </p>
        </div>
      </div>
    </div>
  );
}
