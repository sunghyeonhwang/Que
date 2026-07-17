"use client";

import { useMemo, useState } from "react";
import { Plus, X } from "lucide-react";
import type { CalendarEvent } from "@que/core";
import {
  createCalendarEventAction,
  createScheduleTaskAction,
} from "@/app/(app)/schedule/actions";
import { useSafeAction } from "@/components/app/use-safe-action";
import {
  ASSIGNEE_ME,
  NO_PROJECT,
  TaskFormFields,
  emptyTaskFormValue,
  taskFormErrors,
  taskFormEstimatedHours,
  taskFormToIso,
  type TaskFormValue,
} from "@/components/app/task-form-fields";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { DateRangePicker } from "@/components/app/date-range-picker";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

export interface ScheduleMember {
  id: string;
  name: string;
  avatarColor: string;
}
export interface ScheduleProject {
  id: string;
  name: string;
}

const VISIBILITY_ITEMS: Record<CalendarEvent["visibility"], string> = {
  team: "팀 공개",
  private: "비공개",
};

type Mode = "task" | "event";

/** date("yyyy-MM-dd") + time("HH:mm") → 로컬 타임존(KST) 기준 ISO. 일정(미팅) 모드 전용.
 *  부분 상태(빈 날짜/시각)는 ""로 반환해 Invalid Date 크래시를 막는다. */
function toIso(date: string, time: string): string {
  if (!date || !time) return "";
  const d = new Date(`${date}T${time}:00`);
  return Number.isNaN(d.getTime()) ? "" : d.toISOString();
}

/** 오늘 날짜 "yyyy-MM-dd"(로컬). Dialog 최초 오픈 시 날짜 기본값. */
function todayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/**
 * 일정 화면 "새로 추가" 하이브리드 Dialog. 상단 유형 토글로 [작업]/[일정(미팅)]을 전환한다.
 * - 작업: 공통 필드(task-form-fields — 다른 화면과 같은 폼) → createScheduleTaskAction.
 *   일정 화면 진입이라 시작·마감 날짜를 보고 있는 날짜로, 시간을 14~15시로 프리필한다.
 * - 일정(미팅): 제목·날짜·시간·참여자(다중)·공개범위 → createCalendarEventAction.
 *   미팅은 "하루 안의 시간대"가 본질이라 작업과 폼을 합치지 않는다(공개범위·참여자도 미팅 전용).
 */
