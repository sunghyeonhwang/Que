import {
  scheduleRangeSchema,
  statusDetailSchema,
  visibilitySchema,
  type ActionItem,
  type CalendarEvent,
  type MeetingNote,
  type Project,
  type RecurringTemplate,
  type ScheduleRange,
  type StatusDetail,
  type StatusLog,
  type Task,
  type TaskStatus,
  type User,
  type Visibility,
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

/**
 * "도움 필요한 사람"을 항상 배열로 정규화한다. StatusDetail(입력)과 StatusLog(저장) 양쪽에서
 * 단일 레거시(helpUserId)와 다중(helpUserIds)이 공존할 수 있으므로, 읽는 쪽은 모두 이 함수를 거친다.
 * helpUserIds가 있으면 그것을, 없으면 레거시 단일값을 배열로 승격한다(중복 제거).
 */
export function helpUserIdsOf(
  source: { helpUserId?: string; helpUserIds?: string[] } | undefined,
): string[] {
  if (!source) return [];
  const ids = source.helpUserIds?.length
    ? source.helpUserIds
    : source.helpUserId
      ? [source.helpUserId]
      : [];
  return [...new Set(ids.filter((id) => id.length > 0))];
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

/**
 * 비공개 일정의 원본 제목/사유를 볼 수 있는가. 본인이거나 관리자면 상세를 본다.
 * 그 외 팀원에게는 `자리비움`으로만 보여야 한다 (기획서 "권한과 공개 범위" 161행, 2026-07-03 확정).
 */
export function canViewPrivateEventDetail(event: CalendarEvent, viewer: User): boolean {
  return event.ownerId === viewer.id || viewer.role === "admin";
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

/**
 * 회의록 열람 권한. `admin` 등급은 관리자/업로더만, `restricted`는 지정 인원(+관리자·업로더)만
 * 볼 수 있다 (기획서 "회의록 업로드" 절, 2026-07-03 확정 — 예: 연봉협상 회의록은 당사자와 대표만).
 */
export function canViewMeetingNote(
  viewer: User,
  note: Pick<MeetingNote, "uploaderId" | "visibility" | "restrictedUserIds">,
): boolean {
  if (viewer.role === "admin" || note.uploaderId === viewer.id) return true;
  if (note.visibility === "admin") return false;
  if (note.visibility === "restricted") return (note.restrictedUserIds ?? []).includes(viewer.id);
  return true;
}

/** 반복 업무 템플릿은 만든 사람과 관리자만 켜고 끌 수 있다. */
export function canManageRecurringTemplate(actor: User, template: RecurringTemplate): boolean {
  return actor.role === "admin" || template.createdBy === actor.id;
}

export function assertCanManageRecurringTemplate(actor: User, template: RecurringTemplate): void {
  if (!canManageRecurringTemplate(actor, template)) {
    throw new QueRuleError(
      "NOT_AUTHORIZED",
      "반복 업무 템플릿은 만든 사람과 관리자만 수정할 수 있다",
    );
  }
}

/** 마일스톤은 프로젝트 담당자(owner)와 관리자만 만들고/수정/이동할 수 있다. */
export function canManageMilestone(actor: User, project: Project | undefined): boolean {
  return actor.role === "admin" || project?.ownerId === actor.id;
}

/** 클라이언트(거래처) 생성·수정은 관리자만 할 수 있다 (8인 MVP 운영 정책). */
export function canManageClient(actor: User): boolean {
  return actor.role === "admin";
}

/**
 * 프로젝트 생성·수정 권한. 생성은 관리자만(project 미지정으로 호출),
 * 수정은 관리자 또는 프로젝트 담당자(owner)다 (canManageMilestone과 같은 패턴).
 */
export function canManageProject(actor: User, project?: Project): boolean {
  return actor.role === "admin" || project?.ownerId === actor.id;
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

/**
 * 특정 작업의 특정 상태로 전환된 "가장 최근" StatusLog를 고른다.
 *
 * 배열 순서(push 순서)에 기대지 않고 항상 createdAt(ISO 8601 문자열) 최대값으로 판정한다.
 * mock-db는 우연히 시간순이지만 Supabase 어댑터의 select("*")는 순서를 보장하지 않으므로
 * 조회 지점에서 명시적으로 정렬해야 최신 로그가 뽑힌다. ISO 8601은 사전순=시간순이라
 * localeCompare로 안전하게 비교한다.
 */
export function latestStatusLog(
  logs: readonly StatusLog[],
  taskId: string,
  toStatus: TaskStatus,
): StatusLog | undefined {
  let latest: StatusLog | undefined;
  for (const log of logs) {
    if (log.taskId !== taskId || log.toStatus !== toStatus) continue;
    if (!latest || log.createdAt.localeCompare(latest.createdAt) > 0) latest = log;
  }
  return latest;
}

/**
 * Que 캘린더 일정 생성 시 공개 범위 검증. 기본은 team, private 허용, 그 외는 거부한다.
 * source(회사/que)와 ownerId는 생성 입력에 아예 받지 않고 서버가 고정하므로(외부 회사 일정·타인
 * 소유 위조를 타입 차원에서 차단), 이 계층에서 별도 검증할 표면은 공개 범위뿐이다.
 * 시각(startAt≤endAt)은 parseScheduleRange가, 참석자 실재는 데이터 계층이 강제한다.
 */
export function parseEventVisibility(input: unknown): Visibility {
  const parsed = visibilitySchema.safeParse(input ?? "team");
  if (!parsed.success) {
    throw new QueRuleError("INVALID_INPUT", "공개 범위는 team 또는 private 이어야 한다");
  }
  return parsed.data;
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
