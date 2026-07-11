import { format } from "date-fns";
import { Target } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

// 데일리 스탠드업 "오늘 보드" 전원 카드(기획 §4 ⑵). 조회 전용 프레젠테이션 —
// 제출자는 사람이 쓴 말(focus/note/막힘) + 하단 파생 4분면 칩 요약, 미제출자는 회색 카드.

export interface BoardMember {
  id: string;
  name: string;
  avatarColor?: string;
  isMe: boolean;
  submitted: boolean;
  submittedAt?: string;
  focus?: string;
  note?: string;
  blockerText?: string;
  /** 막힌 작업 제목(선택 칩) — 표시용. */
  blockedTitles: string[];
  /** 파생 4분면 개수(본인=live myStandup, 타인=제출 시점 snapshot). 미제출 타인은 없음. */
  counts?: { done: number; carried: number; today: number };
  /** 이번 달 활성 KR 진척 칩(최대 2개). 없으면 빈 배열 — 미표시. */
  krChips: { title: string; progress: number }[];
}

type DerivedCounts = NonNullable<BoardMember["counts"]>;

function DerivedChips({ counts }: { counts: DerivedCounts }) {
  return (
    <div className="flex flex-wrap gap-1.5 text-xs text-muted-foreground">
      <span className="rounded-md bg-muted px-2 py-0.5">어제 완료 {counts.done}</span>
      <span className="rounded-md bg-muted px-2 py-0.5">이월 {counts.carried}</span>
      <span className="rounded-md bg-muted px-2 py-0.5">오늘 {counts.today}</span>
    </div>
  );
}

/** 이번 달 활성 KR 진척 칩(기획 §7 Phase 4). 목표 진척 축 — 상태색과 분리한 중립 틴트. */
function KrChips({ chips }: { chips: BoardMember["krChips"] }) {
  if (chips.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-1.5">
      {chips.map((kr) => (
        <span
          key={kr.title}
          className="inline-flex items-center gap-1 rounded-md border border-border bg-muted/40 px-2 py-0.5 text-xs text-muted-foreground"
        >
          <Target className="size-3 shrink-0" aria-hidden />
          <span className="max-w-[140px] truncate">{kr.title}</span>
          <span className="font-medium tabular-nums text-foreground">{kr.progress}%</span>
        </span>
      ))}
    </div>
  );
}

function MemberCard({ member }: { member: BoardMember }) {
  const nameRow = (
    <CardTitle className="flex items-center gap-2 text-base">
      <span
        className="size-2.5 shrink-0 rounded-full"
        style={{ backgroundColor: member.avatarColor }}
        aria-hidden
      />
      <span className="min-w-0 truncate">{member.name}</span>
      {member.isMe && (
        <Badge variant="outline" className="shrink-0">
          나
        </Badge>
      )}
    </CardTitle>
  );

  if (!member.submitted) {
    return (
      <Card className="border-dashed bg-muted/30">
        <CardHeader className="pb-2">{nameRow}</CardHeader>
        <CardContent className="flex flex-col gap-3">
          <p className="text-sm text-muted-foreground">아직 제출 전</p>
          {member.counts && <DerivedChips counts={member.counts} />}
          <KrChips chips={member.krChips} />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          {nameRow}
          {member.submittedAt && (
            <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
              {format(new Date(member.submittedAt), "HH:mm")}
            </span>
          )}
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <p className="text-base font-semibold leading-snug">{member.focus}</p>
        {member.note && (
          <p className="text-sm text-muted-foreground">{member.note}</p>
        )}
        {(member.blockerText || member.blockedTitles.length > 0) && (
          <div className="rounded-md border border-destructive/30 bg-destructive/5 p-2">
            <div className="flex flex-wrap items-center gap-1.5">
              <Badge variant="destructive">막힘</Badge>
              {member.blockedTitles.map((title) => (
                <span key={title} className="text-xs text-muted-foreground">
                  {title}
                </span>
              ))}
            </div>
            {member.blockerText && (
              <p className="mt-1.5 text-sm text-foreground">{member.blockerText}</p>
            )}
          </div>
        )}
        {member.counts && <DerivedChips counts={member.counts} />}
        <KrChips chips={member.krChips} />
      </CardContent>
    </Card>
  );
}

export function StandupBoard({ members }: { members: BoardMember[] }) {
  return (
    // 태블릿 세로(md)는 단일 컬럼, 2열은 lg부터 — StandupGrid 룩 계승.
    <div className="grid gap-3 lg:grid-cols-2 2xl:grid-cols-3">
      {members.map((member) => (
        <MemberCard key={member.id} member={member} />
      ))}
    </div>
  );
}
