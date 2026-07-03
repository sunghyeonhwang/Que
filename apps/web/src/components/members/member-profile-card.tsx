import { BadgeCheck, FolderClosed, Mail, Shield } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Card, CardContent } from "@/components/ui/card";
import type { MemberDetail, MemberInfoField } from "@/lib/members-data";

// 프로필 카드(서버) — 아바타 + 이름 + 이메일 + 2×2 정보 그리드.
// ⚠️ infoFields만 렌더한다. 위치/전화/생년월일 등 PII는 데이터에도 화면에도 없다.

const ICONS: Record<MemberInfoField["icon"], typeof FolderClosed> = {
  dept: FolderClosed,
  rank: BadgeCheck,
  role: Shield,
  email: Mail,
};

export function MemberProfileCard({ detail }: { detail: MemberDetail }) {
  const { user, email, infoFields } = detail;

  return (
    <Card>
      <CardContent className="flex flex-col gap-6">
        <div className="flex items-center gap-4">
          <Avatar size="lg" className="size-14 shrink-0">
            <AvatarFallback
              style={{ backgroundColor: user.avatarColor }}
              className="text-lg font-medium text-white"
            >
              {user.name.slice(0, 1)}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <h2 className="truncate text-xl font-semibold text-[var(--que-text)]">
              {user.name}
            </h2>
            <p className="truncate text-sm text-[var(--que-text-secondary)]">{email}</p>
          </div>
        </div>

        <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {infoFields.map((field) => {
            const Icon = ICONS[field.icon];
            return (
              <div key={field.icon} className="flex items-center gap-3">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-[var(--que-bg-muted)]">
                  <Icon
                    className="size-4 text-[var(--que-text-tertiary)]"
                    aria-hidden
                  />
                </span>
                <div className="min-w-0">
                  <dt className="text-xs text-[var(--que-text-tertiary)]">{field.label}</dt>
                  <dd className="truncate text-sm text-[var(--que-text)]">{field.value}</dd>
                </div>
              </div>
            );
          })}
        </dl>
      </CardContent>
    </Card>
  );
}
