"use client";

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

// 작업 생성 공통 필드 — 프로젝트(create-task-dialog)·일정(create-schedule-dialog 작업 모드)·
// 자연어 확인 카드(quick-add)가 전부 이 컴포넌트를 쓴다. "어디서 만들어도 같은 폼"이 목표:
// 같은 필드 구성·순서·라벨·기본값 규칙(담당자 비우면 나 · 시작 시간 없으면 09:00 · 마감 시간
// 없으면 18:00 — 기존 dueDateToIso 규약 승계). 제출(어떤 서버 액션을 부를지)은 각 부모가 담당.

/** 담당자 "나에게 배정" sentinel — 제출 시 undefined로 매핑(core가 본인 배정). */
export const ASSIGNEE_ME = "__me__";
/** 프로젝트 미지정 sentinel(base-ui Select는 빈 문자열이 까다로워 명시 값). */
export const NO_PROJECT = "__no_project__";

export interface TaskFormValue {
  title: string;
  description: string;
  /** ASSIGNEE_ME 또는 실제 userId. */
  assigneeId: string;
  /** NO_PROJECT 또는 실제 projectId. 프로젝트 고정 폼에서는 무시된다. */
  projectId: string;
  priority: "high" | "normal" | "low";
  /** yyyy-MM-dd, ""=미지정. */
  startDate: string;
  /** HH:mm, ""=미지정(기본 09:00으로 해석). */
  startTime: string;
  dueDate: string;
  /** ""=미지정(기본 18:00으로 해석). */
  dueTime: string;
}

export function emptyTaskFormValue(overrides?: Partial<TaskFormValue>): TaskFormValue {
  return {
    title: "",
    description: "",
    assigneeId: ASSIGNEE_ME,
    projectId: NO_PROJECT,
    priority: "normal",
    startDate: "",
    startTime: "",
    dueDate: "",
    dueTime: "",
    ...overrides,
  };
}

const PRIORITY_ITEMS: Record<TaskFormValue["priority"], string> = {
  high: "높음",
  normal: "보통",
  low: "낮음",
};
const PRIORITY_ORDER: TaskFormValue["priority"][] = ["high", "normal", "low"];

/** date("yyyy-MM-dd") + time("HH:mm") → 로컬(KST) ISO. 기존 dueDateToIso·toIso와 동일 규약. */
function toIso(date: string, time: string): string {
  return new Date(`${date}T${time}:00`).toISOString();
}

/**
 * 폼 값 → core createTask용 {startAt, endAt}. 시간 미지정 기본: 시작 09:00 · 마감 18:00
 * (마감 18:00은 기존 dueDateToIso 규약). 한쪽 날짜만 있어도 동작한다(core parseScheduleRange가 보완).
 */
export function taskFormToIso(v: TaskFormValue): { startAt?: string; endAt?: string } {
  return {
    startAt: v.startDate ? toIso(v.startDate, v.startTime || "09:00") : undefined,
    endAt: v.dueDate ? toIso(v.dueDate, v.dueTime || "18:00") : undefined,
  };
}

/** 공통 검증 — 제목 필수 · 마감이 시작보다 앞서면 오류. 부모의 canSubmit 판정에 쓴다. */
export function taskFormErrors(v: TaskFormValue): { title: string | null; range: string | null } {
  const title = v.title.trim().length === 0 ? "작업 이름을 입력하세요." : null;
  const { startAt, endAt } = taskFormToIso(v);
  const range =
    startAt && endAt && endAt < startAt ? "마감이 시작보다 앞설 수 없습니다." : null;
  return { title, range };
}

/**
 * 공통 필드 렌더. 제어 컴포넌트(value/onChange) — 부모가 상태·제출을 소유한다.
 * - `projects`를 생략하면 프로젝트 셀렉트를 숨긴다(프로젝트 화면처럼 스코프가 고정된 폼).
 * - `showTitleError`는 blur/제출 시도 후에만 필수 에러를 노출하는 부모 정책용.
 */
