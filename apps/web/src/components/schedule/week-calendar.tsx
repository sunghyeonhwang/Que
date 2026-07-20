"use client";

import {
  useEffect,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { format, isSameDay, isToday } from "date-fns";
import { Lock } from "lucide-react";
import type { CalendarMilestone, CalendarViewItem } from "@/lib/calendar-data";
import { updateTaskScheduleAction } from "@/app/(app)/today/actions";
import { updateEventScheduleAction } from "@/app/(app)/calendar/actions";
import { useOptimisticAction } from "@/components/app/use-optimistic-action";
import { cn } from "@/lib/utils";
import { eventSwatch } from "./event-color";
import { EventDetailPopover } from "./event-detail-popover";
import { MilestoneChip } from "./milestone-chip";
import {
  GRID_HEIGHT,
  HOURS,
  HOUR_HEIGHT,
  START_HOUR,
  END_HOUR,
  layoutDay,
  timeToY,
  type PositionedItem,
} from "./time-layout";

/** 표시 타임존 라벨(디자인 GMT 표기 자리). 한국 팀 기준 고정 표기. */
const TZ_LABEL = "GMT+9";

/** 클릭(상세 팝오버)과 드래그(시간 이동)를 가르는 px 임계값 — 간트 DraggableMilestone과 동일. */
const DRAG_THRESHOLD = 5;
/** 30분 스냅 픽셀(HOUR_HEIGHT의 절반). 세로 드래그는 이 단위로 스냅한다. */
const SNAP_PX = HOUR_HEIGHT / 2;

/** 이동 대상 식별 키 — task/event id 공간이 겹칠 여지를 kind로 방어. */
function keyOf(item: Pick<CalendarViewItem, "kind" | "id">): string {
  return `${item.kind}-${item.id}`;
}

/** 드래그로 이동 가능한 항목인가 — 서버 판정(canEdit)만 신뢰 + task·event만(마일스톤은 items 밖). */
function isDraggable(item: CalendarViewItem): boolean {
  return item.canEdit === true && (item.kind === "task" || item.kind === "event");
}

/** 드래그 진행 상태(WeekCalendar 레벨). preview는 스냅된 새 위치(드롭 시 커밋 대상).
 *  mode="move"=블록 본문 드래그(시간·요일 이동), mode="resize"=하단 핸들 드래그(끝시각만 연장/단축). */
interface DragState {
  key: string;
  kind: "task" | "event";
  id: string;
  mode: "move" | "resize";
  origStart: number;
  origEnd: number;
  dayIndex: number;
  startX: number;
  startY: number;
  colWidth: number;
  active: boolean;
  previewStart: number;
  previewEnd: number;
  dayOffset: number;
  dyPx: number;
}

/** 시간 시프트 오버라이드(id별 새 시각). 낙관 반영 + 겹침 레이아웃 재계산에 쓰인다. */
type Overrides = Record<string, { startAt: string; endAt: string }>;

/** DayColumn·EventBlock에 내려주는 드래그 배선. */
interface BlockDnd {
  drag: DragState | null;
  onPointerDown: (e: ReactPointerEvent, item: CalendarViewItem) => void;
  onResizePointerDown: (e: ReactPointerEvent, item: CalendarViewItem) => void;
  onPointerMove: (e: ReactPointerEvent) => void;
  onPointerUp: (e: ReactPointerEvent) => void;
  onPointerCancel: () => void;
  onClickCapture: (e: ReactMouseEvent) => void;
}

/** "9:00 - 10:30 AM" / "11:10 AM - 1:00 PM" — AM/PM이 같으면 끝에 한 번만. */
function timeRangeLabel(startAt: string, endAt: string): string {
  const start = new Date(startAt);
  const end = new Date(endAt);
  const sap = format(start, "a");
  const eap = format(end, "a");
  return sap === eap
    ? `${format(start, "h:mm")} - ${format(end, "h:mm")} ${eap}`
    : `${format(start, "h:mm a")} - ${format(end, "h:mm a")}`;
}

/** 시간축 캘린더. days가 1개면 일간, 7개면 주간. 읽기 전용. */
export function WeekCalendar({
  days,
  items,
  milestones = [],
}: {
  days: Date[];
  items: CalendarViewItem[];
  milestones?: CalendarMilestone[];
}) {
  const [now, setNow] = useState<Date | null>(null);

  // ── 블록 드래그로 시간 이동 ────────────────────────────────────────────────
  // 오버라이드는 WeekCalendar 레벨 state. 커밋되면 items에 얹어 layoutDay에 넘겨
  // 시간뿐 아니라 겹침 레이아웃도 다시 계산되게 한다(순수 함수라 오버라이드된 items만 주면 됨).
  // 드래그 "진행 중" 블록은 재배치하지 않고 transform 미리보기만(어지러움 방지) — 드롭 후 오버라이드로 재배치.
  const [overrides, setOverrides] = useState<Overrides>({});
  const [drag, setDrag] = useState<DragState | null>(null);
  // 드래그 확정 직후 뒤따르는 click을 삼켜 EventDetailPopover가 열리지 않게 하는 플래그(ref라 리렌더 무관).
  const justDraggedRef = useRef(false);
  // 요일 컬럼 컨테이너 — 드래그 시작 시 rect에서 컬럼 폭을 계산한다.
  const columnsRef = useRef<HTMLDivElement>(null);
  const { run } = useOptimisticAction();

  useEffect(() => {
    // 최초 값은 rAF로 지연 세팅해 하이드레이션 불일치를 피한다(효과 본문 동기 setState 회피).
    const raf = requestAnimationFrame(() => setNow(new Date()));
    const timer = setInterval(() => setNow(new Date()), 60_000);
    return () => {
      cancelAnimationFrame(raf);
      clearInterval(timer);
    };
  }, []);

  const showNow =
    now != null &&
    now.getHours() + now.getMinutes() / 60 >= START_HOUR &&
    now.getHours() < END_HOUR &&
    days.some((d) => isSameDay(d, now));
  const nowY = now ? timeToY(now) : 0;
  const colTemplate = `4rem repeat(${days.length}, minmax(0, 1fr))`;
  // 마일스톤 밴드는 표시 기간에 마감 마일스톤이 하나라도 있을 때만 렌더(빈 밴드로 공간 낭비 금지).
  const hasMilestones = days.some((d) => milestones.some((m) => isSameDay(new Date(m.dueAt), d)));
  // 가로 스크롤 임계폭을 컬럼 수에 비례시킨다(시간축 4rem + 컬럼당 6.2rem).
  // 7일=약 760px로 기존 주간 레이아웃 유지, 3일/1일은 과하게 넓어지지 않음.
  const minWidth = `calc(4rem + ${days.length} * 6.2rem)`;

  // 오버라이드가 얹힌 표시용 items — layoutDay가 시각·겹침을 다시 계산한다.
  const effectiveItems =
    Object.keys(overrides).length === 0
      ? items
      : items.map((it) => {
          const ov = overrides[keyOf(it)];
          return ov ? { ...it, startAt: ov.startAt, endAt: ov.endAt } : it;
        });

  // 포인터 위치 → 스냅된 새 시각. 미리보기·커밋이 같은 값을 쓰도록 한 곳에서 계산.
  const computePreview = (s: DragState, clientX: number, clientY: number) => {
    const gridStart = START_HOUR * 60;
    const gridEnd = END_HOUR * 60;
    const start = new Date(s.origStart);

    // ── 리사이즈: startAt 고정, endAt만 30분 스냅으로 연장/단축. 최소 30분·끝은 21:00 clamp. ──
    if (s.mode === "resize") {
      const stepY = Math.round((clientY - s.startY) / SNAP_PX);
      const minutesDelta = stepY * 30;
      const end = new Date(s.origEnd);
      const startMin = start.getHours() * 60 + start.getMinutes();
      const endMin = end.getHours() * 60 + end.getMinutes();
      const newEndMin = Math.max(startMin + 30, Math.min(endMin + minutesDelta, gridEnd));
      const newEnd = new Date(s.origEnd);
      newEnd.setTime(newEnd.getTime() + (newEndMin - endMin) * 60_000);
      return {
        previewStart: s.origStart,
        previewEnd: newEnd.getTime(),
        dayOffset: 0,
        dyPx: 0,
      };
    }

    // ── 이동: 세로 30분 스냅(기간 보존, 그리드 08:00~21:00 clamp) + 가로 컬럼 스냅. ──
    const stepY = Math.round((clientY - s.startY) / SNAP_PX);
    const minutesDelta = stepY * 30;
    const durMin = (s.origEnd - s.origStart) / 60_000;
    const startMin = start.getHours() * 60 + start.getMinutes();
    const newStartMin = Math.max(gridStart, Math.min(startMin + minutesDelta, gridEnd - durMin));
    const clampedDelta = newStartMin - startMin;

    // 가로: 컬럼 폭 단위 스냅(days 2개 이상일 때만). 비연속 요일(주말 숨김)도 days 배열 인덱스로 정확히 매핑.
    let dayOffset = 0;
    if (days.length > 1 && s.colWidth > 0) {
      const stepX = Math.round((clientX - s.startX) / s.colWidth);
      const target = Math.min(Math.max(s.dayIndex + stepX, 0), days.length - 1);
      dayOffset = target - s.dayIndex;
    }
    const targetDay = days[s.dayIndex + dayOffset];
    const newStart = new Date(s.origStart);
    newStart.setFullYear(targetDay.getFullYear(), targetDay.getMonth(), targetDay.getDate());
    newStart.setTime(newStart.getTime() + clampedDelta * 60_000);
    const newEnd = new Date(newStart.getTime() + (s.origEnd - s.origStart));
    const dyPx = (clampedDelta / 60) * HOUR_HEIGHT;
    return {
      previewStart: newStart.getTime(),
      previewEnd: newEnd.getTime(),
      dayOffset,
      dyPx,
    };
  };

  const startDrag = (e: ReactPointerEvent, item: CalendarViewItem, mode: "move" | "resize") => {
    if (!isDraggable(item)) return;
    // 터치는 이번 범위에서 드래그 제외(데스크톱·태블릿 펜/마우스 우선). 손가락 세로 스크롤을 죽이지 않기
    // 위해 touchAction도 건드리지 않는다 — pointerType "touch"면 여기서 빠져 기존 클릭/스크롤이 그대로 동작.
    if (e.pointerType === "touch") return;
    const rect = columnsRef.current?.getBoundingClientRect();
    const colWidth = rect ? rect.width / days.length : 0;
    const start = new Date(item.startAt);
    const dayIndex = days.findIndex((d) => isSameDay(d, start));
    if (dayIndex < 0) return;
    justDraggedRef.current = false;
    // 캡처는 pointerdown 즉시 잡는다 — 임계값 이후로 미루면 커서가 원소를 벗어난 뒤엔
    // pointermove가 원소에 오지 않아 캡처 기회 자체가 없다. 특히 10여 px짜리 리사이즈
    // 핸들은 아래로 끄는 순간 이탈해 "잡아도 안 끌리는" 증상이 됐다(2026-07-21 사용자 리포트).
    // 캡처해도 클릭 합성은 그대로라 임계값 미만 클릭(팝오버)은 영향 없다.
    try {
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    } catch {
      /* 캡처 미지원 무시 */
    }
    setDrag({
      key: keyOf(item),
      kind: item.kind as "task" | "event",
      id: item.id,
      mode,
      origStart: start.getTime(),
      origEnd: new Date(item.endAt).getTime(),
      dayIndex,
      startX: e.clientX,
      startY: e.clientY,
      colWidth,
      active: false,
      previewStart: start.getTime(),
      previewEnd: new Date(item.endAt).getTime(),
      dayOffset: 0,
      dyPx: 0,
    });
  };

  const onBlockPointerDown = (e: ReactPointerEvent, item: CalendarViewItem) =>
    startDrag(e, item, "move");
  const onResizePointerDown = (e: ReactPointerEvent, item: CalendarViewItem) => {
    // 리사이즈 핸들은 블록 본문 위에 겹쳐 있어, 본문의 이동 드래그가 같이 시작되지 않게 전파를 끊는다.
    e.stopPropagation();
    startDrag(e, item, "resize");
  };

  // updater 안에서 부수효과(다른 setState/startTransition)를 부르지 않는다 — 핸들러 본문에서
  // 현재 상태(drag)를 읽어 처리한다("Cannot call startTransition while rendering" 회피, 간트 선례).
  const onBlockPointerMove = (e: ReactPointerEvent) => {
    const s = drag;
    if (!s) return;
    if (
      !s.active &&
      Math.abs(e.clientX - s.startX) < DRAG_THRESHOLD &&
      Math.abs(e.clientY - s.startY) < DRAG_THRESHOLD
    ) {
      return; // 임계값 미만 — 아직 클릭일 수 있어 팝오버 트리거를 살려둔다(캡처는 down에서 이미 잡음).
    }
    const p = computePreview(s, e.clientX, e.clientY);
    setDrag({ ...s, active: true, ...p });
  };

  const onBlockPointerUp = (e: ReactPointerEvent) => {
    const s = drag;
    if (s?.active) {
      try {
        (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
      } catch {
        /* noop */
      }
      justDraggedRef.current = true; // 뒤따르는 click을 삼켜 팝오버가 열리지 않게 한다.
      if (s.previewStart !== s.origStart || s.previewEnd !== s.origEnd) {
        commitMove(s);
      }
    }
    setDrag(null);
  };

  // 포인터가 시스템에 의해 취소되면(스크롤 제스처 전환 등) 커밋 없이 드래그만 중단한다.
  const onBlockPointerCancel = () => {
    setDrag(null);
  };

  // 드래그 확정 시 합성되는 click을 캡처 단계에서 차단 — Popover 트리거로 이벤트가 새지 않게.
  const onBlockClickCapture = (e: ReactMouseEvent) => {
    if (justDraggedRef.current) {
      e.preventDefault();
      e.stopPropagation();
      justDraggedRef.current = false;
    }
  };

  const commitMove = (s: DragState) => {
    const startAt = new Date(s.previewStart).toISOString();
    const endAt = new Date(s.previewEnd).toISOString();
    const prev = overrides[s.key];
    const action =
      s.kind === "task"
        ? () => updateTaskScheduleAction({ taskId: s.id, startAt, endAt })
        : () => updateEventScheduleAction({ eventId: s.id, startAt, endAt });
    run(action, {
      apply: () => setOverrides((o) => ({ ...o, [s.key]: { startAt, endAt } })),
      rollback: () =>
        setOverrides((o) => {
          const copy = { ...o };
          if (prev === undefined) delete copy[s.key];
          else copy[s.key] = prev;
          return copy;
        }),
      success: s.mode === "resize" ? "기간을 조정했습니다." : "시간을 옮겼습니다.",
      source: "schedule-drag",
    });
  };

  const dnd: BlockDnd = {
    drag,
    onPointerDown: onBlockPointerDown,
    onResizePointerDown,
    onPointerMove: onBlockPointerMove,
    onPointerUp: onBlockPointerUp,
    onPointerCancel: onBlockPointerCancel,
    onClickCapture: onBlockClickCapture,
  };

  return (
    <div className="overflow-hidden rounded-xl border border-[var(--que-border)] bg-[var(--que-bg)]">
      <div className="max-h-[calc(100dvh-15rem)] overflow-auto">
        <div style={{ minWidth }}>
          {/* 요일 헤더 + 마일스톤 밴드 (sticky top) */}
          <div className="sticky top-0 z-30 border-b border-[var(--que-border)] bg-[var(--que-bg)]">
            <div className="grid" style={{ gridTemplateColumns: colTemplate }}>
              <div className="sticky left-0 z-10 flex items-center justify-center border-r border-[var(--que-border)] bg-[var(--que-bg)] px-2 py-3 text-[11px] font-medium text-[var(--que-text-tertiary)]">
                {TZ_LABEL}
              </div>
              {days.map((day) => {
                const today = isToday(day);
                return (
                  <div
                    key={day.toISOString()}
                    className={cn(
                      "border-l border-[var(--que-border)] px-2 py-3 text-center",
                      today && "bg-[var(--que-brand-subtle)]",
                    )}
                  >
                    <div
                      className={cn(
                        "text-[11px] font-semibold uppercase tracking-wide",
                        today ? "text-[var(--que-brand)]" : "text-[var(--que-text-tertiary)]",
                      )}
                    >
                      {format(day, "EEE")}
                    </div>
                    <div
                      className={cn(
                        "text-lg font-semibold leading-tight",
                        today ? "text-[var(--que-brand)]" : "text-[var(--que-text)]",
                      )}
                    >
                      {format(day, "d")}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* 마일스톤 종일 밴드 — 해당 요일 마감 마일스톤을 읽기 전용 마커로. 없으면 밴드 자체를 숨김. */}
            {hasMilestones && (
              <div
                className="grid border-t border-[var(--que-border)]"
                style={{ gridTemplateColumns: colTemplate }}
              >
                <div className="sticky left-0 z-10 flex items-center justify-center border-r border-[var(--que-border)] bg-[var(--que-bg)] px-1 py-1 text-[10px] font-medium text-[var(--que-text-tertiary)]">
                  마일스톤
                </div>
                {days.map((day) => {
                  const today = isToday(day);
                  const dayMilestones = milestones.filter((m) => isSameDay(new Date(m.dueAt), day));
                  return (
                    <div
                      key={day.toISOString()}
                      className={cn(
                        "flex min-w-0 flex-col gap-1 border-l border-[var(--que-border)] px-1 py-1",
                        today && "bg-[var(--que-brand-subtle)]",
                      )}
                    >
                      {dayMilestones.map((m) => (
                        <MilestoneChip key={`milestone-${m.id}`} milestone={m} />
                      ))}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* 본문: 시간축 + 요일 컬럼 */}
          <div className="flex">
            {/* 시간축 (sticky left) */}
            <div
              className="sticky left-0 z-20 w-16 shrink-0 border-r border-[var(--que-border)] bg-[var(--que-bg)]"
              style={{ height: GRID_HEIGHT }}
            >
              <div className="relative h-full">
                {HOURS.map((hour) => (
                  <div
                    key={hour}
                    className="absolute right-2 -translate-y-1/2 text-[11px] tabular-nums text-[var(--que-text-tertiary)]"
                    style={{ top: (hour - START_HOUR) * HOUR_HEIGHT }}
                  >
                    {format(new Date(2000, 0, 1, hour), "h a")}
                  </div>
                ))}
                {showNow && (
                  <div
                    className="absolute right-1 z-10 -translate-y-1/2 rounded bg-[var(--que-brand)] px-1 py-0.5 text-[10px] font-semibold tabular-nums text-[var(--que-on-brand)]"
                    style={{ top: nowY }}
                  >
                    {format(now!, "hh:mm a")}
                  </div>
                )}
              </div>
            </div>

            {/* 요일 컬럼 영역 */}
            <div ref={columnsRef} className="relative flex flex-1" style={{ height: GRID_HEIGHT }}>
              {days.map((day) => (
                <DayColumn key={day.toISOString()} day={day} items={effectiveItems} dnd={dnd} />
              ))}
              {showNow && (
                <div
                  className="pointer-events-none absolute inset-x-0 z-20 flex items-center"
                  style={{ top: nowY }}
                  aria-hidden
                >
                  <span className="size-2 shrink-0 -translate-x-1/2 rounded-full bg-[var(--que-brand)]" />
                  <span className="h-px flex-1 bg-[var(--que-brand)]" />
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function DayColumn({ day, items, dnd }: { day: Date; items: CalendarViewItem[]; dnd: BlockDnd }) {
  const positioned = layoutDay(items, day);
  const today = isToday(day);
  return (
    <div
      className={cn(
        "relative flex-1 border-l border-[var(--que-border)]",
        today && "bg-[var(--que-brand-subtle)]/40",
      )}
    >
      {/* 시간 격자선 */}
      {HOURS.map((hour) => (
        <div
          key={hour}
          className="absolute inset-x-0 border-t border-[var(--que-border)]/70"
          style={{ top: (hour - START_HOUR) * HOUR_HEIGHT, height: HOUR_HEIGHT }}
        />
      ))}
      {/* 이벤트 블록 */}
      {positioned.map((p) => (
        <EventBlock key={`${p.item.kind}-${p.item.id}`} pos={p} dnd={dnd} />
      ))}
    </div>
  );
}

function EventBlock({ pos, dnd }: { pos: PositionedItem; dnd: BlockDnd }) {
  const { item } = pos;
  const swatch = eventSwatch(item);
  const compact = pos.height < 64;

  const draggable = isDraggable(item);
  // 이 블록이 지금 끌리는 중인가 — 그렇다면 미리보기 시각·transform으로만 그린다(레이아웃 재계산 X).
  const dragging = dnd.drag?.active === true && dnd.drag.key === keyOf(item);
  const resizing = dragging && dnd.drag!.mode === "resize";
  const moving = dragging && dnd.drag!.mode === "move";
  const previewStartIso = dragging ? new Date(dnd.drag!.previewStart).toISOString() : item.startAt;
  const previewEndIso = dragging ? new Date(dnd.drag!.previewEnd).toISOString() : item.endAt;
  const range = timeRangeLabel(previewStartIso, previewEndIso);
  // 이동: 세로(dyPx) + 가로(요일 오프셋 × 컬럼 폭)를 transform으로 미리보기(겹침 레이아웃 유지).
  const transform = moving
    ? `translate(${dnd.drag!.dayOffset * dnd.drag!.colWidth}px, ${dnd.drag!.dyPx}px)`
    : undefined;
  // 리사이즈: top 고정, height만 미리보기 기간으로 갱신.
  const height = resizing
    ? Math.max(40, ((dnd.drag!.previewEnd - dnd.drag!.previewStart) / 3_600_000) * HOUR_HEIGHT) - 2
    : pos.height - 2;

  return (
    <EventDetailPopover item={item}>
    <div
      role="button"
      tabIndex={0}
      aria-label={`${item.title}, ${range}`}
      onPointerDown={draggable ? (e) => dnd.onPointerDown(e, item) : undefined}
      onPointerMove={draggable ? dnd.onPointerMove : undefined}
      onPointerUp={draggable ? dnd.onPointerUp : undefined}
      onPointerCancel={draggable ? dnd.onPointerCancel : undefined}
      onClickCapture={draggable ? dnd.onClickCapture : undefined}
      className={cn(
        "group/block absolute overflow-hidden rounded-lg border px-2 py-1.5 text-left shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-[var(--que-brand)]",
        draggable && (moving ? "cursor-grabbing" : "cursor-grab"),
      )}
      style={{
        top: pos.top + 1,
        height,
        left: `calc(${pos.left * 100}% + 2px)`,
        width: `calc(${pos.width * 100}% - 4px)`,
        backgroundColor: swatch.bg,
        borderColor: swatch.border,
        transform,
        zIndex: dragging ? 40 : undefined,
        boxShadow: dragging ? "0 6px 16px rgba(0,0,0,0.18)" : undefined,
      }}
    >
      <div className="flex items-center gap-1">
        <span
          className="truncate rounded-full bg-[var(--que-bg)]/60 px-1.5 py-px text-[10px] font-semibold tabular-nums"
          style={{ color: swatch.accent }}
        >
          {range}
        </span>
        {!item.movable && (
          <Lock className="size-3 shrink-0" style={{ color: swatch.accent }} aria-hidden />
        )}
        {item.recentlyChanged && (
          // 최근 24h 내 변경(ChangeLog 투명성) — 색 단독이 아닌 텍스트 배지.
          <span className="ml-auto shrink-0 rounded-sm bg-[var(--que-bg)]/70 px-1 py-px text-[9px] font-medium text-[var(--que-text-tertiary)]">
            수정됨
          </span>
        )}
      </div>
      <div
        className={cn(
          "mt-0.5 line-clamp-2 p-[3px] text-[12px] font-semibold leading-snug",
        )}
        style={{ color: swatch.text }}
      >
        {item.title}
      </div>
      {!compact && (
        // 팀원 이니셜 뱃지 — 블록 우하단 고정, 테두리 없음(2026-07-11 사용자 지정 — 전 화면 뱃지 border 제거).
        <span
          className="absolute right-1 bottom-1 flex size-5 items-center justify-center rounded-full text-[9px] font-semibold text-white"
          style={{ backgroundColor: item.ownerColor }}
          aria-hidden
        >
          {item.ownerName.slice(1, 3) || item.ownerName.slice(0, 2)}
        </span>
      )}

      {/* 하단 리사이즈 핸들 — 끝시각만 연장/단축. 블록 본문(이동) 위에 겹치므로 pointerdown 전파를 끊는다.
          평상시엔 옅고, hover/드래그 시 중앙 짧은 바가 진해져 잡을 곳을 알린다(색 단독 아님·상태색 불변). */}
      {draggable && (
        <span
          aria-hidden
          onPointerDown={(e) => dnd.onResizePointerDown(e, item)}
          onPointerMove={dnd.onPointerMove}
          onPointerUp={dnd.onPointerUp}
          onPointerCancel={dnd.onPointerCancel}
          onClickCapture={dnd.onClickCapture}
          className="absolute inset-x-0 bottom-0 z-10 flex h-4 cursor-ns-resize items-end justify-center"
        >
          <span
            className={cn(
              "mb-0.5 h-1 w-6 rounded-full transition-opacity",
              resizing ? "opacity-70" : "opacity-0 group-hover/block:opacity-40",
            )}
            style={{ backgroundColor: swatch.accent }}
          />
        </span>
      )}
    </div>
    </EventDetailPopover>
  );
}
