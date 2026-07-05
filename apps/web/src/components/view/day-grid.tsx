import { cn } from "@/lib/utils";
import type { ViewDay, ViewDayColumn, ViewWeekItem } from "@/lib/view-data";
import {
  avatarInitials,
  formatTimeRange,
  minutesOfDayKST,
  scale,
  withAlpha,
} from "./view-format";
import { NowLine } from "./now-line";

// 1Day 스케줄: 하루를 팀원(전원)을 열로 놓고 각 사람의 그날 timed items(task+event)를 보여준다.
// 날짜 열이 아니라 사람 열이라는 점이 WeekGrid와 다르다.
// - WeekGrid 준거: 좌측 시간축 1개 공유 + 10~19시 클리핑 + 담당자색 틴트 카드 + NowLine.
// - private 이벤트는 backend가 title="자리비움"으로만 노출(여기선 그대로 표시).
// - 겹치는 아이템은 full-width 스택(시각 위치로 절대배치, 열 폭 전체 사용).
// - 8명이 1920에 들어가되 좁으면 컴팩트. 더 좁으면 그리드 본문이 가로 스크롤(페이지 세로스크롤 금지).
// - 날짜이동(±1)은 상단 헤더(ViewHeader)로 통일 — 여기엔 하단 nav 없음.

const GRID_START_MIN = 10 * 60; // 10:00
const GRID_END_MIN = 19 * 60; // 19:00
const GRID_SPAN = GRID_END_MIN - GRID_START_MIN;
const AXIS_HOURS = [10, 12, 14, 16, 18] as const;

export function DayGrid({ day }: { day: ViewDay }) {
  const cols = day.columns;
  // 좌측 시간축(64px) + 사람 열. 좁아지면 최소폭에서 가로 스크롤되게 minmax 하한을 둔다.
  const template = `var(--axis-w) repeat(${cols.length}, minmax(var(--col-min), 1fr))`;

  return (
    <div
      className={cn(
        "flex min-h-0 flex-1 flex-col",
        // 축 폭·열 최소폭을 해상도별로 비례 확대(대형 디스플레이).
        "[--axis-w:64px] [--col-min:150px]",
        "min-[2420px]:[--axis-w:88px] min-[2420px]:[--col-min:200px]",
        "min-[2994px]:[--axis-w:112px] min-[2994px]:[--col-min:260px]",
        "min-[3540px]:[--axis-w:140px] min-[3540px]:[--col-min:320px]",
        scale("px-8", "px-12", "px-16", "px-24"),
      )}
    >
      {/* 사람 헤더 행(아바타 + 이름 + 그날 항목 수) */}
      <div
        className={cn("grid shrink-0 pt-4", scale("gap-3", "gap-4", "gap-5", "gap-6"))}
        style={{ gridTemplateColumns: template }}
      >
        <div />
        {cols.map((col) => (
          <PersonHeader key={col.user.id} column={col} />
        ))}
      </div>

      {/* 시간 그리드 본문 — 세로 스크롤(그리드) + 좁으면 가로 스크롤. */}
      <div
        className={cn(
          "relative grid min-h-0 flex-1 overflow-auto pb-4 pt-2",
          scale("gap-3", "gap-4", "gap-5", "gap-6"),
        )}
        style={{ gridTemplateColumns: template }}
      >
        <TimeAxis />
        {cols.map((col) => (
          <PersonColumn key={col.user.id} column={col} />
        ))}
        <NowLine startMin={GRID_START_MIN} endMin={GRID_END_MIN} />
      </div>
    </div>
  );
}

