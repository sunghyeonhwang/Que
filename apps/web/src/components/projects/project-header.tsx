import { Share2, MoreHorizontal } from "lucide-react";
import type { ListViewMember } from "@/lib/pm-data";
import { IconButton } from "@/components/app/icon-button";
import { MemberAvatars } from "./member-avatars";

/** 프로젝트 헤더 — 이름·설명 + 멤버 아바타 스택 + 공유/더보기. */
export function ProjectHeader({
  name,
  description,
  members,
  memberOverflow,
}: {
  name: string;
  description: string;
  members: ListViewMember[];
  memberOverflow: number;
}) {
  return (
    <header className="flex flex-wrap items-start justify-between gap-x-4 gap-y-3">
      <div className="min-w-0">
        <h1 className="text-[26px] leading-tight font-bold tracking-tight text-[var(--que-text)]">
          {name}
        </h1>
        <p className="mt-1 text-sm text-[var(--que-text-secondary)]">{description}</p>
      </div>
      <div className="flex items-center gap-2">
        <MemberAvatars members={members} overflow={memberOverflow} size={34} />
        <IconButton label="공유" variant="outline">
          <Share2 className="size-4" aria-hidden />
        </IconButton>
        <IconButton label="더보기" variant="outline">
          <MoreHorizontal className="size-4" aria-hidden />
        </IconButton>
      </div>
    </header>
  );
}
