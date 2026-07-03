import { FolderClosed } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { MemberActivity } from "@/lib/members-data";

// 최근 활동(서버) — 담당 작업의 상태 로그를 최신순으로 표시. 조회 전용.

export function MemberActivityFeed({ activities }: { activities: MemberActivity[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>최근 활동</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {activities.length === 0 ? (
          <p className="py-6 text-center text-sm text-[var(--que-text-tertiary)]">
            최근 활동이 없습니다.
          </p>
        ) : (
          <ul className="flex flex-col gap-4">
            {activities.map((activity) => (
              <li key={activity.id} className="flex items-start gap-3">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-[var(--que-brand-subtle)]">
                  <FolderClosed
                    className="size-4 text-[var(--que-brand)]"
                    aria-hidden
                  />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-[var(--que-text)]">
                    {activity.title}
                  </p>
                  <p className="truncate text-sm text-[var(--que-text-secondary)]">
                    {activity.description}
                  </p>
                </div>
                <span className="shrink-0 text-xs text-[var(--que-text-tertiary)]">
                  {activity.relative}
                </span>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
