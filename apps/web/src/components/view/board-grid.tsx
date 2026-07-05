"use client";

import { useEffect, useState } from "react";
import { Check, ChevronLeft, ChevronRight } from "lucide-react";
import type { ViewBoard, ViewBoardColumn, ViewCard } from "@/lib/view-data";
import { avatarInitials, withAlpha } from "./view-format";

// 할일 보드(하루). 담당자별 세로 열 + 완료 요약 pill + 읽기전용 카드 스택.
// - 조회 전용: 완료 원형은 상태 표시일 뿐 토글 불가(onClick 없음).
// - hideCompleted=true면 done 카드를 숨긴다(요약 pill의 done/total 수치는 유지).
// - 벽 디스플레이 가독성: 한 화면 2명(PAGE_SIZE)씩 페이지네이션. 카드/글자를 크게.
//   페이지 인덱스는 client 상태라 10분 router.refresh(RSC 갱신)에도 유지된다.
//   AUTO_ADVANCE_MS마다 자동 순환(마지막→처음 루프), 수동 클릭 시 타이머 리셋.

const PAGE_SIZE = 2;
const AUTO_ADVANCE_MS = 15_000;

export function BoardGrid({
  board,
  hideCompleted = false,
}: {
  board: ViewBoard;
  hideCompleted?: boolean;
}) {
  const columns = board.columns;
  const pageCount = Math.max(1, Math.ceil(columns.length / PAGE_SIZE));

  const [page, setPage] = useState(0);
  // pauseKey를 바꾸면 자동순환 타이머가 재시작된다(수동 이동 시 리셋용).
  const [pauseKey, setPauseKey] = useState(0);

  // 열 수가 줄어 page가 범위를 벗어나도 렌더에서 안전하게 보정(effect setState 회피).
  const safePage = page < pageCount ? page : 0;

  // 자동 순환. pageCount가 1이면 돌지 않는다.
  useEffect(() => {
    if (pageCount <= 1) return;
    const id = setInterval(() => {
      setPage((p) => (p + 1) % pageCount);
    }, AUTO_ADVANCE_MS);
    return () => clearInterval(id);
  }, [pageCount, pauseKey]);

  const go = (delta: number) => {
    setPage((p) => ((p < pageCount ? p : 0) + delta + pageCount) % pageCount);
    setPauseKey((k) => k + 1);
  };

  const start = safePage * PAGE_SIZE;
  const visible = columns.slice(start, start + PAGE_SIZE);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="min-h-0 flex-1 overflow-auto px-8 py-6">
        <div
          className="grid h-full items-start gap-8"
          style={{ gridTemplateColumns: `repeat(${PAGE_SIZE}, minmax(0, 1fr))` }}
        >
          {visible.map((column) => (
            <BoardColumn
              key={column.user.id}
              column={column}
              hideCompleted={hideCompleted}
            />
          ))}
        </div>
      </div>

      {pageCount > 1 ? (
        <PageControl
          page={safePage}
          pageCount={pageCount}
          onPrev={() => go(-1)}
          onNext={() => go(1)}
        />
      ) : null}
    </div>
  );
}

// ---------- 페이지 컨트롤(다크 pill) ----------

function PageControl({
  page,
  pageCount,
  onPrev,
  onNext,
}: {
  page: number;
  pageCount: number;
  onPrev: () => void;
  onNext: () => void;
}) {
  return (
    <div className="flex shrink-0 justify-center py-5">
      <div className="flex items-center gap-2 rounded-full bg-neutral-900 p-2 text-white">
        <button
          type="button"
          onClick={onPrev}
          aria-label="이전 페이지"
          className="flex size-11 items-center justify-center rounded-full bg-neutral-700 hover:bg-neutral-600"
        >
          <ChevronLeft className="size-5" />
        </button>
        <span className="px-3 text-base font-semibold tabular-nums tracking-wide">
          PAGE {page + 1}/{pageCount}
        </span>
        <button
          type="button"
          onClick={onNext}
          aria-label="다음 페이지"
          className="flex size-11 items-center justify-center rounded-full bg-neutral-700 hover:bg-neutral-600"
        >
          <ChevronRight className="size-5" />
        </button>
      </div>
    </div>
  );
}

// ---------- 담당자 열 ----------

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
    <div className="flex min-w-0 flex-col gap-4">
      <div className="flex items-center gap-3">
        <span
          className="flex size-12 shrink-0 items-center justify-center rounded-full text-base font-semibold text-white"
          style={{ backgroundColor: user.avatarColor }}
        >
          {avatarInitials(user.name)}
        </span>
        <span className="min-w-0 flex-1 truncate text-2xl font-bold text-neutral-900">
          {user.name}
        </span>
        <span
          className="shrink-0 rounded-full px-3.5 py-1 text-lg font-semibold tabular-nums"
          style={{
            backgroundColor: withAlpha(user.avatarColor, "1f"),
            color: user.avatarColor,
          }}
        >
          {column.doneCount}/{column.totalCount}
        </span>
      </div>

      <div className="flex flex-col gap-4">
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
      className="flex items-center gap-4 rounded-2xl px-5 py-4"
      style={{ backgroundColor: withAlpha(color, "14") }}
    >
      <div className="min-w-0 flex-1">
        <p className="truncate text-2xl font-bold text-neutral-900">{card.title}</p>
        {card.clientLabel ? (
          <p className="truncate text-lg text-neutral-500">{card.clientLabel}</p>
        ) : null}
      </div>
      {done ? (
        <span
          aria-label="완료"
          className="flex size-9 shrink-0 items-center justify-center rounded-full bg-green-600"
        >
          <Check className="size-5 text-white" strokeWidth={3} />
        </span>
      ) : (
        <span
          aria-label="미완료"
          className="size-9 shrink-0 rounded-full border-2 border-neutral-300"
        />
      )}
    </div>
  );
}
