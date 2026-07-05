import Link from "next/link";
import { Terminal } from "lucide-react";
import { PageHeader } from "@/components/app/page-header";
import { HELP_SECTIONS } from "./help-content";
import { mdToHtml } from "./help-markdown";
import { HelpToc } from "./help-toc";

export const dynamic = "force-dynamic";

// 기타 > 도움말 — 비개발 팀원용 사용 설명서. 콘텐츠는 help-content.ts, 렌더는 help-markdown.ts.
export default function HelpPage() {
  const sections = HELP_SECTIONS.map((s) => ({ ...s, html: mdToHtml(s.md) }));
  const toc = sections.map(({ id, title }) => ({ id, title }));

  return (
    <div>
      <PageHeader
        title="도움말"
        subtitle="Que를 처음 쓰는 분도 바로 따라 할 수 있게 정리했어요. 궁금할 때 언제든 여기로 오세요."
        actions={
          <Link
            href="/tools"
            className="flex h-10 items-center gap-1.5 rounded-lg border border-[var(--que-border)] px-3 text-sm font-medium text-[var(--que-text-secondary)] hover:bg-[var(--que-bg-muted)]"
          >
            <Terminal className="size-4" aria-hidden />
            AI · 터미널로 쓰기
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
            더 궁금한 점이 있으면 팀 관리자에게 물어보세요. AI·터미널로 Que를 쓰는 방법은{" "}
            <Link href="/tools" className="text-[var(--que-brand)] hover:underline">
              MCP · CLI
            </Link>{" "}
            화면을 참고하세요.
          </p>
        </div>
      </div>
    </div>
  );
}
