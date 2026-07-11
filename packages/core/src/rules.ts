import {
  scheduleRangeSchema,
  statusDetailSchema,
  visibilitySchema,
  type ActionItem,
  type CalendarEvent,
  type ChangeRequest,
  type KeyResult,
  type MeetingNote,
  type MilestoneRetro,
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
  | "ASSIGNEE_INACTIVE"
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

/** 결제 요청 분류(카테고리) 생성·수정·순서변경은 관리자만 할 수 있다 (클라이언트와 동일 정책). */
export function canManagePaymentCategory(actor: User): boolean {
  return actor.role === "admin";
}

/** 직원 관리(추가·비활성·복구·비밀번호 재설정)는 관리자만 할 수 있다 (항목 19).
 *  가장 위험한 경로라 페이지·서버 액션·전용 mutation(lib/auth/users.ts)이 이 헬퍼로 3중 강제한다. */
export function canManageUsers(actor: Pick<User, "role">): boolean {
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

// ---------- 선행 작업(의존성, E-9) ----------
// FS(Finish-to-Start) 단일 의미: predecessorIds의 작업들이 끝나야 이 작업을 시작한다.
// 같은 프로젝트 내에서만·자기 참조/순환 금지. UI가 아니라 여기서 강제한다(웹/MCP/CLI 공통).

/**
 * 선행 연결이 순환을 만드는지 검증한다. task가 nextPredecessorIds를 갖게 될 때,
 * 그 선행들의 (현재 저장된) 선행 사슬을 따라가 task 자신에 다시 도달하면 순환이다.
 * 방문 집합으로 중복 탐색을 막아 O(작업 수)에 끝난다.
 */
export function assertNoPredecessorCycle(
  taskId: string,
  nextPredecessorIds: readonly string[],
  taskById: ReadonlyMap<string, Task>,
): void {
  const visited = new Set<string>();
  const stack = [...nextPredecessorIds];
  while (stack.length > 0) {
    const id = stack.pop()!;
    if (id === taskId) {
      throw new QueRuleError(
        "INVALID_INPUT",
        "선행 작업이 순환합니다 — 서로가 서로를 기다리게 되어 연결할 수 없다",
      );
    }
    if (visited.has(id)) continue;
    visited.add(id);
    const t = taskById.get(id);
    if (t?.predecessorIds) stack.push(...t.predecessorIds);
  }
}

/** KR 진척 집계에서 제외하는 Task 상태(취소·병합은 완료율 분모/분자에서 뺀다). */
const KR_EXCLUDED_TASK_STATUS: ReadonlySet<TaskStatus> = new Set(["cancelled", "merged"]);

/**
 * KR 진척률(0~100) — 하이브리드 측정의 단일 계산기(기획 §2·§8-3). 웹·MCP·CLI 공용 순수 함수.
 * - manual: round(currentValue / targetValue * 100), 상한 100. targetValue가 없거나 0이면 0.
 * - task_auto: 연결 Task(keyResultId=kr.id, 취소·병합 제외) 중 done 비율(개수 기준, 가중치 없음).
 *   연결이 0건이면 0.
 * 소비처(보드·성과)는 이 단일 progress만 본다 — metricType 분기를 UI에 노출하지 않는다.
 */
export function keyResultProgress(kr: KeyResult, tasks: readonly Task[]): number {
  if (kr.metricType === "manual") {
    const target = kr.targetValue ?? 0;
    if (target <= 0) return 0;
    const current = kr.currentValue ?? 0;
    return Math.min(100, Math.round((current / target) * 100));
  }
  if (kr.metricType === "state") {
    // state — 상태 체크리스트 done 비율(개수 기준). 항목이 없으면 0.
    const checks = kr.stateChecks ?? [];
    if (checks.length === 0) return 0;
    const done = checks.filter((c) => c.done).length;
    return Math.round((done / checks.length) * 100);
  }
  // task_auto — 연결 Task 완료율(개수 기준). 취소·병합은 분모에서 제외.
  const linked = tasks.filter(
    (t) => t.keyResultId === kr.id && !KR_EXCLUDED_TASK_STATUS.has(t.status),
  );
  if (linked.length === 0) return 0;
  const done = linked.filter((t) => t.status === "done").length;
  return Math.round((done / linked.length) * 100);
}

/** 실패 분류 주간 집계 결과(OS-2a 부록 B). 주간 통합 회의 ⑴에 주입한다. */
/** 외부 변경 SLA 판정(부록 C·글래도스 게이트 High-1) — **영향 분석 전(stage=received)에만** 발화한다.
 *  분석이 끝난 건(impact_analyzed 이후)은 마감이 지났어도 재촉·에스컬레이션 대상이 아니다
 *  (허위 경보가 매일 반복되는 회귀의 재발 방지). 12h 전=remind, 마감 초과=esc. */
export function changeRequestSlaState(
  cr: Pick<ChangeRequest, "stage" | "impactDeadline">,
  now: Date,
  remindBeforeMs = 12 * 60 * 60 * 1000,
): "remind" | "esc" | null {
  if (cr.stage !== "received") return null;
  const deadlineMs = Date.parse(cr.impactDeadline);
  if (Number.isNaN(deadlineMs)) return null;
  const nowMs = now.getTime();
  if (nowMs >= deadlineMs) return "esc";
  if (nowMs >= deadlineMs - remindBeforeMs) return "remind";
  return null;
}

export interface RetroWeekSummary {
  /** 내부 원인 회고 수. */
  internal: number;
  /** 외부 원인 회고 수. */
  external: number;
  /** 대응 프로세스를 탄(managed=true) 회고 수. */
  managed: number;
}

/**
 * 지난 7일(now 기준, [now-7d, now]) 마일스톤 회고를 내부/외부/관리됨으로 집계한다(OS-2a 부록 B).
 * 주간 통합 회의 ⑴("지난주 실패 분류: 내부 N · 외부 N(관리됨 M)")·분기 회고 추이의 단일 집계기.
 * 순수 함수 — db는 milestoneRetros 배열만 요구한다(웹/MCP/CLI 공용). 미래(now 이후) 회고는 제외.
 */
export function retroSummaryForWeek(
  db: { milestoneRetros: readonly MilestoneRetro[] },
  now: Date = new Date(),
): RetroWeekSummary {
  const end = now.getTime();
  const start = end - 7 * 24 * 60 * 60 * 1000;
  let internal = 0;
  let external = 0;
  let managed = 0;
  for (const r of db.milestoneRetros) {
    const ms = Date.parse(r.createdAt);
    if (Number.isNaN(ms) || ms < start || ms > end) continue;
    if (r.cause === "internal") internal += 1;
    else external += 1;
    if (r.managed) managed += 1;
  }
  return { internal, external, managed };
}
