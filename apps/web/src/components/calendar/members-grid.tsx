"use client";

import { format, isSameDay, isToday } from "date-fns";
import { ko } from "date-fns/locale";
import type { CalendarData } from "@/lib/calendar-data";
import { cn } from "@/lib/utils";
import { DropCell } from "./drop-cell";
import { ItemChip } from "./item-chip";

/** 전체 멤버 뷰 — 사람별 행 × 요일별 열. 드래그는 같은 사람 행 안에서 날짜만 변경. */
export function MembersGrid({ days, data }: { days: Date[]; data: CalendarData }) {
  return (
    <div className="overflow-x-auto rounded-lg border">
      <div
        role="grid"
        aria-label="전체 멤버 주간 캘린더"
        className="grid min-w-[860px]"
        style={{ gridTemplateColumns: `6rem repeat(${days.length}, minmax(0, 1fr))` }}
      >
        <div className="sticky top-0 left-0 z-10 border-b bg-background px-2 py-2 text-sm font-medium">
          멤버
        </div>
        {days.map((day) => (
          <div
            key={day.toISOString()}
            className={cn(
              "sticky top-0 z-10 border-b border-l bg-background px-2 py-2 text-center text-sm font-medium",
              isToday(day) && "bg-accent",
            )}
          >
            {format(day, "M/d (EEE)", { locale: ko })}
          </div>
        ))}

        {data.users.map((user) => (
          <MemberRow key={user.id} user={user} days={days} data={data} />
        ))}
      </div>
    </div>
  );
}

function MemberRow({
  user,
  days,
  data,
}: {
  user: CalendarData["users"][number];
  days: Date[];
  data: CalendarData;
}) {
  return (
    <>
      <div className="sticky left-0 z-[5] flex items-center gap-2 border-b bg-background px-2 py-2 text-sm">
        <span
          className="size-2.5 shrink-0 rounded-full"
          style={{ backgroundColor: user.avatarColor }}
          aria-hidden
        />
        <span className="truncate">{user.name}</span>
      </div>
      {days.map((day) => {
        const cellItems = data.items.filter(
          (item) => item.ownerId === user.id && isSameDay(new Date(item.startAt), day),
        );
        return (
          <DropCell
            key={`${user.id}-${day.toISOString()}`}
            date={format(day, "yyyy-MM-dd")}
            restrictOwnerId={user.id}
            ariaLabel={`${user.name} ${format(day, "M월 d일")}`}
            className={cn("min-h-14 border-b border-l p-1", isToday(day) && "bg-accent/30")}
          >
            <div className="flex flex-col gap-1">
              {cellItems.map((item) => (
                <ItemChip key={`${item.kind}-${item.id}`} item={item} />
              ))}
            </div>
          </DropCell>
        );
      })}
    </>
  );
}
