import { StatusBadge } from "@/components/app/status-badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { StandupRow } from "@/lib/team-data";

// 데일리 스탠드업 뷰 — 아침 회의에서 화면 하나로 8명을 돈다.
// 서버 컴포넌트: 조회 전용, 조작은 각 화면(오늘/팀 현황 시간표)에서.

function TaskLine({ tasks, empty }: { tasks: StandupRow["blocked"]; empty: string }) {
  if (tasks.length === 0) {
    return <p className="text-xs text-muted-foreground">{empty}</p>;
  }
  return (
    <ul className="flex flex-col gap-1">
      {tasks.map((task) => (
        <li key={task.id} className="flex items-center gap-2 text-sm">
          <span className="min-w-0 flex-1 truncate">{task.title}</span>
          <StatusBadge status={task.status} />
        </li>
      ))}
    </ul>
  );
}

export function StandupGrid({ rows }: { rows: StandupRow[] }) {
  return (
    // 태블릿 세로(md)는 단일 컬럼 — DESIGN.md 레이아웃 원칙. 2열은 태블릿 가로(lg)부터.
    <div className="grid gap-3 lg:grid-cols-2 2xl:grid-cols-3">
      {rows.map(({ user, yesterdayDone, yesterdayUnfinished, todayPlanned, blocked }) => (
        <Card key={user.id}>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <span
                className="size-2.5 shrink-0 rounded-full"
                style={{ backgroundColor: user.avatarColor }}
                aria-hidden
              />
              {user.name}
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <section>
              <h3 className="mb-1 text-xs font-medium text-muted-foreground">어제</h3>
              <TaskLine tasks={yesterdayDone} empty="완료한 작업 없음" />
              {yesterdayUnfinished.length > 0 && (
                <div className="mt-1">
                  <TaskLine tasks={yesterdayUnfinished} empty="" />
                </div>
              )}
            </section>
            <section>
              <h3 className="mb-1 text-xs font-medium text-muted-foreground">오늘</h3>
              <TaskLine tasks={todayPlanned} empty="예정된 작업 없음" />
            </section>
            <section>
              <h3 className="mb-1 text-xs font-medium text-muted-foreground">막힘</h3>
              <TaskLine tasks={blocked} empty="없음" />
            </section>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
