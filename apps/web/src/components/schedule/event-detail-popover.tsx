"use client";

import type { ReactElement } from "react";
import { format } from "date-fns";
import { ko } from "date-fns/locale";
import { Calendar, Clock, Flag, FolderOpen, Lock, User, Users } from "lucide-react";
import type { CalendarViewItem } from "@/lib/calendar-data";
import { PriorityBadge } from "@/components/projects/priority-badge";
import { TaskStatusSheet, type TaskRowData } from "@/components/app/task-status-sheet";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

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

/** 이름 이니셜(한글은 성 제외 1~2자, 그 외 앞 2자). 아바타 원형 표기용. */
function initials(name: string): string {
  return name.slice(1, 3) || name.slice(0, 2);
}

/** 상세 필드 한 줄. 아이콘 + 라벨 + 값. */
function DetailRow({
  icon: Icon,
  label,
  children,
}: {
  icon: typeof Clock;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-2.5">
      <Icon className="mt-0.5 size-4 shrink-0 text-[var(--que-text-tertiary)]" aria-hidden />
      <dt className="w-16 shrink-0 text-[var(--que-text-tertiary)]">{label}</dt>
      <dd className="min-w-0 flex-1 text-[var(--que-text)]">{children}</dd>
    </div>
  );
}

function Avatar({ name, color }: { name: string; color: string }) {
  return (
    <span
      className="flex size-5 shrink-0 items-center justify-center rounded-full text-[9px] font-semibold text-white"
      style={{ backgroundColor: color }}
      aria-hidden
    >
      {initials(name)}
    </span>
  );
}

/**
 * 캘린더 항목(주간 블록·월간 칩) 클릭 상세 팝오버. 조회 전용.
 * - task: 우선순위·마감일·시간·프로젝트·담당자·설명 + "상세·상태 변경"(TaskStatusSheet 재사용).
 * - event: 시간·주최자·참여자 + (있으면)설명. v1 조회만.
 * 비공개 마스킹된 "자리비움"은 priority/description/attendees가 비어 제목·시간만 안전하게 렌더된다.
 * children은 트리거로 쓰이는 시각 블록(주간 EventBlock div·월간 칩)이다.
 */
export function EventDetailPopover({
  item,
  children,
}: {
  item: CalendarViewItem;
  children: ReactElement;
}) {
  const isTask = item.kind === "task";
  const range = timeRangeLabel(item.startAt, item.endAt);

  return (
    <Popover>
      {/* children이 native <button>이 아닌 <div role="button">이라 nativeButton={false} 필수.
          Base UI가 비-native 요소로 인식해 keydown→click을 합성한다(콘솔 에러 제거 + Enter/Space 오픈). */}
      <PopoverTrigger nativeButton={false} render={children} />
      <PopoverContent
        align="start"
        side="right"
        sideOffset={6}
        className="w-80 max-w-[calc(100vw-2rem)] gap-0 p-0"
      >
        <div className="border-b border-[var(--que-border)] p-3.5">
          <h3 className="text-base font-semibold leading-snug text-[var(--que-text)]">
            {item.title}
          </h3>
        </div>

        <dl className="flex flex-col gap-2.5 p-3.5 text-sm">
          {isTask && item.priority && (
            <DetailRow icon={Flag} label="우선순위">
              <PriorityBadge priority={item.priority} />
            </DetailRow>
          )}

          {isTask && (
            <DetailRow icon={Calendar} label="마감일">
              <span className="tabular-nums">
                {format(new Date(item.endAt), "yyyy년 M월 d일 EEEE", { locale: ko })}
              </span>
            </DetailRow>
          )}

          <DetailRow icon={Clock} label="시간">
            <span className="tabular-nums">{range}</span>
          </DetailRow>

          {isTask && item.projectName && (
            <DetailRow icon={FolderOpen} label="프로젝트">
              {item.projectName}
            </DetailRow>
          )}

          {isTask ? (
            <DetailRow icon={User} label="담당자">
              <span className="flex items-center gap-1.5">
                <Avatar name={item.ownerName} color={item.ownerColor} />
                {item.ownerName}
              </span>
            </DetailRow>
          ) : (
            <DetailRow icon={User} label="주최자">
              <span className="flex items-center gap-1.5">
                <Avatar name={item.ownerName} color={item.ownerColor} />
                {item.ownerName}
              </span>
            </DetailRow>
          )}

          {!isTask && item.attendees && item.attendees.length > 0 && (
            <DetailRow icon={Users} label="참여자">
              <span className="flex flex-wrap gap-1.5">
                {item.attendees.map((a) => (
                  <span
                    key={a.name}
                    className="flex items-center gap-1 rounded-full bg-[var(--que-bg-muted)] py-0.5 pr-2 pl-0.5 text-xs"
                  >
                    <Avatar name={a.name} color={a.color} />
                    {a.name}
                  </span>
                ))}
              </span>
            </DetailRow>
          )}

          {!item.movable && (
            <p className="flex items-center gap-1.5 text-xs text-[var(--que-text-tertiary)]">
              <Lock className="size-3" aria-hidden />
              읽기 전용 일정입니다.
            </p>
          )}

          {item.description && (
            <div className="mt-1 border-t border-[var(--que-border)] pt-2.5">
              <p className="mb-1 text-xs font-medium text-[var(--que-text-tertiary)]">설명</p>
              <p className="whitespace-pre-wrap break-words text-[var(--que-text-secondary)]">
                {item.description}
              </p>
            </div>
          )}
        </dl>

        {isTask && item.taskStatus && (
          <div className="border-t border-[var(--que-border)] p-2.5">
            <TaskStatusSheet
              task={mapToTaskRow(item, range)}
              triggerClassName="flex h-10 w-full items-center justify-center rounded-lg border border-[var(--que-border)] text-sm font-medium text-[var(--que-text)] hover:bg-[var(--que-bg-muted)] focus-visible:outline-2 focus-visible:outline-ring"
            >
              상세 · 상태 변경
            </TaskStatusSheet>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}

/** CalendarViewItem(task) → TaskStatusSheet의 TaskRowData. canEdit은 서버 판정값을 그대로 전달. */
function mapToTaskRow(item: CalendarViewItem, timeText: string): TaskRowData {
  return {
    id: item.id,
    title: item.title,
    status: item.taskStatus!,
    timeText,
    metaText: item.projectName,
    startAt: item.startAt,
    endAt: item.endAt,
    assigneeId: item.ownerId,
    assigneeName: item.ownerName,
    canEdit: item.canEdit,
  };
}
