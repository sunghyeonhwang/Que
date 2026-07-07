"use client";

import { format } from "date-fns";
import type { CalendarViewItem } from "@/lib/calendar-data";
import { eventSwatch } from "./event-color";
import { EventDetailPopover } from "./event-detail-popover";

/**
 * 월간 뷰 이벤트 칩(클라이언트). 서버 컴포넌트인 MonthView에서 칩만 분리해
 * 클릭 시 상세 팝오버를 열 수 있게 한다. role="button"/tabIndex는 PopoverTrigger가
 * 실제 onClick·onKeyDown·aria를 연결한다.
 */
export function MonthChip({ item }: { item: CalendarViewItem }) {
  const swatch = eventSwatch(item);
  return (
    <EventDetailPopover item={item}>
      <div
        role="button"
        tabIndex={0}
        aria-label={`${item.title}, ${format(new Date(item.startAt), "h:mm a")}`}
        className="flex min-h-10 cursor-pointer items-center gap-1 truncate rounded border px-1.5 py-1 text-[11px] font-medium outline-none focus-visible:ring-2 focus-visible:ring-[var(--que-brand)]"
        style={{
          backgroundColor: swatch.bg,
          borderColor: swatch.border,
          color: swatch.text,
        }}
      >
        <span className="tabular-nums" style={{ color: swatch.accent }}>
          {format(new Date(item.startAt), "H:mm")}
        </span>
        <span className="truncate">{item.title}</span>
        {item.recentlyChanged && (
          // 최근 24h 내 변경(ChangeLog 투명성) — 색 단독이 아닌 텍스트 배지.
          <span className="ml-auto shrink-0 rounded-sm bg-[var(--que-bg-muted)] px-1 py-px text-[9px] font-normal text-[var(--que-text-tertiary)]">
            수정됨
          </span>
        )}
      </div>
    </EventDetailPopover>
  );
}
