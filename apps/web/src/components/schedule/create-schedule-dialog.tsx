"use client";

import { useMemo, useState } from "react";
import { Plus, X } from "lucide-react";
import type { CalendarEvent, Task } from "@que/core";
import {
  createCalendarEventAction,
  createScheduleTaskAction,
} from "@/app/(app)/schedule/actions";
import { useSafeAction } from "@/components/app/use-safe-action";
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
import { Textarea } from "@/components/ui/textarea";
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

const UNASSIGNED = "__unassigned__";
const NO_PROJECT = "__no_project__";

const PRIORITY_ITEMS: Record<Task["priority"], string> = {
  high: "높음",
  normal: "보통",
  low: "낮음",
};
const PRIORITY_ORDER: Task["priority"][] = ["high", "normal", "low"];

const VISIBILITY_ITEMS: Record<CalendarEvent["visibility"], string> = {
  team: "팀 공개",
  private: "비공개",
};

type Mode = "task" | "event";

/** date("yyyy-MM-dd") + time("HH:mm") → 로컬 타임존(KST) 기준 ISO. dueDateToIso와 동일 규약. */
function toIso(date: string, time: string): string {
  return new Date(`${date}T${time}:00`).toISOString();
}

/** 오늘 날짜 "yyyy-MM-dd"(로컬). Dialog 최초 오픈 시 날짜 기본값. */
function todayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/**
 * 일정 화면 "새로 추가" 하이브리드 Dialog. 상단 유형 토글로 [작업]/[일정(미팅)]을 전환한다.
 * - 작업: 제목·담당자·프로젝트·우선순위·날짜·시간·설명 → createScheduleTaskAction
 * - 일정: 제목·날짜·시간·참여자(다중)·공개범위 → createCalendarEventAction
 * 시각은 날짜+From/To 시간을 KST ISO로 조합해 전송한다. 성공 시 토스트+닫기+refresh.
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

  // 공통 필드
  const [title, setTitle] = useState("");
  const [date, setDate] = useState(initialDate);
  const [startTime, setStartTime] = useState("14:00");
  const [endTime, setEndTime] = useState("15:00");

  // 작업 전용
  const [assigneeId, setAssigneeId] = useState(UNASSIGNED);
  const [projectId, setProjectId] = useState(NO_PROJECT);
  const [priority, setPriority] = useState<Task["priority"]>("normal");
  const [description, setDescription] = useState("");

  // 일정 전용
  const [attendeeIds, setAttendeeIds] = useState<string[]>([]);
  const [visibility, setVisibility] = useState<CalendarEvent["visibility"]>("team");

  const memberById = useMemo(() => new Map(members.map((m) => [m.id, m])), [members]);
  const assigneeItems = useMemo(
    () => ({
      [UNASSIGNED]: "나에게 배정",
      ...Object.fromEntries(members.map((m) => [m.id, m.name])),
    }),
    [members],
  );
  const projectItems = useMemo(
    () => ({
      [NO_PROJECT]: "프로젝트 없음",
      ...Object.fromEntries(projects.map((p) => [p.id, p.name])),
    }),
    [projects],
  );
  // 아직 추가되지 않은 참여자만 드롭다운에 노출한다.
  const remaining = members.filter((m) => !attendeeIds.includes(m.id));

  const titleError = title.length > 0 && !title.trim() ? "제목을 입력하세요." : null;
  const timeError = endTime <= startTime ? "종료 시간은 시작 시간보다 늦어야 합니다." : null;
  const canSubmit = title.trim().length > 0 && !!date && !timeError && !pending;

  const reset = () => {
    setMode("task");
    setTitle("");
    setDate(initialDate);
    setStartTime("14:00");
    setEndTime("15:00");
    setAssigneeId(UNASSIGNED);
    setProjectId(NO_PROJECT);
    setPriority("normal");
    setDescription("");
    setAttendeeIds([]);
    setVisibility("team");
  };

  const submit = () => {
    if (!canSubmit) return;
    const startAt = toIso(date, startTime);
    const endAt = toIso(date, endTime);
    const label = mode === "task" ? "작업" : "일정";

    const action =
      mode === "task"
        ? () =>
            createScheduleTaskAction({
              title: title.trim(),
              assigneeId: assigneeId === UNASSIGNED ? undefined : assigneeId,
              projectId: projectId === NO_PROJECT ? undefined : projectId,
              priority,
              startAt,
              endAt,
              description: description.trim() || undefined,
            })
        : () =>
            createCalendarEventAction({
              title: title.trim(),
              startAt,
              endAt,
              attendeeIds: attendeeIds.length > 0 ? attendeeIds : undefined,
              visibility,
            });

    run(action, {
      success: `"${title.trim()}" ${label}을(를) 추가했습니다.`,
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

        <div className="flex flex-col gap-3">
          <Field>
            <FieldLabel htmlFor="cs-title">제목</FieldLabel>
            <Input
              id="cs-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={mode === "task" ? "예: 상세페이지 QA" : "예: 디자인 스프린트 미팅"}
              className="h-10"
              aria-invalid={titleError ? true : undefined}
              autoFocus
            />
            {titleError && <p className="text-sm text-destructive">{titleError}</p>}
          </Field>

          {mode === "task" && (
            <div className="grid grid-cols-2 gap-3">
              <Field>
                <FieldLabel>담당자</FieldLabel>
                <Select
                  items={assigneeItems}
                  value={assigneeId}
                  onValueChange={(v) => setAssigneeId((v as string) ?? UNASSIGNED)}
                >
                  <SelectTrigger aria-label="담당자 선택" className="h-10 min-h-10 w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={UNASSIGNED}>나에게 배정</SelectItem>
                    {members.map((m) => (
                      <SelectItem key={m.id} value={m.id}>
                        {m.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>

              <Field>
                <FieldLabel>프로젝트</FieldLabel>
                <Select
                  items={projectItems}
                  value={projectId}
                  onValueChange={(v) => setProjectId((v as string) ?? NO_PROJECT)}
                >
                  <SelectTrigger aria-label="프로젝트 선택" className="h-10 min-h-10 w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NO_PROJECT}>프로젝트 없음</SelectItem>
                    {projects.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            </div>
          )}

          <div className="grid grid-cols-3 gap-3">
            <Field>
              <FieldLabel htmlFor="cs-date">날짜</FieldLabel>
              <Input
                id="cs-date"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="h-10"
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="cs-start">시작</FieldLabel>
              <Input
                id="cs-start"
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="h-10"
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="cs-end">종료</FieldLabel>
              <Input
                id="cs-end"
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                className="h-10"
                aria-invalid={timeError ? true : undefined}
              />
            </Field>
          </div>
          {timeError && <p className="-mt-1 text-sm text-destructive">{timeError}</p>}

          {mode === "task" && (
            <div className="grid grid-cols-2 gap-3">
              <Field>
                <FieldLabel>우선순위</FieldLabel>
                <Select
                  items={PRIORITY_ITEMS}
                  value={priority}
                  onValueChange={(v) => setPriority((v as Task["priority"]) ?? "normal")}
                >
                  <SelectTrigger aria-label="우선순위 선택" className="h-10 min-h-10 w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PRIORITY_ORDER.map((p) => (
                      <SelectItem key={p} value={p}>
                        {PRIORITY_ITEMS[p]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            </div>
          )}

          {mode === "task" && (
            <Field>
              <FieldLabel htmlFor="cs-desc">설명</FieldLabel>
              <Textarea
                id="cs-desc"
                rows={2}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="간단한 설명 입력…"
              />
            </Field>
          )}

          {mode === "event" && (
            <>
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
                            onClick={() =>
                              setAttendeeIds((prev) => prev.filter((x) => x !== id))
                            }
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
                  onValueChange={(v) =>
                    setVisibility((v as CalendarEvent["visibility"]) ?? "team")
                  }
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
            </>
          )}
        </div>

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
