import type { ListViewMember } from "@/lib/pm-types";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

/** 담당자 아바타 스택. avatarColor + 이름 이니셜(성 제외 첫 글자들). */
export function MemberAvatars({
  members,
  overflow = 0,
  size = 28,
  className,
}: {
  members: ListViewMember[];
  overflow?: number;
  size?: number;
  className?: string;
}) {
  if (members.length === 0 && overflow === 0) {
    return <span className="text-xs text-[var(--que-text-tertiary)]">-</span>;
  }
  const px = `${size}px`;
  return (
    <div className={cn("flex items-center -space-x-2", className)}>
      {members.map((m) => (
        <Avatar
          key={m.id}
          style={{ width: px, height: px }}
        >
          <AvatarFallback
            className="text-[11px] font-semibold text-white"
            style={{ backgroundColor: m.avatarColor }}
          >
            {m.name.slice(1)}
          </AvatarFallback>
        </Avatar>
      ))}
      {overflow > 0 && (
        <span
          className="flex items-center justify-center rounded-full bg-[var(--que-bg-muted)] text-[11px] font-semibold text-[var(--que-text-secondary)]"
          style={{ width: px, height: px }}
          aria-label={`외 ${overflow}명`}
        >
          +{overflow}
        </span>
      )}
    </div>
  );
}
