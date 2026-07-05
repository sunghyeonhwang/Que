"use client";

import { useEffect, useState } from "react";
import { Check, ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ViewBoard, ViewBoardColumn, ViewCard } from "@/lib/view-data";
import { avatarInitials, scale, withAlpha } from "./view-format";

// 할일 보드(하루). 담당자별 세로 열 + 완료 요약 pill + 읽기전용 카드 스택.
// - 조회 전용: 완료 원형은 상태 표시일 뿐 토글 불가(onClick 없음).
// - hideCompleted=true면 done 카드를 숨긴다(요약 pill의 done/total 수치는 유지). 두 모드 공통.
// - mode(item 2, URL ?bmode):
//   · "all"(기본): 8명을 한 화면에(2행×4열). 카드/폰트 컴팩트, 열 내부 카드 많으면 열별 스크롤.
//   · "paged": 2명/페이지. PAGE x/N·15초 자동순환·수동 화살표(벽 순환용).
// - 토글은 상단 헤더(URL ?bmode)에서 하므로 여기선 mode를 받아 렌더만 분기한다.

const PAGE_SIZE = 2;
const AUTO_ADVANCE_MS = 15_000;

export function BoardGrid({
  board,
  hideCompleted = false,
  mode = "all",
  play = false,
  bp,
}: {
  board: ViewBoard;
  hideCompleted?: boolean;
  mode?: "all" | "paged";
  // 슬라이드쇼 연동:
  //  · bp 지정: 그 페이지(2명)를 고정 표시하고 자체 15초 순환을 끈다.
  //  · play + mode=paged(bp 없음): 방어적으로 1페이지 고정.
  //  · play + mode=all: 전체 8명 단일 화면(슬라이드쇼 boardMode=all).
  play?: boolean;
  bp?: number;
}) {
  // 슬라이드쇼(bp 지정)가 페이지를 주도하면 2명/페이지로 고정 렌더한다.
  if (bp != null) {
    return (
      <BoardPaged
        board={board}
        hideCompleted={hideCompleted}
        driven
        drivenPage={bp}
      />
    );
  }
  // bp 없이 재생 중 + paged 모드: 슬라이드쇼가 boardMode=paged로 주도(방어적으로 1페이지 고정).
  if (play && mode === "paged") {
    return (
      <BoardPaged board={board} hideCompleted={hideCompleted} driven drivenPage={1} />
    );
  }
  // 재생 중 + all 모드: 전체 8명 단일 화면(슬라이드쇼 boardMode=all). 비재생 all도 동일.
  if (mode === "paged") {
    return <BoardPaged board={board} hideCompleted={hideCompleted} />;
  }
  return <BoardAll board={board} hideCompleted={hideCompleted} />;
}

// ---------- 전체(8명) 한 화면: 2행 × 4열 ----------

function BoardAll({
  board,
  hideCompleted,
}: {
  board: ViewBoard;
  hideCompleted: boolean;
}) {
  return (
    <div
      className={cn(
        "min-h-0 flex-1 overflow-hidden",
        scale("px-6 py-5", "px-10 py-7", "px-16 py-10", "px-24 py-14"),
      )}
    >
      <div
        className={cn(
          "grid h-full grid-cols-4 grid-rows-2",
          scale("gap-5", "gap-7", "gap-10", "gap-14"),
        )}
      >
        {board.columns.map((column) => (
          <BoardColumn
            key={column.user.id}
            column={column}
            hideCompleted={hideCompleted}
            compact
          />
        ))}
      </div>
    </div>
  );
}

// ---------- 2명/페이지: 자동순환 + 수동 화살표 ----------

