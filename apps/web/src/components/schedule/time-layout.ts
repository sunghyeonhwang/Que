import { isSameDay } from "date-fns";
import type { CalendarViewItem } from "@/lib/calendar-data";

/** 그리드 시간 범위 (시). 08:00 시작 ~ 21:00 끝(마지막 라벨). */
export const START_HOUR = 8;
export const END_HOUR = 21;
export const HOURS = Array.from({ length: END_HOUR - START_HOUR }, (_, i) => START_HOUR + i);
/** 한 시간의 픽셀 높이. 태블릿 터치(블록 최소 40px)를 고려한 넉넉한 높이. */
export const HOUR_HEIGHT = 88;
export const GRID_HEIGHT = (END_HOUR - START_HOUR) * HOUR_HEIGHT;

/** Date → 그리드 상단 기준 y(px). 범위를 벗어나면 clamp. */
export function timeToY(date: Date): number {
  const hours = date.getHours() + date.getMinutes() / 60;
  const y = (hours - START_HOUR) * HOUR_HEIGHT;
  return Math.max(0, Math.min(GRID_HEIGHT, y));
}

export interface PositionedItem {
  item: CalendarViewItem;
  top: number;
  height: number;
  /** 0~1, 클러스터 내 좌측 위치 비율 */
  left: number;
  /** 0~1, 클러스터 내 폭 비율 */
  width: number;
}

const MIN_HEIGHT = 40;

/**
 * 하루치 항목을 시간 위치 + 겹침 레인으로 배치한다.
 * 겹치는 항목끼리 클러스터로 묶고, 각 항목을 겹치지 않는 첫 레인에 넣어 나란히 배치한다.
 */
export function layoutDay(items: CalendarViewItem[], day: Date): PositionedItem[] {
  const dayItems = items
    .filter((it) => isSameDay(new Date(it.startAt), day))
    .map((item) => {
      const start = new Date(item.startAt);
      const end = new Date(item.endAt);
      const top = timeToY(start);
      const rawHeight = timeToY(end) - top;
      return { item, start, end, top, height: Math.max(MIN_HEIGHT, rawHeight) };
    })
    .sort((a, b) => a.start.getTime() - b.start.getTime() || b.height - a.height);

  const result: PositionedItem[] = [];
  let cluster: typeof dayItems = [];
  let clusterEnd = -Infinity;

  const flush = () => {
    if (cluster.length === 0) return;
    // 레인 배정: lane 마지막 종료 <= 현재 시작이면 재사용.
    const laneEnds: number[] = [];
    const laneOf = new Map<(typeof cluster)[number], number>();
    for (const c of cluster) {
      let lane = laneEnds.findIndex((e) => e <= c.start.getTime());
      if (lane === -1) {
        lane = laneEnds.length;
        laneEnds.push(0);
      }
      laneEnds[lane] = c.end.getTime();
      laneOf.set(c, lane);
    }
    const lanes = laneEnds.length;
    for (const c of cluster) {
      const lane = laneOf.get(c) ?? 0;
      result.push({
        item: c.item,
        top: c.top,
        height: c.height,
        left: lane / lanes,
        width: 1 / lanes,
      });
    }
    cluster = [];
    clusterEnd = -Infinity;
  };

  for (const c of dayItems) {
    // 시각적 겹침 기준: 실제 렌더 높이(top~top+height)로 판단해 짧은 항목도 나란히.
    const cStart = c.top;
    if (cluster.length > 0 && cStart >= clusterEnd) flush();
    cluster.push(c);
    clusterEnd = Math.max(clusterEnd, c.top + c.height);
  }
  flush();

  return result;
}