export function TaskFormFields({
  value,
  onChange,
  members,
  projects,
  idPrefix,
  autoFocusTitle = false,
  showTitleError = false,
  onSubmit,
}: {
  value: TaskFormValue;
  onChange: (next: TaskFormValue) => void;
  members: { id: string; name: string }[];
  /** 생략(undefined) = 프로젝트 셀렉트 숨김(스코프 고정 폼). */
  projects?: { id: string; name: string }[];
  /** 같은 화면에 폼이 둘 떠도 id가 안 겹치게. */
  idPrefix: string;
  autoFocusTitle?: boolean;
  showTitleError?: boolean;
  /** 제목 입력에서 Enter — 부모의 submit을 잇는다(선택). */
  onSubmit?: () => void;
}) {
  const set = (patch: Partial<TaskFormValue>) => onChange({ ...value, ...patch });
  const errors = taskFormErrors(value);
  const titleError = showTitleError ? errors.title : null;

  const assigneeItems = {
    [ASSIGNEE_ME]: "나에게 배정",
    ...Object.fromEntries(members.map((m) => [m.id, m.name])),
  };
  const projectItems = projects
    ? { [NO_PROJECT]: "프로젝트 없음", ...Object.fromEntries(projects.map((p) => [p.id, p.name])) }
    : null;

  return (
    <div className="flex flex-col gap-3">
      <Field>
        <FieldLabel htmlFor={`${idPrefix}-title`}>
          작업 이름
          <span className="ml-0.5 text-[var(--que-error)]" aria-hidden>
            *
          </span>
          <span className="sr-only">(필수)</span>
        </FieldLabel>
        <Input
          id={`${idPrefix}-title`}
          value={value.title}
          onChange={(e) => set({ title: e.target.value })}
          onKeyDown={(e) => {
            if (e.key === "Enter" && onSubmit) onSubmit();
          }}
          placeholder="예: 상세페이지 QA"
          className="h-10"
          required
          aria-required
          aria-invalid={titleError ? true : undefined}
          autoFocus={autoFocusTitle}
        />
        {titleError && <p className="text-sm text-destructive">{titleError}</p>}
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field>
          <FieldLabel>담당자</FieldLabel>
          <Select
            items={assigneeItems}
            value={value.assigneeId}
            onValueChange={(v) => set({ assigneeId: (v as string) ?? ASSIGNEE_ME })}
          >
            <SelectTrigger aria-label="담당자 선택" className="h-10 min-h-10 w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ASSIGNEE_ME}>나에게 배정</SelectItem>
              {members.map((m) => (
                <SelectItem key={m.id} value={m.id}>
                  {m.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>

        {projectItems ? (
          <Field>
            <FieldLabel>프로젝트</FieldLabel>
            <Select
              items={projectItems}
              value={value.projectId}
              onValueChange={(v) => set({ projectId: (v as string) ?? NO_PROJECT })}
            >
              <SelectTrigger aria-label="프로젝트 선택" className="h-10 min-h-10 w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NO_PROJECT}>프로젝트 없음</SelectItem>
                {projects!.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        ) : (
          <Field>
            <FieldLabel>우선순위</FieldLabel>
            <PrioritySelect value={value.priority} onChange={(p) => set({ priority: p })} />
          </Field>
        )}
      </div>

      {/* 시작·마감 — 날짜만 넣어도 되고(기간 작업, 간트 막대), 시간까지 넣으면 캘린더 시간대에 얹힌다. */}
      <div className="grid grid-cols-2 gap-3">
        <Field>
          <FieldLabel htmlFor={`${idPrefix}-start-date`}>시작일</FieldLabel>
          <Input
            id={`${idPrefix}-start-date`}
            type="date"
            value={value.startDate}
            onChange={(e) => set({ startDate: e.target.value })}
            className="h-10"
          />
        </Field>
        <Field>
          <FieldLabel htmlFor={`${idPrefix}-start-time`}>시작 시간</FieldLabel>
          <Input
            id={`${idPrefix}-start-time`}
            type="time"
            value={value.startTime}
            onChange={(e) => set({ startTime: e.target.value })}
            className="h-10"
            disabled={!value.startDate}
          />
        </Field>
        <Field>
          <FieldLabel htmlFor={`${idPrefix}-due-date`}>마감일</FieldLabel>
          <Input
            id={`${idPrefix}-due-date`}
            type="date"
            value={value.dueDate}
            onChange={(e) => set({ dueDate: e.target.value })}
            className="h-10"
            aria-invalid={errors.range ? true : undefined}
          />
        </Field>
        <Field>
          <FieldLabel htmlFor={`${idPrefix}-due-time`}>마감 시간</FieldLabel>
          <Input
            id={`${idPrefix}-due-time`}
            type="time"
            value={value.dueTime}
            onChange={(e) => set({ dueTime: e.target.value })}
            className="h-10"
            disabled={!value.dueDate}
            aria-invalid={errors.range ? true : undefined}
          />
        </Field>
      </div>
      {errors.range && <p className="-mt-1 text-sm text-destructive">{errors.range}</p>}

      {projectItems && (
        <div className="grid grid-cols-2 gap-3">
          <Field>
            <FieldLabel>우선순위</FieldLabel>
            <PrioritySelect value={value.priority} onChange={(p) => set({ priority: p })} />
          </Field>
        </div>
      )}

      <Field>
        <FieldLabel htmlFor={`${idPrefix}-desc`}>설명</FieldLabel>
        <Textarea
          id={`${idPrefix}-desc`}
          rows={2}
          value={value.description}
          onChange={(e) => set({ description: e.target.value })}
          placeholder="선택 사항"
        />
      </Field>
    </div>
  );
}

function PrioritySelect({
  value,
  onChange,
}: {
  value: TaskFormValue["priority"];
  onChange: (p: TaskFormValue["priority"]) => void;
}) {
  return (
    <Select
      items={PRIORITY_ITEMS}
      value={value}
      onValueChange={(v) => onChange((v as TaskFormValue["priority"]) ?? "normal")}
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
  );
}