export function CreateScheduleDialog({
  members,
  projects,
  defaultDate,
}: {
  members: ScheduleMember[];
  projects: ScheduleProject[];
  /** 다이얼로그 날짜 기본값 "yyyy-MM-dd" — 현재 보고 있는 앵커 날짜. 없으면 오늘. */
  defaultDate?: string;
}) {
  const { run, pending } = useSafeAction();
  const initialDate = defaultDate || todayStr();
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<Mode>("task");

  // 작업 모드 — 공통 폼 값(일정 화면 프리필: 보고 있는 날짜 + 14~15시).
  const initialTask = () =>
    emptyTaskFormValue({
      startDate: initialDate,
      startTime: "14:00",
      dueDate: initialDate,
      dueTime: "15:00",
    });
  const [task, setTask] = useState<TaskFormValue>(initialTask);

  // 일정(미팅) 전용
  const [title, setTitle] = useState("");
  const [date, setDate] = useState(initialDate);
  const [startTime, setStartTime] = useState("14:00");
  const [endTime, setEndTime] = useState("15:00");
  const [attendeeIds, setAttendeeIds] = useState<string[]>([]);
  const [visibility, setVisibility] = useState<CalendarEvent["visibility"]>("team");

  const memberById = useMemo(() => new Map(members.map((m) => [m.id, m])), [members]);
  // 아직 추가되지 않은 참여자만 드롭다운에 노출한다.
  const remaining = members.filter((m) => !attendeeIds.includes(m.id));

  const taskErrors = taskFormErrors(task);
  const eventTitleError = title.length > 0 && !title.trim() ? "제목을 입력하세요." : null;
  const eventTimeError = endTime <= startTime ? "종료 시간은 시작 시간보다 늦어야 합니다." : null;
  const canSubmit =
    mode === "task"
      ? !taskErrors.title && !taskErrors.range && !pending
      : title.trim().length > 0 && !!date && !!startTime && !!endTime && !eventTimeError && !pending;

  const reset = () => {
    setMode("task");
    setTask(initialTask());
    setTitle("");
    setDate(initialDate);
    setStartTime("14:00");
    setEndTime("15:00");
    setAttendeeIds([]);
    setVisibility("team");
  };

  const submit = () => {
    if (!canSubmit) return;
    const submitTitle = (mode === "task" ? task.title : title).trim();
    const label = mode === "task" ? "작업" : "일정";

    const action =
      mode === "task"
        ? () =>
            createScheduleTaskAction({
              title: submitTitle,
              assigneeId: task.assigneeId === ASSIGNEE_ME ? undefined : task.assigneeId,
              projectId: task.projectId === NO_PROJECT ? undefined : task.projectId,
              priority: task.priority,
              ...taskFormToIso(task),
              description: task.description.trim() || undefined,
              estimatedHours: taskFormEstimatedHours(task),
            })
        : () =>
            createCalendarEventAction({
              title: submitTitle,
              startAt: toIso(date, startTime),
              endAt: toIso(date, endTime),
              attendeeIds: attendeeIds.length > 0 ? attendeeIds : undefined,
              visibility,
            });

    run(action, {
      success: `"${submitTitle}" ${label}을(를) 추가했습니다.`,
      onSuccess: () => {
        reset();
        setOpen(false);
      },
    });
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) reset();
      }}
    >
      <DialogTrigger
        render={
          <Button className="h-10 gap-1.5 rounded-lg bg-[var(--que-brand)] px-3.5 font-medium text-[var(--que-on-brand)] hover:bg-[var(--que-brand-hover)]" />
        }
      >
        <Plus className="size-4" aria-hidden />
        새로 추가
      </DialogTrigger>
      <DialogContent className="max-h-[calc(100dvh-3rem)] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{mode === "task" ? "작업 만들기" : "일정 만들기"}</DialogTitle>
          <DialogDescription>
            아래 세부 정보를 입력하여 새 {mode === "task" ? "작업" : "일정"}을 만드세요.
          </DialogDescription>
        </DialogHeader>

        {/* 유형 토글 */}
        <div
          role="tablist"
          aria-label="추가 유형"
          className="grid grid-cols-2 gap-1 rounded-lg bg-[var(--que-bg-muted)] p-1"
        >
          {(["task", "event"] as Mode[]).map((m) => (
            <button
              key={m}
              type="button"
              role="tab"
              aria-selected={mode === m}
              onClick={() => setMode(m)}
              className={cn(
                "h-9 rounded-md text-sm font-medium transition-colors",
                mode === m
                  ? "bg-[var(--que-bg)] text-[var(--que-text)] shadow-sm"
                  : "text-[var(--que-text-secondary)] hover:text-[var(--que-text)]",
              )}
            >
              {m === "task" ? "작업" : "일정(미팅)"}
            </button>
          ))}
        </div>

        {mode === "task" ? (
          <TaskFormFields
            value={task}
            onChange={setTask}
            members={members}
            projects={projects}
            idPrefix="cs"
            autoFocusTitle
            noDateHint="날짜가 없으면 이 캘린더에는 표시되지 않고 작업 목록에서만 보입니다."
            onSubmit={submit}
          />
        ) : (
          <div className="flex flex-col gap-3">
            <Field>
              <FieldLabel htmlFor="cs-ev-title">제목</FieldLabel>
              <Input
                id="cs-ev-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="예: 디자인 스프린트 미팅"
                className="h-10"
                aria-invalid={eventTitleError ? true : undefined}
                autoFocus
              />
              {eventTitleError && <p className="text-sm text-destructive">{eventTitleError}</p>}
            </Field>

            {/* 미팅은 하루 안의 시간대 — singleDay 기간 캘린더로 날짜+시작·종료 시각을 한 번에. */}
            <Field>
              <FieldLabel>날짜 · 시각</FieldLabel>
              <DateRangePicker
                singleDay
                value={{ startDate: date, startTime, endDate: date, endTime }}
                onChange={(r) => {
                  setDate(r.startDate);
                  setStartTime(r.startTime);
                  setEndTime(r.endTime);
                }}
                emptyLabel="날짜 미정"
                triggerAriaLabel="일정 날짜·시각 설정"
              />
            </Field>
            {eventTimeError && <p className="-mt-1 text-sm text-destructive">{eventTimeError}</p>}

            <Field>
              <FieldLabel>참여자</FieldLabel>
              {attendeeIds.length > 0 && (
                <div className="mb-1.5 flex flex-wrap gap-1.5">
                  {attendeeIds.map((id) => {
                    const m = memberById.get(id);
                    if (!m) return null;
                    return (
                      <span
                        key={id}
                        className="flex items-center gap-1.5 rounded-full bg-[var(--que-bg-muted)] py-1 pr-1 pl-1.5 text-sm"
                      >
                        <span
                          className="flex size-5 items-center justify-center rounded-full text-[9px] font-semibold text-white"
                          style={{ backgroundColor: m.avatarColor }}
                          aria-hidden
                        >
                          {m.name.slice(1, 3) || m.name.slice(0, 2)}
                        </span>
                        {m.name}
                        <button
                          type="button"
                          aria-label={`${m.name} 참여자 제거`}
                          onClick={() => setAttendeeIds((prev) => prev.filter((x) => x !== id))}
                          className="grid size-5 place-items-center rounded-full hover:bg-[var(--que-border)]"
                        >
                          <X className="size-3.5" aria-hidden />
                        </button>
                      </span>
                    );
                  })}
                </div>
              )}
              <Select
                items={Object.fromEntries(remaining.map((m) => [m.id, m.name]))}
                value=""
                onValueChange={(v) => {
                  if (v) setAttendeeIds((prev) => [...prev, v as string]);
                }}
                disabled={remaining.length === 0}
              >
                <SelectTrigger aria-label="참여자 추가" className="h-10 min-h-10 w-full">
                  <SelectValue
                    placeholder={remaining.length === 0 ? "모든 팀원 추가됨" : "참여자 추가"}
                  />
                </SelectTrigger>
                <SelectContent>
                  {remaining.map((m) => (
                    <SelectItem key={m.id} value={m.id}>
                      {m.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>

            <Field>
              <FieldLabel>공개 범위</FieldLabel>
              <Select
                items={VISIBILITY_ITEMS}
                value={visibility}
                onValueChange={(v) => setVisibility((v as CalendarEvent["visibility"]) ?? "team")}
              >
                <SelectTrigger aria-label="공개 범위 선택" className="h-10 min-h-10 w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="team">팀 공개</SelectItem>
                  <SelectItem value="private">비공개</SelectItem>
                </SelectContent>
              </Select>
            </Field>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" className="h-10" onClick={() => setOpen(false)}>
            취소
          </Button>
          <Button
            className="h-10 bg-[var(--que-brand)] px-4 text-[var(--que-on-brand)] hover:bg-[var(--que-brand-hover)]"
            disabled={!canSubmit}
            onClick={submit}
          >
            {pending ? "저장 중…" : "저장"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