function PersonHeader({ column }: { column: ViewDayColumn }) {
  const { user } = column;
  return (
    <div className="flex min-w-0 items-center gap-2">
      <span
        className={cn(
          "flex shrink-0 items-center justify-center rounded-full font-semibold text-white",
          scale("size-8 text-xs", "size-10 text-sm", "size-12 text-lg", "size-14 text-xl"),
        )}
        style={{ backgroundColor: user.avatarColor }}
      >
        {avatarInitials(user.name)}
      </span>
      <span
        className={cn(
          "min-w-0 flex-1 truncate font-bold text-neutral-900",
          scale("text-base", "text-lg", "text-2xl", "text-3xl"),
        )}
      >
        {user.name}
      </span>
      <span
        className={cn(
          "shrink-0 rounded-full font-semibold tabular-nums",
          scale("px-2 py-0.5 text-xs", "px-2.5 py-0.5 text-sm", "px-3 py-1 text-lg", "px-4 py-1.5 text-xl"),
        )}
        style={{
          backgroundColor: withAlpha(user.avatarColor, "1f"),
          color: user.avatarColor,
        }}
      >
        {column.items.length}
      </span>
    </div>
  );
}

function TimeAxis() {
  return (
    <div className="relative min-h-[420px]">
      {AXIS_HOURS.map((h) => {
        const topPct = ((h * 60 - GRID_START_MIN) / GRID_SPAN) * 100;
        const hour12 = h % 12 === 0 ? 12 : h % 12;
        const label = h < 12 ? `${hour12} AM` : `${hour12} PM`;
        return (
          <span
            key={h}
            className={cn(
              "absolute right-2 text-neutral-400",
              scale("text-xs", "text-sm", "text-lg", "text-xl"),
            )}
            style={{ top: `${topPct}%`, transform: "translateY(-50%)" }}
          >
            {label}
          </span>
        );
      })}
    </div>
  );
}

function PersonColumn({ column }: { column: ViewDayColumn }) {
  return (
    <div className="relative min-h-[420px] min-w-0 rounded-xl border border-neutral-200 bg-neutral-50/60">
      {/* 시간 구분선 */}
      {AXIS_HOURS.map((h) => {
        const topPct = ((h * 60 - GRID_START_MIN) / GRID_SPAN) * 100;
        return (
          <div
            key={h}
            className="pointer-events-none absolute inset-x-0 border-t border-neutral-200/70"
            style={{ top: `${topPct}%` }}
          />
        );
      })}
      {column.items.map((item) => (
        <EventCard key={item.id} item={item} />
      ))}
    </div>
  );
}

function EventCard({ item }: { item: ViewWeekItem }) {
  const startMin = clamp(minutesOfDayKST(item.startAt), GRID_START_MIN, GRID_END_MIN);
  const rawEnd = minutesOfDayKST(item.endAt);
  const endMin = clamp(
    rawEnd > startMin ? rawEnd : startMin + 30,
    GRID_START_MIN,
    GRID_END_MIN,
  );

  const topPct = ((startMin - GRID_START_MIN) / GRID_SPAN) * 100;
  const heightPct = ((endMin - startMin) / GRID_SPAN) * 100;

  return (
    <div
      className={cn(
        "absolute inset-x-1.5 flex flex-col overflow-hidden rounded-lg",
        scale("p-2", "p-2.5", "p-3.5", "p-5"),
      )}
      style={{
        top: `${topPct}%`,
        height: `${heightPct}%`,
        minHeight: 52,
        backgroundColor: withAlpha(item.ownerColor, "1f"),
      }}
    >
      <p
        className={cn("truncate font-bold", scale("text-sm", "text-base", "text-xl", "text-2xl"))}
        style={{ color: item.ownerColor }}
      >
        {item.title}
      </p>
      <p
        className={cn(
          "truncate text-neutral-500",
          scale("text-xs", "text-sm", "text-lg", "text-xl"),
        )}
      >
        {formatTimeRange(item.startAt, item.endAt)}
      </p>
      <span
        className={cn(
          "absolute bottom-1.5 right-1.5 flex items-center justify-center rounded-full font-semibold text-white",
          scale("size-6 text-[10px]", "size-8 text-xs", "size-10 text-sm", "size-12 text-base"),
        )}
        style={{ backgroundColor: item.ownerColor }}
        title={item.ownerName}
      >
        {avatarInitials(item.ownerName)}
      </span>
    </div>
  );
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.min(Math.max(v, lo), hi);
}
