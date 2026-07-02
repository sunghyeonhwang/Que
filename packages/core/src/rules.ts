import {
  scheduleRangeSchema,
  statusDetailSchema,
  type ActionItem,
  type CalendarEvent,
  type MeetingNote,
  type Project,
  type ScheduleRange,
  type StatusDetail,
  type Task,
  type TaskStatus,
  type User,
} from "./domain";

// 도메인 규칙 (CLAUDE.md "도메인 규칙"). UI가 아니라 이 계층에서 강제한다.
// 웹/MCP/CLI 어디서 호출하든 동일하게 적용된다.

export type QueRuleCode =
  | "STATUS_DETAIL_REQUIRED"
  | "ACTION_NEEDS_ASSIGNEE_AND_DUE"
  | "ACTION_ALREADY_RESOLVED"
  | "ALREADY_ANSWERED"
  | "INVALID_INPUT"
  | "EVENT_NOT_MOVABLE"
  | "INVALID_SCHEDULE"
  | "NOT_AUTHORIZED"
  | "NOT_FOUND";

export class QueRuleError extends Error {
  readonly code: QueRuleCode;

  constructor(code: QueRuleCode, message: string) {
    super(message);
    this.name = "QueRuleError";
    this.code = code;
  }
}

/** QueRuleError 판별 — `instanceof`만 쓰면 dev(HMR/Turbopack)에서 모듈이 이중 로딩될 때
 *  클래스 정체성이 갈라져 규칙 에러가 500으로 새는 결함이 있었다 (글래도스 발견).
 *  덕 타이핑을 병행해 모듈 경계와 무관하게 안전하게 잡는다. */
export function isQueRuleError(error: unknown): error is QueRuleError {
  if (error instanceof QueRuleError) return true;
  return (
    error instanceof Error &&
    error.name === "QueRuleError" &&
    typeof (error as { code?: unknown }).code === "string"
  );
}

/** 문제발생/홀드는 사유 등 추가 정보를 반드시 받는다. */
export const STATUS_REQUIRES_DETAIL: readonly TaskStatus[] = ["issue", "on_hold"];

export function assertStatusDetail(
  to: TaskStatus,
  detail: StatusDetail | undefined,
): void {
  if (!STATUS_REQUIRES_DETAIL.includes(to)) return;
  const parsed = statusDetailSchema.safeParse(detail);
  if (!parsed.success) {
    throw new QueRuleError(
      "STATUS_DETAIL_REQUIRED",
      "문제발생/홀드 전환에는 사유가 필요하다 (다음 액션, 도움 필요한 사람, 재확인 시간 권장)",
    );
  }
}

/** 본인, 프로젝트 담당자, 관리자만 작업을 수정할 수 있다. 그 외는 요청만 가능. */
export function canEditTask(actor: User, task: Task, project?: Project): boolean {
  if (actor.role === "admin") return true;
  if (task.assigneeId === actor.id || task.ownerId === actor.id) return true;
  if (project && project.ownerId === actor.id && task.projectId === project.id) return true;
  return false;
}

export function assertCanEditTask(actor: User, task: Task, project?: Project): void {
  if (!canEditTask(actor, task, project)) {
    throw new QueRuleError(
      "NOT_AUTHORIZED",
      `${actor.name}은(는) 이 작업을 수정할 수 없다. 댓글/도움 요청/상태 확인 요청만 가능하다.`,
    );
  }
}

/** 외부 회사 캘린더 원본 일정과 비공개(자리비움) 일정은 이동/수정 불가. */
export function canMoveCalendarEvent(event: CalendarEvent): boolean {
  return event.source === "que" && event.visibility !== "private";
}

export function assertCanMoveCalendarEvent(event: CalendarEvent): void {
  if (!canMoveCalendarEvent(event)) {
    throw new QueRuleError(
      "EVENT_NOT_MOVABLE",
      "외부 회사 캘린더 원본 일정과 비공개 일정은 Que에서 이동할 수 없다",
    );
  }
}

/** 담당자와 마감일이 모두 있어야 Action을 Task로 확정할 수 있다. */
export function canConfirmActionItem(item: ActionItem): boolean {
  return Boolean(item.assigneeId) && Boolean(item.dueAt);
}

export function assertCanConfirmActionItem(item: ActionItem): void {
  // 이미 생성된 Action의 재확정은 중복 Task를 만든다. 무시된 Action은 먼저 되돌려야 한다.
  // (보류(held)는 나중에 확정하는 것이 정상 흐름이므로 허용)
  if (item.status === "created" || item.status === "ignored") {
    throw new QueRuleError(
      "ACTION_ALREADY_RESOLVED",
      `이미 처리된 Action이다 (${item.status}) — 재확정할 수 없다`,
    );
  }
  if (!canConfirmActionItem(item)) {
    throw new QueRuleError(
      "ACTION_NEEDS_ASSIGNEE_AND_DUE",
      "담당자 또는 마감일이 없는 Action은 Task로 생성하지 않는다 — 확인 필요 상태로 남긴다",
    );
  }
}

/** Action 후보의 처리(보류/무시)는 담당자, 회의록 업로더, 관리자만 할 수 있다. */
export function canResolveActionItem(
  actor: User,
  item: ActionItem,
  note?: MeetingNote,
): boolean {
  if (actor.role === "admin") return true;
  if (item.assigneeId === actor.id) return true;
  if (note && note.uploaderId === actor.id) return true;
  return false;
}

export function assertCanResolveActionItem(
  actor: User,
  item: ActionItem,
  note?: MeetingNote,
): void {
  if (!canResolveActionItem(actor, item, note)) {
    throw new QueRuleError(
      "NOT_AUTHORIZED",
      "Action 처리(확정/보류/무시)는 담당자, 회의록 업로더, 관리자만 할 수 있다",
    );
  }
}

/** 일정 이동 입력 검증. 외부 입력(MCP/CLI)을 신뢰하지 않는다. */
export function parseScheduleRange(input: {
  startAt: string;
  endAt: string;
}): ScheduleRange {
  const parsed = scheduleRangeSchema.safeParse(input);
  if (!parsed.success) {
    throw new QueRuleError(
      "INVALID_SCHEDULE",
      `유효하지 않은 일정 범위: ${parsed.error.issues.map((i) => i.message).join(", ")}`,
    );
  }
  return parsed.data;
}
