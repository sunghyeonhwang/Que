"use client";

import { useState, type ReactElement } from "react";
import { format } from "date-fns";
import { ko } from "date-fns/locale";
import { Calendar, ChevronDown, Clock, Flag, FolderOpen, Lock, User, Users } from "lucide-react";
import type { CalendarViewItem } from "@/lib/calendar-data";
import { updateTaskScheduleAction } from "@/app/(app)/today/actions";
import { updateEventScheduleAction } from "@/app/(app)/calendar/actions";
import { useSafeAction } from "@/components/app/use-safe-action";
import {
  DateRangePicker,
  formatRangeLabel,
} from "@/components/app/date-range-picker";
import { PriorityBadge } from "@/components/projects/priority-badge";
import { TaskStatusSheet, type TaskRowData } from "@/components/app/task-status-sheet";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

const pad = (n: number) => String(n).padStart(2, "0");
function toDateStr(iso?: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
function toTimeStr(iso?: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
/** 로컬(KST) 날짜+시각 → ISO. 재일정 폼과 동일 규약. */
function toIso(date: string, time: string): string {
  return new Date(`${date}T${time}:00`).toISOString();
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

        {/* 일시 수정(경량) — 시트를 거치지 않고 팝오버에서 바로. 편집 권한이 있을 때만. */}
        {isTask && item.canEdit && (
          <div className="border-t border-[var(--que-border)] p-2.5">
            <p className="mb-1.5 text-xs font-medium text-[var(--que-text-tertiary)]">일시 수정</p>
            <TaskRescheduleInline item={item} />
          </div>
        )}
        {item.kind === "event" && item.movable && (
          <div className="border-t border-[var(--que-border)] p-2.5">
            <p className="mb-1.5 text-xs font-medium text-[var(--que-text-tertiary)]">일시 수정</p>
            <EventRescheduleInline item={item} />
          </div>
        )}

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

/** 기간 요약 토글 버튼 — 클릭 시 부모(팝오버) 안에서 달력을 아코디언처럼 펼친다(중첩 Popover 회피). */
function RangeToggleButton({
  label,
  expanded,
  onToggle,
  ariaLabel,
}: {
  label: string;
  expanded: boolean;
  onToggle: () => void;
  ariaLabel: string;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={expanded}
      aria-label={ariaLabel}
      className="flex h-10 w-full items-center gap-2 rounded-lg border border-[var(--que-border)] bg-transparent px-2.5 text-left text-sm transition-colors hover:bg-[var(--que-bg-muted)] focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
    >
      <Calendar className="size-4 shrink-0 text-[var(--que-text-tertiary)]" aria-hidden />
      <span className="min-w-0 flex-1 truncate text-[var(--que-text)]">{label}</span>
      <ChevronDown
        className={cn(
          "size-4 shrink-0 text-[var(--que-text-tertiary)] transition-transform",
          expanded && "rotate-180",
        )}
        aria-hidden
      />
    </button>
  );
}

/** 작업 재일정(팝오버 내장) — full 기간 DateRangePicker(인라인) + updateTaskScheduleAction. */
function TaskRescheduleInline({ item }: { item: CalendarViewItem }) {
  const { run, pending } = useSafeAction();
  const [expanded, setExpanded] = useState(false);
  const initDate = toDateStr(item.startAt) || toDateStr(new Date().toISOString());
  const [startDate, setStartDate] = useState(initDate);
  const [endDate, setEndDate] = useState(toDateStr(item.endAt) || initDate);
  const [startTime, setStartTime] = useState(toTimeStr(item.startAt) || "09:00");
  const [endTime, setEndTime] = useState(toTimeStr(item.endAt) || "10:00");

  const rangeError = toIso(endDate, endTime) <= toIso(startDate, startTime);
  const save = () => {
    if (rangeError) return;
    run(
      () =>
        updateTaskScheduleAction({
          taskId: item.id,
          startAt: toIso(startDate, startTime),
          endAt: toIso(endDate, endTime),
        }),
      { success: `"${item.title}" 일정을 변경했습니다.` },
    );
  };

  return (
    <div className="flex flex-col gap-2">
      <RangeToggleButton
        label={formatRangeLabel(startDate, startTime, endDate, endTime, {
          emptyLabel: "기간 미정",
        })}
        expanded={expanded}
        onToggle={() => setExpanded((v) => !v)}
        ariaLabel={`${item.title} 일정 설정`}
      />
      {expanded && (
        <DateRangePicker
          inline
          value={{ startDate, startTime, endDate, endTime }}
          onChange={(r) => {
            setStartDate(r.startDate);
            setStartTime(r.startTime);
            setEndDate(r.endDate);
            setEndTime(r.endTime);
          }}
          emptyLabel="기간 미정"
        />
      )}
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs text-destructive">
          {rangeError ? "마감은 시작보다 늦어야 합니다." : ""}
        </span>
        <Button
          className="h-10 rounded-lg"
          disabled={pending || rangeError}
          onClick={save}
        >
          {pending ? "저장 중…" : "저장"}
        </Button>
      </div>
    </div>
  );
}

/** Que 일정 시간 수정(팝오버 내장) — singleDay DateRangePicker(인라인) + updateEventScheduleAction(core moveCalendarEvent). */
function EventRescheduleInline({ item }: { item: CalendarViewItem }) {
  const { run, pending } = useSafeAction();
  const [expanded, setExpanded] = useState(false);
  const initDate = toDateStr(item.startAt) || toDateStr(new Date().toISOString());
  const [date, setDate] = useState(initDate);
  const [startTime, setStartTime] = useState(toTimeStr(item.startAt) || "09:00");
  const [endTime, setEndTime] = useState(toTimeStr(item.endAt) || "10:00");

  const timeError = toIso(date, endTime) <= toIso(date, startTime);
  const save = () => {
    if (timeError) return;
    run(
      () =>
        updateEventScheduleAction({
          eventId: item.id,
          startAt: toIso(date, startTime),
          endAt: toIso(date, endTime),
        }),
      { success: `"${item.title}" 일정을 변경했습니다.` },
    );
  };

  return (
    <div className="flex flex-col gap-2">
      <RangeToggleButton
        label={formatRangeLabel(date, startTime, date, endTime, {
          emptyLabel: "날짜 미정",
        })}
        expanded={expanded}
        onToggle={() => setExpanded((v) => !v)}
        ariaLabel={`${item.title} 일정 설정`}
      />
      {expanded && (
        <DateRangePicker
          inline
          singleDay
          value={{ startDate: date, startTime, endDate: date, endTime }}
          onChange={(r) => {
            setDate(r.startDate);
            setStartTime(r.startTime);
            setEndTime(r.endTime);
          }}
          emptyLabel="날짜 미정"
        />
      )}
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs text-destructive">
          {timeError ? "종료는 시작보다 늦어야 합니다." : ""}
        </span>
        <Button
          className="h-10 rounded-lg"
          disabled={pending || timeError}
          onClick={save}
        >
          {pending ? "저장 중…" : "저장"}
        </Button>
      </div>
    </div>
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
