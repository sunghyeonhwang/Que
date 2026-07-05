import { Check } from "lucide-react";
import type { ViewBoard, ViewBoardColumn, ViewCard } from "@/lib/view-data";
import { avatarInitials, withAlpha } from "./view-format";

// 할일 보드(하루). 담당자별 세로 열 + 완료 요약 pill + 읽기전용 카드 스택.
// - 조회 전용: 완료 원형은 상태 표시일 뿐 토글 불가(onClick 없음).
// - hideCompleted=true면 done 카드를 숨긴다(요약 pill의 done/total 수치는 유지).
export function BoardGrid({
  board,
  hideCompleted = false,
}: {
  board: ViewBoard;
  hideCompleted?: boolean;
}) {
  return (
    <div className="min-h-0 flex-1 overflow-auto px-8 py-6">
      <div
        className="grid h-full items-start gap-5"
        style={{ gridTemplateColumns: `repeat(${board.columns.length}, minmax(0, 1fr))` }}
      >
        {board.columns.map((column) => (
          <BoardColumn key={column.user.id} column={column} hideCompleted={hideCompleted} />
        ))}
      </div>
    </div>
  );
}

function BoardColumn({
  column,
  hideCompleted,
}: {
  column: ViewBoardColumn;
  hideCompleted: boolean;
}) {
  const { user } = column;
  const cards = hideCompleted
    ? column.cards.filter((c) => c.status !== "done")
    : column.cards;

  return (
    <div className="flex min-w-0 flex-col gap-3">
      <div className="flex items-center gap-2.5">
        <span
          className="flex size-9 shrink-0 items-center justify-center rounded-full text-xs font-semibold text-white"
          style={{ backgroundColor: user.avatarColor }}
        >
          {avatarInitials(user.name)}
        </span>
        <span className="min-w-0 flex-1 truncate text-lg font-bold text-neutral-900">
          {user.name}
        </span>
        <span
          className="shrink-0 rounded-full px-2.5 py-0.5 text-sm font-semibold tabular-nums"
          style={{
            backgroundColor: withAlpha(user.avatarColor, "1f"),
            color: user.avatarColor,
          }}
        >
          {column.doneCount}/{column.totalCount}
        </span>
      </div>

      <div className="flex flex-col gap-3">
        {cards.map((card) => (
          <BoardCard key={card.id} card={card} color={user.avatarColor} />
        ))}
      </div>
    </div>
  );
}

function BoardCard({ card, color }: { card: ViewCard; color: string }) {
  const done = card.status === "done";
  return (
    <div
      className="flex items-center gap-3 rounded-2xl px-4 py-3.5"
      style={{ backgroundColor: withAlpha(color, "14") }}
    >
      <div className="min-w-0 flex-1">
        <p className="truncate text-base font-bold text-neutral-900">{card.title}</p>
        {card.clientLabel ? (
          <p className="truncate text-sm text-neutral-500">{card.clientLabel}</p>
        ) : null}
      </div>
      {done ? (
        <span
          aria-label="완료"
          className="flex size-7 shrink-0 items-center justify-center rounded-full bg-green-600"
        >
          <Check className="size-4 text-white" strokeWidth={3} />
        </span>
      ) : (
        <span
          aria-label="미완료"
          className="size-7 shrink-0 rounded-full border-2 border-neutral-300"
        />
      )}
    </div>
  );
}
