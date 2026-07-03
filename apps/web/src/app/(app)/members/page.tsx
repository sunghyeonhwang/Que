import { PageHeader } from "@/components/app/page-header";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { getCurrentUser } from "@/lib/current-user";
import { getMembersData, type MemberCard } from "@/lib/members-data";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

// 팀 화면 — 팀원 카드 + 오늘 업무 요약(조회 전용). 편집/생성 없음.
export default async function MembersPage() {
  // 다른 (app) 페이지와 동일한 인증 게이트.
  await getCurrentUser();
  const members = await getMembersData();

  return (
    <div>
      <PageHeader title="팀" subtitle="팀원별 프로필과 오늘 업무 요약" />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
        {members.map((member) => (
          <MemberCardView key={member.user.id} member={member} />
        ))}
      </div>
    </div>
  );
}

function MemberCardView({ member }: { member: MemberCard }) {
  const { user, email, rank, summary } = member;
  const initial = user.name.slice(0, 1);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start gap-3">
          <Avatar size="lg" className="shrink-0">
            <AvatarFallback
              style={{ backgroundColor: user.avatarColor }}
              className="font-medium text-white"
            >
              {initial}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-base font-semibold">{user.name}</span>
              <Badge variant="secondary">{rank}</Badge>
              {user.role === "admin" && <Badge variant="outline">관리자</Badge>}
            </div>
            <p className="mt-1 truncate text-xs text-muted-foreground">{email}</p>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <dl className="grid grid-cols-3 gap-2">
          <Stat label="진행중" value={summary.inProgress} tone="green" />
          <Stat label="문제" value={summary.issues} tone="red" />
          <Stat label="홀드" value={summary.onHold} tone="amber" />
          <Stat label="오늘 마감/예정" value={summary.dueToday} tone="blue" />
          <Stat label="활성 작업" value={summary.activeTotal} tone="neutral" />
          <Stat
            label="예상 시간"
            value={summary.estimatedHours > 0 ? `${summary.estimatedHours}h` : "—"}
            tone="neutral"
          />
        </dl>
      </CardContent>
    </Card>
  );
}

// 상태 색상 의미 고정(CLAUDE.md): green=진행, blue=예정/정보, amber=홀드/대기, red=문제.
// 값이 0이면 muted로 눌러 시선을 뺏지 않는다.
const TONE: Record<string, string> = {
  green: "text-emerald-600 dark:text-emerald-400",
  red: "text-red-600 dark:text-red-400",
  amber: "text-amber-600 dark:text-amber-400",
  blue: "text-blue-600 dark:text-blue-400",
  neutral: "text-foreground",
};

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: number | string;
  tone: keyof typeof TONE;
}) {
  const isZero = value === 0;
  return (
    <div className="rounded-md border p-2">
      <dd
        className={cn(
          "text-xl font-semibold tabular-nums",
          isZero ? "text-muted-foreground" : TONE[tone],
        )}
      >
        {value}
      </dd>
      <dt className="text-[11px] leading-tight text-muted-foreground">{label}</dt>
    </div>
  );
}
