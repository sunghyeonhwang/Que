import type { ProjectMeta } from "@/lib/projects-data";
import { MemberAvatars } from "./member-avatars";
import { ProjectHeaderActions } from "./project-header-actions";

const MAX_AVATARS = 5;

/** 프로젝트 헤더 — 이름·설명 + 멤버 아바타 스택 + 공유/더보기. */
export function ProjectHeader({ meta }: { meta: ProjectMeta }) {
  const shown = meta.members.slice(0, MAX_AVATARS);
  const overflow = Math.max(0, meta.members.length - shown.length);

  return (
    <header className="flex flex-wrap items-start justify-between gap-x-4 gap-y-3">
      <div className="min-w-0">
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
