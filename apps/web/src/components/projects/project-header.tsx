import type { ListViewMember } from "@/lib/pm-data";
import { MemberAvatars } from "./member-avatars";
import { ProjectHeaderActions } from "./project-header-actions";

/** 프로젝트 헤더 — 이름·설명 + 멤버 아바타 스택 + 공유/더보기. */
export function ProjectHeader({
  name,
  description,
  members,
  memberOverflow,
  allMembers,
}: {
  name: string;
  description: string;
  members: ListViewMember[];
  memberOverflow: number;
  /** 공유/정보 Dialog에 노출할 전체 멤버(meta.members). */
  allMembers: ListViewMember[];
}) {
  return (
    <header className="flex flex-wrap items-start justify-between gap-x-4 gap-y-3">
      <div className="min-w-0">
        <h1 className="text-[26px] leading-tight font-semibold tracking-tight text-[var(--que-text)]">
          {name}
        </h1>
        <p className="mt-1 text-sm text-[var(--que-text-secondary)]">{description}</p>
      </div>
      <div className="flex items-center gap-2">
        <MemberAvatars members={members} overflow={memberOverflow} size={34} />
        <ProjectHeaderActions
          projectName={name}
          description={description}
          allMembers={allMembers}
        />
      </div>
    </header>
  );
}
