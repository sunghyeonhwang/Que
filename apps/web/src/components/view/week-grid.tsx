import { cn } from "@/lib/utils";
import type {
  ViewWeek,
  ViewWeekDay,
  ViewWeekItem,
  ViewWeekMemberSummary,
} from "@/lib/view-data";
import {
  avatarInitials,
  formatTimeRange,
  minutesOfDayKST,
  scale,
  withAlpha,
} from "./view-format";
import { NowLine } from "./now-line";

// 주간 스케줄. 상단 멤버 완료 요약행 + 월~금(또는 3day) 캘린더(시간 그리드).
// 조회 전용. 이벤트 카드는 시작~종료 시각으로 배치되며 클릭 불가.
// 범위 이동(±7/±3)·Today·범위 토글은 상단 헤더(ViewHeader)로 통일 — 하단 WeekNav 제거.

const GRID_START_MIN = 10 * 60; // 10:00
const GRID_END_MIN = 19 * 60; // 19:00
const GRID_SPAN = GRID_END_MIN - GRID_START_MIN;
const AXIS_HOURS = [10, 12, 14, 16, 18] as const;

export function WeekGrid({ week }: { week: ViewWeek }) {
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <MemberSummaryRow members={week.memberSummary} />
      <WeekCalendar days={week.days} />
    </div>
  );
}

// ---------- 멤버 완료 요약행 ----------