function BoardPaged({
  board,
  hideCompleted,
  driven = false,
  drivenPage = 1,
}: {
  board: ViewBoard;
  hideCompleted: boolean;
  // driven: 슬라이드쇼가 페이지를 URL(bp)로 주도. 자체 15초 순환·수동 화살표를 끈다.
  driven?: boolean;
  // drivenPage: 1-based(범위 clamp). driven일 때만 사용.
  drivenPage?: number;
}) {
  const columns = board.columns;
  const pageCount = Math.max(1, Math.ceil(columns.length / PAGE_SIZE));

  const [page, setPage] = useState(0);
  // pauseKey를 바꾸면 자동순환 타이머가 재시작된다(수동 이동 시 리셋용).
  const [pauseKey, setPauseKey] = useState(0);

  // driven이면 URL의 bp(1-based)를 clamp해 사용, 아니면 로컬 상태(범위 보정).
  const safePage = driven
    ? Math.min(Math.max(drivenPage - 1, 0), pageCount - 1)
    : page < pageCount
      ? page
      : 0;

  // 자동 순환. driven(슬라이드쇼 주도)이거나 pageCount가 1이면 돌지 않는다.
  useEffect(() => {
    if (driven || pageCount <= 1) return;
    const id = setInterval(() => {
      setPage((p) => (p + 1) % pageCount);
    }, AUTO_ADVANCE_MS);
    return () => clearInterval(id);
  }, [driven, pageCount, pauseKey]);

  const go = (delta: number) => {
    setPage((p) => ((p < pageCount ? p : 0) + delta + pageCount) % pageCount);
    setPauseKey((k) => k + 1);
  };

  const start = safePage * PAGE_SIZE;
  const visible = columns.slice(start, start + PAGE_SIZE);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div
        className={cn(
          "min-h-0 flex-1 overflow-hidden",
          scale("px-8 py-6", "px-12 py-8", "px-16 py-12", "px-24 py-16"),
        )}
      >
        <div
          className={cn(
            "grid h-full items-start",
            scale("gap-8", "gap-12", "gap-16", "gap-24"),
          )}
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
        driven ? (
          // 슬라이드쇼 주도 중엔 수동 화살표 대신 현재 위치만 표시(정지는 좌하단 재생/정지 버튼).
          <PageIndicator page={safePage} pageCount={pageCount} />
        ) : (
          <PageControl
            page={safePage}
            pageCount={pageCount}
            onPrev={() => go(-1)}
            onNext={() => go(1)}
          />
        )
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

// ---------- 페이지 표시(슬라이드쇼 주도 시, 비상호작용) ----------

function PageIndicator({ page, pageCount }: { page: number; pageCount: number }) {
  return (
    <div className="flex shrink-0 justify-center py-5">
      <div className="flex items-center gap-2 rounded-full bg-neutral-900 px-5 py-2.5 text-white">
        <span className="text-base font-semibold tabular-nums tracking-wide">
          PAGE {page + 1}/{pageCount}
        </span>
      </div>
    </div>
  );
}

// ---------- 담당자 열 ----------

function BoardColumn({
  column,
  hideCompleted,
  compact = false,
}: {
  column: ViewBoardColumn;
  hideCompleted: boolean;
  compact?: boolean;
}) {
  const { user } = column;
  const cards = hideCompleted
    ? column.cards.filter((c) => c.status !== "done")
    : column.cards;

  return (
    <div className="flex min-h-0 min-w-0 flex-col gap-3">
      <div className="flex shrink-0 items-center gap-3">
        <span
          className={cn(
            "flex shrink-0 items-center justify-center rounded-full font-semibold text-white",
            compact
              ? scale("size-9 text-sm", "size-11 text-base", "size-14 text-xl", "size-16 text-2xl")
              : scale("size-12 text-base", "size-14 text-lg", "size-16 text-2xl", "size-20 text-3xl"),
          )}
          style={{ backgroundColor: user.avatarColor }}
        >
          {avatarInitials(user.name)}
        </span>
        <span
          className={cn(
            "min-w-0 flex-1 truncate font-bold text-neutral-900",
            compact
              ? scale("text-lg", "text-2xl", "text-3xl", "text-4xl")
              : scale("text-2xl", "text-3xl", "text-4xl", "text-5xl"),
          )}
        >
          {user.name}
        </span>
        <span
          className={cn(
            "shrink-0 rounded-full font-semibold tabular-nums",
            compact
              ? scale("px-2.5 py-0.5 text-sm", "px-3 py-1 text-base", "px-4 py-1.5 text-xl", "px-5 py-2 text-2xl")
              : scale("px-3.5 py-1 text-lg", "px-4 py-1.5 text-xl", "px-5 py-2 text-2xl", "px-6 py-2.5 text-3xl"),
          )}
          style={{
            backgroundColor: withAlpha(user.avatarColor, "1f"),
            color: user.avatarColor,
          }}
        >
          {column.doneCount}/{column.totalCount}
        </span>
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-auto">
        {cards.map((card) => (
          <BoardCard key={card.id} card={card} color={user.avatarColor} compact={compact} />
        ))}
      </div>
    </div>
  );
}

function BoardCard({
  card,
  color,
  compact,
}: {
  card: ViewCard;
  color: string;
  compact: boolean;
}) {
  const done = card.status === "done";
  return (
    <div
      className={cn(
        // 제목이 작아진 만큼 세로 패딩 축소 → 한 열에 더 많은 태스크가 보인다.
        "flex shrink-0 items-center gap-3 rounded-2xl",
        compact
          ? scale("px-3.5 py-2", "px-4 py-2.5", "px-5 py-3", "px-7 py-4")
          : scale("px-4 py-2.5", "px-5 py-3", "px-6 py-4", "px-8 py-5"),
      )}
      style={{ backgroundColor: withAlpha(color, "14") }}
    >
      <div className="min-w-0 flex-1">
        {/* 제목: 약 절반 크기 축소 + truncate(줄바꿈 금지, 길면 말줄임). 일이 많아져도 한 줄 유지. */}
        <p
          className={cn(
            "truncate font-bold text-neutral-900",
            compact
              ? scale("text-xs", "text-base", "text-lg", "text-xl")
              : scale("text-base", "text-lg", "text-xl", "text-2xl"),
          )}
        >
          {card.title}
        </p>
        {card.clientLabel ? (
          <p
            className={cn(
              "truncate text-neutral-500",
              compact
                ? scale("text-[10px]", "text-xs", "text-sm", "text-base")
                : scale("text-xs", "text-sm", "text-base", "text-lg"),
            )}
          >
            {card.clientLabel}
          </p>
        ) : null}
      </div>
      {done ? (
        <span
          aria-label="완료"
          className={cn(
            "flex shrink-0 items-center justify-center rounded-full bg-green-600",
            compact
              ? scale("size-7", "size-9", "size-11", "size-13")
              : scale("size-9", "size-11", "size-13", "size-15"),
          )}
        >
          <Check className="size-5 text-white" strokeWidth={3} />
        </span>
      ) : (
        <span
          aria-label="미완료"
          className={cn(
            "shrink-0 rounded-full border-2 border-neutral-300",
            compact
              ? scale("size-7", "size-9", "size-11", "size-13")
              : scale("size-9", "size-11", "size-13", "size-15"),
          )}
        />
      )}
    </div>
  );
}
