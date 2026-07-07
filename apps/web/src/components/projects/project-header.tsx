import Link from "next/link";
import { Building2 } from "lucide-react";
import type { ProjectMeta } from "@/lib/projects-data";
import { MemberAvatars } from "./member-avatars";
import { ProjectHeaderActions } from "./project-header-actions";

const MAX_AVATARS = 5;

/**
 * 프로젝트 헤더 — 소속 클라이언트(보조) + 이름·설명 + 멤버 아바타 스택 + 공유/더보기.
 * 거래처→프로젝트→작업 위계를 화면 안에서 드러낸다. 클라이언트명은 관리자만 /clients로 링크
 * (클라이언트 화면은 관리자 전용 리다이렉트), 비관리자에게는 조회 전용 텍스트로만 보인다.
 */
export function ProjectHeader({ meta, isAdmin }: { meta: ProjectMeta; isAdmin: boolean }) {
  const shown = meta.members.slice(0, MAX_AVATARS);
  const overflow = Math.max(0, meta.members.length - shown.length);

  return (
    <header className="flex flex-wrap items-start justify-between gap-x-4 gap-y-3">
      <div className="min-w-0">
        {meta.clientName ? (
          isAdmin ? (
            <Link
              href="/clients"
              className="inline-flex max-w-full items-center gap-1 text-sm font-medium text-[var(--que-text-secondary)] hover:text-[var(--que-brand)] hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--que-brand)]"
            >
              <Building2 className="size-3.5 shrink-0" aria-hidden />
              <span className="truncate">{meta.clientName}</span>
            </Link>
          ) : (
            <span className="inline-flex max-w-full items-center gap-1 text-sm font-medium text-[var(--que-text-secondary)]">
              <Building2 className="size-3.5 shrink-0" aria-hidden />
              <span className="truncate">{meta.clientName}</span>
            </span>
          )
        ) : null}
        <h1 className="text-[26px] leading-tight font-semibold tracking-tight text-[var(--que-text)]">
          {meta.name}
        </h1>
        {meta.description ? (
          <p className="mt-1 text-sm text-[var(--que-text-secondary)]">{meta.description}</p>
        ) : null}
      </div>
      <div className="flex items-center gap-2">
        <MemberAvatars members={shown} overflow={overflow} size={34} />
        <ProjectHeaderActions
          projectName={meta.name}
          description={meta.description ?? ""}
          allMembers={meta.members}
        />
      </div>
    </header>
  );
}