function MemberSummaryRow({ members }: { members: ViewWeekMemberSummary[] }) {
  return (
    <div
      className={cn(
        "grid shrink-0",
        scale("gap-3 px-8 pb-4 pt-5", "gap-4 px-12 pb-5 pt-6", "gap-5 px-16 pb-7 pt-8", "gap-7 px-24 pb-10 pt-10"),
      )}
      style={{ gridTemplateColumns: `repeat(${members.length}, minmax(0, 1fr))` }}
    >
      {members.map((m) => {
        const pct = m.totalCount > 0 ? (m.doneCount / m.totalCount) * 100 : 0;
        return (
          <div
            key={m.user.id}
            className={cn(
              "rounded-xl border border-neutral-200",
              scale("px-3.5 py-3", "px-4 py-3.5", "px-5 py-4", "px-7 py-6"),
            )}
          >
            <div className="flex items-center justify-between gap-2">
              <span
                className={cn(
                  "min-w-0 truncate font-bold text-neutral-900",
                  scale("text-base", "text-lg", "text-2xl", "text-3xl"),
                )}
              >
                {m.user.name}
              </span>
              <span
                className={cn(
                  "shrink-0 rounded-full",
                  scale("size-2.5", "size-3", "size-4", "size-5"),
                )}
                style={{ backgroundColor: m.user.avatarColor }}
              />
            </div>
            <p
              className={cn(
                "mt-1 text-neutral-500 tabular-nums",
                scale("text-sm", "text-base", "text-lg", "text-xl"),
              )}
            >
              {m.doneCount}/{m.totalCount} Completed
            </p>
            <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-neutral-200 min-[2994px]:h-2.5">
              <div
                className="h-full rounded-full"
                style={{ width: `${pct}%`, backgroundColor: m.user.avatarColor }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ---------- 주간 캘린더 ----------

function WeekCalendar({ days }: { days: ViewWeekDay[] }) {
  const template = `var(--axis-w) repeat(${days.length}, minmax(0, 1fr))`;

  return (
    <div
      className={cn(
        "flex min-h-0 flex-1 flex-col",
        "[--axis-w:64px] min-[2420px]:[--axis-w:88px] min-[2994px]:[--axis-w:112px] min-[3540px]:[--axis-w:140px]",
        scale("px-8", "px-12", "px-16", "px-24"),
      )}
    >
      {/* 요일 헤더 + 클라이언트 라벨 바 */}
      <div
        className={cn("grid shrink-0", scale("gap-3", "gap-4", "gap-5", "gap-6"))}
        style={{ gridTemplateColumns: template }}
      >
        <div />
        {days.map((day) => (
          <div key={day.dateISO} className="min-w-0">
            <p
              className={cn(
                "text-center font-bold text-neutral-900",
                scale("text-lg", "text-xl", "text-3xl", "text-4xl"),
              )}
            >
              {day.weekdayLabel}요일 {day.dayNum}
            </p>
            <div
              className={cn(
                "mt-1.5 truncate rounded-md bg-green-50 text-center font-medium text-green-700",
                scale("px-2 py-1 text-xs", "px-2.5 py-1 text-sm", "px-3 py-1.5 text-lg", "px-4 py-2 text-xl"),
              )}
            >
              {day.clientLabels.length > 0 ? day.clientLabels.join(" · ") : " "}
            </div>
          </div>
        ))}
      </div>

      {/* 시간 그리드 본문 */}
      <div
        className={cn(
          "relative grid min-h-0 flex-1 overflow-auto pb-4 pt-2",
          scale("gap-3", "gap-4", "gap-5", "gap-6"),
        )}
        style={{ gridTemplateColumns: template }}
      >
        <TimeAxis />
        {days.map((day) => (
          <DayColumn key={day.dateISO} day={day} />
        ))}
        <NowLine startMin={GRID_START_MIN} endMin={GRID_END_MIN} />
      </div>
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

// 하루치 이벤트를 좌우 레인으로 배치한다. 같은 시간대에 겹치는 이벤트가 서로 위에
// 절대배치돼 글자가 뭉개지던 문제를 막는다(그리드는 유지, 겹침만 분할).
// 그리디: 시작시각 순으로 이미 끝난 레인을 재사용하고, 연쇄로 겹치는 묶음(클러스터)이
// 레인 수를 공유해 그 안의 카드는 같은 폭(1/열수)으로 나란히 놓인다.
// 벽 디스플레이 가독성을 위해 한 클러스터의 레인이 MAX_LANES를 넘으면, 마지막 열은
// "+N" 칩으로 초과분을 합쳐 카드가 지나치게 좁아지는 것을 막는다(N=숨긴 이벤트 정확 개수).
const MAX_LANES = 3;

interface CardEntry {
  kind: "card";
  item: ViewWeekItem;
  startMin: number;
  endMin: number;
  lane: number;
  columns: number;
}

interface OverflowEntry {
  kind: "overflow";
  key: string;
  startMin: number;
  endMin: number;
  column: number;
  columns: number;
  count: number;
}

type LayoutEntry = CardEntry | OverflowEntry;

function itemMinutes(item: ViewWeekItem): { startMin: number; endMin: number } {
  const startMin = clamp(minutesOfDayKST(item.startAt), GRID_START_MIN, GRID_END_MIN);
  const rawEnd = minutesOfDayKST(item.endAt);
  const endMin = clamp(rawEnd > startMin ? rawEnd : startMin + 30, GRID_START_MIN, GRID_END_MIN);
  return { startMin, endMin };
}

function layoutDayItems(items: readonly ViewWeekItem[]): LayoutEntry[] {
  const evs = items
    .map((item) => ({ item, ...itemMinutes(item), lane: 0 }))
    .sort((a, b) => a.startMin - b.startMin || a.endMin - b.endMin);

  const out: LayoutEntry[] = [];
  let cluster: typeof evs = [];
  let clusterEnd = -1;

  const flush = () => {
    if (cluster.length === 0) return;
    const laneEnds: number[] = []; // 각 레인의 마지막 이벤트 종료분
    for (const ev of cluster) {
      let lane = laneEnds.findIndex((end) => end <= ev.startMin);
      if (lane === -1) {
        lane = laneEnds.length;
        laneEnds.push(ev.endMin);
      } else {
        laneEnds[lane] = ev.endMin;
      }
      ev.lane = lane;
    }
    const lanes = laneEnds.length;
    const hasOverflow = lanes > MAX_LANES;
    // 초과 시 열 수를 MAX_LANES로 고정하고, 마지막 열([columns-1])은 "+N" 칩용으로 비운다
    // → 카드로 보이는 레인은 [0, columns-1). 초과가 없으면 레인 수 = 열 수(모두 카드).
    const columns = hasOverflow ? MAX_LANES : lanes;
    const cardLaneLimit = hasOverflow ? columns - 1 : columns;

    const hidden: typeof cluster = [];
    for (const ev of cluster) {
      if (ev.lane < cardLaneLimit) {
        out.push({
          kind: "card",
          item: ev.item,
          startMin: ev.startMin,
          endMin: ev.endMin,
          lane: ev.lane,
          columns,
        });
      } else {
        hidden.push(ev);
      }
    }
    if (hidden.length > 0) {
      out.push({
        kind: "overflow",
        key: `overflow-${hidden[0].item.id}`,
        startMin: Math.min(...hidden.map((h) => h.startMin)),
        endMin: Math.max(...hidden.map((h) => h.endMin)),
        column: columns - 1,
        columns,
        count: hidden.length,
      });
    }

    cluster = [];
    clusterEnd = -1;
  };

  for (const ev of evs) {
    if (cluster.length > 0 && ev.startMin >= clusterEnd) flush();
    cluster.push(ev);
    clusterEnd = Math.max(clusterEnd, ev.endMin);
  }
  flush();
  return out;
}

function DayColumn({ day }: { day: ViewWeekDay }) {
  const entries = layoutDayItems(day.items);
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
      {entries.map((entry) =>
        entry.kind === "card" ? (
          <EventCard key={entry.item.id} entry={entry} />
        ) : (
          <OverflowChip key={entry.key} entry={entry} />
        ),
      )}
    </div>
  );
}

function EventCard({ entry }: { entry: CardEntry }) {
  const { item, startMin, endMin, lane, columns } = entry;

  const topPct = ((startMin - GRID_START_MIN) / GRID_SPAN) * 100;
  const heightPct = ((endMin - startMin) / GRID_SPAN) * 100;
  // 좌우 레인 분할: 표시 열 수로 폭을 나누고 3px씩 간격을 준다(단일 열이면 전폭).
  const widthPct = 100 / columns;
  const leftPct = lane * widthPct;

  return (
    <div
      className={cn(
        "absolute flex flex-col overflow-hidden rounded-lg",
        scale("p-2", "p-2.5", "p-3.5", "p-5"),
      )}
      style={{
        top: `${topPct}%`,
        height: `${heightPct}%`,
        left: `calc(${leftPct}% + 3px)`,
        width: `calc(${widthPct}% - 6px)`,
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

// 초과 이벤트 합침 칩. 한 시간대에 MAX_LANES를 넘는 겹침이 있으면 마지막 열에 놓여
// 숨긴 이벤트 개수를 "+N"으로 알린다(조회 전용이라 개수 표시로 충분). 숨긴 이벤트들의
// 세로 범위(min 시작 ~ max 종료)를 덮는다.
function OverflowChip({ entry }: { entry: OverflowEntry }) {
  const { startMin, endMin, column, columns, count } = entry;

  const topPct = ((startMin - GRID_START_MIN) / GRID_SPAN) * 100;
  const heightPct = ((endMin - startMin) / GRID_SPAN) * 100;
  const widthPct = 100 / columns;
  const leftPct = column * widthPct;

  return (
    <div
      className={cn(
        "absolute flex items-center justify-center rounded-lg border border-dashed border-neutral-300 bg-neutral-100/70 font-semibold text-neutral-500",
        scale("text-sm", "text-base", "text-xl", "text-2xl"),
      )}
      style={{
        top: `${topPct}%`,
        height: `${heightPct}%`,
        left: `calc(${leftPct}% + 3px)`,
        width: `calc(${widthPct}% - 6px)`,
        minHeight: 52,
      }}
      title={`이 시간대에 ${count}건 더 있음`}
    >
      +{count}
    </div>
  );
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.min(Math.max(v, lo), hi);
}
