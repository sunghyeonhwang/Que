import Link from "next/link";
import { ChevronRight, FolderClosed } from "lucide-react";
import type { TeamMemberCard } from "@/lib/members-data";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

/**
 * 팀 개요 멤버 카드(조회 전용).
 * 상단: 아바타 + 이름/이메일. 하단: 부서 라벨 · "자세히" 링크(멤버 상세로).
 * (멤버 조작 ⋮ 메뉴는 미구현이라 출시 시 미노출.)
 */
export function MemberCard({ member }: { member: TeamMemberCard }) {
  const deptLabel = member.department || member.rank;

  return (
    <div className="flex flex-col rounded-xl border border-[var(--que-border)] bg-[var(--que-bg)] p-4">
      <div className="flex items-start gap-3">
        <Avatar size="lg" className="shrink-0">
          <AvatarFallback
            style={{ backgroundColor: member.avatarColor }}
            className="font-medium text-white"
          >
            {member.name.slice(0, 1)}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold text-[var(--que-text)]">{member.name}</p>
          <p className="truncate text-xs text-[var(--que-text-tertiary)]">{member.email}</p>
        </div>
      </div>

      <div className="mt-4 flex items-center justify-between border-t border-[var(--que-border)] pt-3">
        <span className="flex min-w-0 items-center gap-1.5 text-sm text-[var(--que-text-secondary)]">
          <FolderClosed className="size-4 shrink-0 text-[var(--que-text-tertiary)]" aria-hidden />
          <span className="truncate">{deptLabel}</span>
        </span>
        <Link
          href={`/members/${member.id}`}
          className="flex h-10 items-center gap-0.5 rounded-lg px-2 text-sm font-medium text-[var(--que-brand)] hover:bg-[var(--que-brand-subtle)]"
        >
          자세히
          <ChevronRight className="size-4" aria-hidden />
        </Link>
      </div>
    </div>
  );
}
