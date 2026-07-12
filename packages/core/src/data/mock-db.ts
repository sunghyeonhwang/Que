import type {
  ActionItem,
  CalendarEvent,
  ChangeLog,
  ChangeRequest,
  ChangeRequestStage,
  ChangeVia,
  CheckIn,
  CheckInResponse,
  Client,
  KeyResult,
  KeyResultStatus,
  MeetingNote,
  Milestone,
  MilestoneRetro,
  Objective,
  ObjectiveStatus,
  RetroCause,
  RetroCauseDetail,
  StateCheck,
  StateCheckInput,
  PaymentCategory,
  PaymentRequest,
  PaymentStatus,
  Project,
  RecurrenceFrequency,
  RecurringTemplate,
  RevisionNote,
  RevisionNoteStatus,
  StandupEntry,
  StandupTeamSummary,
  StatusDetail,
  StatusLog,
  Task,
  TaskComment,
  TaskStatus,
  User,
} from "../domain";
import {
  type AlertRead,
  clientSchema,
  createChangeRequestInputSchema,
  createKeyResultInputSchema,
  createMilestoneRetroInputSchema,
  createObjectiveInputSchema,
  createRevisionNoteInputSchema,
  keyResultMetricTypeSchema,
  keyResultStatusSchema,
  milestoneSchema,
  objectiveStatusSchema,
  paymentCategorySchema,
  projectSchema,
  revisionNoteStatusSchema,
  submitStandupEntryInputSchema,
  taskSchema,
} from "../domain";
import { USERS } from "../mock/users";
import {
  QueRuleError,
  assertCanConfirmActionItem,
  assertCanEditTask,
  assertNoPredecessorCycle,
  assertCanManageRecurringTemplate,
  assertCanMoveCalendarEvent,
  assertCanResolveActionItem,
  assertStatusDetail,
  canManageClient,
  canManageMilestone,
  canManagePaymentCategory,
  canManageProject,
  canViewMeetingNote,
  helpUserIdsOf,
  latestStatusLog,
  parseEventVisibility,
  parseScheduleRange,
} from "../rules";
import type { CalendarProvider } from "../calendar-provider";
import { dedupKeyFor, type NotificationIntent, type NotificationOutboxEntry } from "../notifications";
import { createSeed } from "./seed";

// 인메모리 mock DB. 모든 변경(mutation)은 도메인 규칙을 통과해야 하고
// ChangeLog에 via(web|mcp|cli)와 함께 기록된다.
// Phase B(API 계층)에서 같은 인터페이스의 API 어댑터로 교체한다.

export interface QueDb {
  users: User[];
  clients: Client[];
  projects: Project[];
  milestones: Milestone[];
  tasks: Task[];
  calendarEvents: CalendarEvent[];
  meetingNotes: MeetingNote[];
  actionItems: ActionItem[];
  paymentCategories: PaymentCategory[];
  paymentRequests: PaymentRequest[];
  statusLogs: StatusLog[];
  changeLogs: ChangeLog[];
  checkIns: CheckIn[];
  taskComments: TaskComment[];
  recurringTemplates: RecurringTemplate[];
  revisionNotes: RevisionNote[];
  standupEntries: StandupEntry[];
  standupTeamSummaries: StandupTeamSummary[];
  objectives: Objective[];
  keyResults: KeyResult[];
  milestoneRetros: MilestoneRetro[];
  changeRequests: ChangeRequest[];
}

interface ActorContext {
  actorId: string;
  via: ChangeVia;
}

export class MockQueDb implements QueDb {
  users: User[];
  clients: Client[];
  projects: Project[];
  milestones: Milestone[];
  tasks: Task[];
  calendarEvents: CalendarEvent[];
  meetingNotes: MeetingNote[];
  actionItems: ActionItem[];
  paymentCategories: PaymentCategory[];
  paymentRequests: PaymentRequest[];
  statusLogs: StatusLog[];
  changeLogs: ChangeLog[];
  checkIns: CheckIn[];
  taskComments: TaskComment[];
  recurringTemplates: RecurringTemplate[];
  revisionNotes: RevisionNote[];
  standupEntries: StandupEntry[];
  standupTeamSummaries: StandupTeamSummary[];
  objectives: Objective[];
  keyResults: KeyResult[];
  milestoneRetros: MilestoneRetro[];
  changeRequests: ChangeRequest[];
  /** Slack 발송 원장(B-1). 시드에 없다 — mutation 훅이 enqueue로 채운다. Supabase 어댑터가 load에서 덮어쓴다. */
  notificationOutbox: NotificationOutboxEntry[] = [];
  /** 알림 읽음 표시(C-3a). 시드에 없다 — markAlertsRead가 채운다. Supabase 어댑터가 load에서 덮어쓴다. */
  alertReads: AlertRead[] = [];

  private seq = 0;
  private readonly clock: () => Date;

  constructor(now: Date = new Date(), clock?: () => Date) {
    this.clock = clock ?? (() => new Date());
    const seed = createSeed(now);
    this.users = [...USERS];
    this.clients = seed.clients;
    this.projects = seed.projects;
    this.milestones = seed.milestones;
    this.tasks = seed.tasks;
    this.calendarEvents = seed.calendarEvents;
    this.meetingNotes = seed.meetingNotes;
    this.actionItems = seed.actionItems;
    this.paymentCategories = seed.paymentCategories;
    this.paymentRequests = seed.paymentRequests;
    this.statusLogs = seed.statusLogs;
    this.changeLogs = seed.changeLogs;
    this.checkIns = seed.checkIns;
    this.taskComments = seed.taskComments;
    this.recurringTemplates = seed.recurringTemplates;
    this.revisionNotes = seed.revisionNotes;
    this.standupEntries = seed.standupEntries;
    this.standupTeamSummaries = seed.standupTeamSummaries;
    this.objectives = seed.objectives;
    this.keyResults = seed.keyResults;
    this.milestoneRetros = seed.milestoneRetros;
    this.changeRequests = seed.changeRequests;
  }

  // ---------- 조회 ----------

  requireUser(id: string): User {
    const user = this.users.find((u) => u.id === id);
    if (!user) throw new QueRuleError("NOT_FOUND", `사용자 없음: ${id}`);
    return user;
  }

  /** 담당자 지정 전용 검증 — 존재 + 재직(active) 확인. 비활성(deactivate) 사용자는 새 작업 배정 대상이
   *  될 수 없다. UI 로스터 필터가 닿지 않는 MCP/CLI/API 경로까지 덮는 유일한 방어선이라 core에 둔다.
   *  actor(요청자) 검증에는 쓰지 말 것 — actor는 requireUser로만 검증한다(비활성 actor는 인증에서 걸림). */
  requireActiveAssignee(id: string): User {
    const user = this.requireUser(id);
    if (user.active === false) {
      throw new QueRuleError(
        "ASSIGNEE_INACTIVE",
        `비활성(퇴사/정지) 사용자에게는 작업을 배정할 수 없다: ${user.name}`,
      );
    }
    return user;
  }

  requireTask(id: string): Task {
    const task = this.tasks.find((t) => t.id === id);
    if (!task) throw new QueRuleError("NOT_FOUND", `작업 없음: ${id}`);
    return task;
  }

  projectOf(task: Task): Project | undefined {
    return this.projects.find((p) => p.id === task.projectId);
  }

  clientById(id: string | undefined): Client | undefined {
    if (!id) return undefined;
    return this.clients.find((c) => c.id === id);
  }

  /** 프로젝트의 상위 클라이언트(거래처). clientId가 없으면(내부 잡무) undefined. */
  clientOf(project: Project | undefined): Client | undefined {
    return this.clientById(project?.clientId);
  }

  /**
   * 클라이언트 필터용 조회 헬퍼. clientId 미지정이면 전체 작업을 그대로 돌려준다.
   * 특정 클라이언트를 주면 그 클라이언트 소속 프로젝트의 작업만 — 무소속 작업(projectId 없음
   * 또는 project.clientId 없음)은 제외한다. (표시/집계 소스 필터용. ID→작업 조회 맵에는 쓰지 말 것.)
   * MCP/CLI의 `--client` 필터가 재사용할 수 있게 core 계층에 둔다.
   */
  tasksForClient(clientId: string | undefined): Task[] {
    if (!clientId) return this.tasks;
    const projectIds = new Set(
      this.projects.filter((p) => p.clientId === clientId).map((p) => p.id),
    );
    return this.tasks.filter((t) => t.projectId !== undefined && projectIds.has(t.projectId));
  }

  // ---------- 변경 ----------

  /** 작업 상태 변경. 문제발생/홀드는 사유 필수, 병합(merged)은 대상 작업 필수.
   *  StatusLog + ChangeLog 기록. */
  changeTaskStatus(
    ctx: ActorContext,
    input: {
      taskId: string;
      to: TaskStatus;
      detail?: StatusDetail;
      /** to가 merged일 때 필수 — 어느 작업으로 합치는지 */
      mergedIntoTaskId?: string;
    },
  ): Task {
    const actor = this.requireUser(ctx.actorId);
    const task = this.requireTask(input.taskId);
    assertCanEditTask(actor, task, this.projectOf(task));
    assertStatusDetail(input.to, input.detail);
    if (input.to === "merged") {
      if (!input.mergedIntoTaskId) {
        throw new QueRuleError("INVALID_INPUT", "병합에는 대상 작업(mergedIntoTaskId)이 필요하다");
      }
      if (input.mergedIntoTaskId === task.id) {
        throw new QueRuleError("INVALID_INPUT", "자기 자신과는 병합할 수 없다");
      }
      this.requireTask(input.mergedIntoTaskId); // 대상 존재 검증
    }

    const from = task.status;
    const nowIso = this.now();
    task.status = input.to;
    if (input.to === "merged") task.mergedIntoTaskId = input.mergedIntoTaskId;
    // 취소·병합되는 작업은 선행 의미를 잃는다 — 걸린 링크를 자동 정리(E-9, 데드락 방지).
    if ((input.to === "cancelled" || input.to === "merged") && from !== input.to) {
      this.clearPredecessorLinks(ctx, task, input.to === "cancelled" ? "작업 취소" : "작업 병합");
    }
    task.lastChangedBy = actor.id;
    task.lastChangedAt = nowIso;

    // 도움 필요한 사람은 단일/다중이 섞여 들어올 수 있으므로 배열로 정규화해 저장한다.
    // 레거시 컬럼(help_user_id)엔 첫 번째를 넣어 FK·하위호환을 유지하고,
    // help_user_ids(text[])엔 전체를 담는다(비어 있으면 undefined → 컬럼 null).
    const helpIds = helpUserIdsOf(input.detail);
    this.statusLogs.push({
      id: this.nextId("slog"),
      taskId: task.id,
      actorId: actor.id,
      fromStatus: from,
      toStatus: input.to,
      reason: input.detail?.reason,
      nextAction: input.detail?.nextAction,
      helpUserId: helpIds[0],
      helpUserIds: helpIds.length > 0 ? helpIds : undefined,
      nextCheckAt: input.detail?.recheckAt,
      createdAt: nowIso,
    });
    this.logChange(ctx, {
      entityType: "task",
      entityId: task.id,
      changeType: "status_change",
      beforeValue: from,
      afterValue: input.to,
      reason: input.detail?.reason,
    });
    return task;
  }

  /** 작업 담당자 변경. 기존 편집 권한(본인·소유자·프로젝트 담당·관리자)을 재사용한다.
   *  미응답 체크인은 새 담당자로 이관하고(응답 완료 체크인은 이력이라 건드리지 않는다),
   *  ChangeLog에 담당 이전을 via와 함께 남긴다. */
  reassignTask(ctx: ActorContext, input: { taskId: string; assigneeId: string }): Task {
    const actor = this.requireUser(ctx.actorId);
    const task = this.requireTask(input.taskId);
    assertCanEditTask(actor, task, this.projectOf(task));
    const newAssignee = this.requireActiveAssignee(input.assigneeId); // 실재 + 재직 검증(비활성 배정 거부)
    if (task.assigneeId === newAssignee.id) {
      throw new QueRuleError("INVALID_INPUT", "이미 이 담당자에게 배정된 작업이다");
    }
    const prevAssignee = this.users.find((u) => u.id === task.assigneeId);
    const nowIso = this.now();
    task.assigneeId = newAssignee.id;
    task.lastChangedBy = actor.id;
    task.lastChangedAt = nowIso;

    // 미응답(answeredAt 없음) 체크인은 새 담당자에게 넘긴다 — 안 하면 전 담당자가 남의 체크인을 받는다.
    for (const checkIn of this.checkIns) {
      if (checkIn.taskId === task.id && !checkIn.answeredAt) {
        checkIn.assigneeId = newAssignee.id;
      }
    }

    this.logChange(ctx, {
      entityType: "task",
      entityId: task.id,
      changeType: "update",
      beforeValue: `담당: ${prevAssignee?.name ?? task.assigneeId}`,
      afterValue: `담당: ${newAssignee.name}`,
    });
    return task;
  }

  /**
   * 선행 연결 정리(E-9) — 이 작업이 걸린 선행 링크를 모두 끊는다: 자기 선행 목록 해제 +
   * 자기를 선행으로 가진 후행들에서 제거. **취소·병합·프로젝트 이동 시 자동 호출** —
   * 안 하면 취소된(또는 다른 프로젝트로 간) 선행이 잔존해 후행의 선행 편집이 규칙 검증에
   * 막히는 데드락이 생긴다. 각 후행에 ChangeLog를 남겨 "왜 연결이 풀렸는지" 추적 가능하게 한다.
   */
  private clearPredecessorLinks(ctx: ActorContext, task: Task, cause: string): void {
    if (task.predecessorIds?.length) {
      task.predecessorIds = undefined;
      this.logChange(ctx, {
        entityType: "task",
        entityId: task.id,
        changeType: "update",
        beforeValue: "선행 작업 연결됨",
        afterValue: `선행 작업 전체 해제 (${cause})`,
      });
    }
    for (const t of this.tasks) {
      if (!t.predecessorIds?.includes(task.id)) continue;
      const rest = t.predecessorIds.filter((id) => id !== task.id);
      t.predecessorIds = rest.length > 0 ? rest : undefined;
      this.logChange(ctx, {
        entityType: "task",
        entityId: t.id,
        changeType: "update",
        beforeValue: `선행 작업: '${task.title}' 포함`,
        afterValue: `선행 '${task.title}' 해제 (${cause})`,
      });
    }
  }

  /**
   * 선행 작업(의존성) 설정 — E-9. FS(끝나야 시작) 단일 의미, 전체 교체 시맨틱(빈 배열 = 전부 해제).
   * 규칙(UI가 아니라 여기서 강제, 웹/MCP/CLI 공통):
   * - 프로젝트에 속한 작업만 연결 가능하고, 선행도 **같은 프로젝트** 작업만.
   * - 자기 자신 금지 · 취소/병합된 작업 금지 · 순환 금지(assertNoPredecessorCycle) · 최대 20개.
   * - 권한은 기존 편집 규칙(canEditTask) 그대로.
   */
  setTaskPredecessors(
    ctx: ActorContext,
    input: { taskId: string; predecessorIds: string[] },
  ): Task {
    const actor = this.requireUser(ctx.actorId);
    const task = this.requireTask(input.taskId);
    assertCanEditTask(actor, task, this.projectOf(task));

    if (!task.projectId) {
      throw new QueRuleError("INVALID_INPUT", "프로젝트에 속한 작업만 선행 작업을 연결할 수 있다");
    }
    const next = [...new Set(input.predecessorIds)]; // 중복 제거(입력 순서 유지)
    if (next.length > 20) {
      throw new QueRuleError("INVALID_INPUT", "선행 작업은 최대 20개까지 연결할 수 있다");
    }
    // 실재·같은 프로젝트·취소/병합 검사는 **새로 추가되는 id에만** 적용한다(grandfather) —
    // 정리 훅이 놓친 잔재(과거 데이터)가 있어도 기존 연결의 유지·해제는 항상 가능해야
    // 편집이 막히지 않는다. 자기 참조·순환·최대 개수는 전체에 적용.
    const prevSet = new Set(task.predecessorIds ?? []);
    for (const id of next) {
      if (id === task.id) {
        throw new QueRuleError("INVALID_INPUT", "자기 자신을 선행 작업으로 연결할 수 없다");
      }
      if (prevSet.has(id)) continue;
      const p = this.tasks.find((t) => t.id === id);
      if (!p) throw new QueRuleError("NOT_FOUND", `선행 작업 없음: ${id}`);
      if (p.projectId !== task.projectId) {
        throw new QueRuleError("INVALID_INPUT", `같은 프로젝트의 작업만 선행으로 연결할 수 있다: ${p.title}`);
      }
      if (p.status === "cancelled" || p.status === "merged") {
        throw new QueRuleError("INVALID_INPUT", `취소·병합된 작업은 선행으로 연결할 수 없다: ${p.title}`);
      }
    }
    assertNoPredecessorCycle(task.id, next, new Map(this.tasks.map((t) => [t.id, t])));

    const prev = task.predecessorIds ?? [];
    const same = prev.length === next.length && prev.every((id, i) => id === next[i]);
    if (same) return task; // 무변경 — 로그를 남기지 않는다

    const nameOf = (ids: readonly string[]) =>
      ids.length === 0
        ? "(없음)"
        : ids.map((id) => this.tasks.find((t) => t.id === id)?.title ?? id).join(", ");
    task.predecessorIds = next.length > 0 ? next : undefined;
    task.lastChangedBy = actor.id;
    task.lastChangedAt = this.now();
    this.logChange(ctx, {
      entityType: "task",
      entityId: task.id,
      changeType: "update",
      beforeValue: `선행 작업: ${nameOf(prev)}`,
      afterValue: `선행 작업: ${nameOf(next)}`,
    });
    return task;
  }

  /** 작업 삭제 = 취소(cancelled) soft 전환. hard delete가 아니라 상태만 바꿔 데이터·이력을 보존한다.
   *  복구는 changeTaskStatus로 cancelled → 다른 상태로 되돌리면 된다(별도 제약 없음).
   *  이전 status를 함께 돌려줘 호출부의 실행취소(undo)에 쓸 수 있게 한다.
   *  StatusLog·ChangeLog 기록은 changeTaskStatus에 위임해 다른 상태 변경과 완전히 동일하게 남긴다. */
  cancelTask(
    ctx: ActorContext,
    input: { taskId: string; reason?: string },
  ): { task: Task; previousStatus: TaskStatus; previousStatusDetail?: StatusDetail } {
    const actor = this.requireUser(ctx.actorId);
    const task = this.requireTask(input.taskId);
    assertCanEditTask(actor, task, this.projectOf(task));
    if (task.status === "cancelled") {
      throw new QueRuleError("INVALID_INPUT", "이미 취소된 작업이다");
    }
    const previousStatus = task.status;
    // issue/on_hold는 복구 시 detail(사유 등)이 필수다. 취소 전 최신 StatusLog에서 detail을
    // 스냅샷으로 잡아 반환한다 — 이게 없으면 실행취소가 STATUS_DETAIL_REQUIRED로 거부된다.
    let previousStatusDetail: StatusDetail | undefined;
    if (previousStatus === "issue" || previousStatus === "on_hold") {
      const log = latestStatusLog(this.statusLogs, task.id, previousStatus);
      if (log?.reason) {
        const helpIds = helpUserIdsOf(log);
        previousStatusDetail = {
          reason: log.reason,
          nextAction: log.nextAction,
          helpUserIds: helpIds.length > 0 ? helpIds : undefined,
          recheckAt: log.nextCheckAt,
        };
      }
    }
    const reason = input.reason?.trim();
    const updated = this.changeTaskStatus(ctx, {
      taskId: task.id,
      to: "cancelled",
      // cancelled는 사유가 선택이다(assertStatusDetail은 issue/on_hold만 강제). 있으면 로그에 남는다.
      detail: reason ? { reason } : undefined,
    });
    return { task: updated, previousStatus, previousStatusDetail };
  }

  /** 작업 일정 이동 (드래그 이동과 동일 규칙). 입력 날짜는 파싱을 통과해야 한다. */
  moveTask(
    ctx: ActorContext,
    input: { taskId: string; startAt: string; endAt: string },
  ): Task {
    const actor = this.requireUser(ctx.actorId);
    const task = this.requireTask(input.taskId);
    assertCanEditTask(actor, task, this.projectOf(task));
    const range = parseScheduleRange(input);

    const before = task.startAt;
    task.startAt = range.startAt;
    task.endAt = range.endAt;
    task.lastChangedBy = actor.id;
    task.lastChangedAt = this.now();

    this.logChange(ctx, {
      entityType: "task",
      entityId: task.id,
      changeType: "move",
      beforeValue: before,
      afterValue: input.startAt,
    });
    return task;
  }

  /** Que 일정 이동. 외부 회사 일정/비공개 일정은 거부된다. */
  moveCalendarEvent(
    ctx: ActorContext,
    input: { eventId: string; startAt: string; endAt: string },
  ): CalendarEvent {
    const actor = this.requireUser(ctx.actorId);
    const event = this.calendarEvents.find((e) => e.id === input.eventId);
    if (!event) throw new QueRuleError("NOT_FOUND", `일정 없음: ${input.eventId}`);
    assertCanMoveCalendarEvent(event);
    if (actor.role !== "admin" && event.ownerId !== actor.id) {
      throw new QueRuleError("NOT_AUTHORIZED", "본인 일정만 이동할 수 있다");
    }
    const range = parseScheduleRange(input);

    const before = event.startAt;
    event.startAt = range.startAt;
    event.endAt = range.endAt;
    event.lastChangedBy = actor.id;
    event.lastChangedAt = this.now();

    this.logChange(ctx, {
      entityType: "calendar_event",
      entityId: event.id,
      changeType: "move",
      beforeValue: before,
      afterValue: input.startAt,
    });
    return event;
  }

  /**
   * Que 캘린더 일정(회의 등) 생성. 일정 화면 "새로 추가"의 미팅 경로가 쓴다.
   *
   * 불변식 보호: source는 항상 "que", ownerId는 항상 actor로 서버가 고정한다 —
   * 입력에 source/ownerId를 아예 받지 않아 외부 회사 일정(source:"company")이나 타인 소유
   * 일정으로 위조하는 것을 타입 차원에서 차단한다(외부 일정은 syncExternalCalendar 전용).
   * 참석자는 실재 사용자만 허용(유령 id는 통째로 거부), 공개 범위는 team(기본)/private,
   * 시각은 startAt≤endAt(parseScheduleRange), 제목은 200자 이내(DB check와 동일 상한).
   * ChangeLog(create, entityType:"calendar_event")를 via와 함께 남긴다.
   */
  createCalendarEvent(
    ctx: ActorContext,
    input: {
      title: string;
      startAt: string;
      endAt: string;
      attendeeIds?: string[];
      visibility?: CalendarEvent["visibility"];
    },
  ): CalendarEvent {
    const actor = this.requireUser(ctx.actorId);
    const title = input.title.trim();
    if (!title) throw new QueRuleError("INVALID_INPUT", "일정 제목은 필수다");
    if (title.length > 200) throw new QueRuleError("INVALID_INPUT", "일정 제목은 200자 이내다");
    const range = parseScheduleRange({ startAt: input.startAt, endAt: input.endAt });
    // 공개 범위는 클라이언트 직렬화값 — enum을 런타임 검증한다(다른 mutation 선례).
    const visibility = parseEventVisibility(input.visibility);
    // 참석자는 실재 사용자만. 유령 id가 하나라도 있으면 통째로 거부(부분 반영 없음).
    const attendeeInput = input.attendeeIds ?? [];
    if (!Array.isArray(attendeeInput)) {
      throw new QueRuleError("INVALID_INPUT", "참석자 목록이 올바르지 않다");
    }
    for (const id of attendeeInput) this.requireUser(id); // 없으면 NOT_FOUND
    const attendeeIds = [...new Set(attendeeInput)]; // 중복 제거

    const nowIso = this.now();
    const event: CalendarEvent = {
      id: this.nextId("evt"),
      source: "que", // 서버 고정 — 외부 회사 일정 위조 차단
      title,
      ownerId: actor.id, // 서버 고정 — 타인 소유 위조 차단
      startAt: range.startAt,
      endAt: range.endAt,
      attendeeIds,
      visibility,
      lastChangedBy: actor.id,
      lastChangedAt: nowIso,
    };
    this.calendarEvents.push(event);
    this.logChange(ctx, {
      entityType: "calendar_event",
      entityId: event.id,
      changeType: "create",
      afterValue: event.title,
    });
    return event;
  }

  /** Action 후보를 Task로 확정. 담당자·마감일 없으면 거부하고 확인 필요로 남긴다.
   *  이미 처리된(created/ignored) Action의 재확정은 거부한다 — 중복 Task 방지.
   *
   *  overrides로 확정과 동시에 담당자·프로젝트·마감(dueAt) 및 Task 시간 블록(startAt/endAt)을
   *  지정할 수 있다(확인 다이얼로그에서 편집→확정 한 번에). startAt/endAt 미지정 시 마감 1시간
   *  전~마감을 기본 블록으로 부여한다. */
  confirmActionItem(
    ctx: ActorContext,
    actionItemId: string,
    overrides?: {
      assigneeId?: string;
      projectId?: string;
      dueAt?: string;
      startAt?: string;
      endAt?: string;
    },
  ): Task {
    const actor = this.requireUser(ctx.actorId);
    const item = this.requireActionItem(actionItemId);
    assertCanResolveActionItem(actor, item, this.meetingNoteOf(item));

    // 확정 전 편집: 아직 처리되지 않은 후보에만 override를 적용한다(이미 created/ignored면
    // 아래 assert가 거부하므로 필드를 건드리지 않는다 — 처리된 Action 오염 방지).
    if (overrides && item.status !== "created" && item.status !== "ignored") {
      if (overrides.assigneeId) {
        this.requireUser(overrides.assigneeId);
        item.assigneeId = overrides.assigneeId;
      }
      if (overrides.projectId) {
        if (!this.projects.some((p) => p.id === overrides.projectId)) {
          throw new QueRuleError("NOT_FOUND", `프로젝트 없음: ${overrides.projectId}`);
        }
        item.projectId = overrides.projectId;
      }
      if (overrides.dueAt) {
        item.dueAt = parseScheduleRange({ startAt: overrides.dueAt, endAt: overrides.dueAt }).startAt;
      }
    }

    try {
      assertCanConfirmActionItem(item);
    } catch (error) {
      // 담당자/마감일 누락으로 거부된 경우에만 확인 필요로 내리고, 그 변경도 기록한다.
      if (
        error instanceof QueRuleError &&
        error.code === "ACTION_NEEDS_ASSIGNEE_AND_DUE" &&
        item.status !== "needs_review"
      ) {
        const before = item.status;
        item.status = "needs_review";
        item.lastChangedBy = actor.id;
        item.lastChangedAt = this.now();
        this.logChange(ctx, {
          entityType: "action_item",
          entityId: item.id,
          changeType: "update",
          beforeValue: before,
          afterValue: "needs_review",
          reason: "담당자 또는 마감일 누락으로 확정 거부",
        });
      }
      throw error;
    }

    const nowIso = this.now();
    // 캘린더는 시간 그리드라 startAt이 없는 Task는 어떤 뷰에도 그려지지 않는다
    // (calendar-data의 `t.startAt && overlaps(...)` 필터). Action의 마감(dueAt)을
    // 종료로, 그 1시간 전을 시작으로 하는 기본 블록을 부여해 마감일 캘린더에 노출한다.
    // dueAt은 canConfirmActionItem이 이미 보장한다(담당자·마감 없는 Action은 위에서 거부).
    const dueMs = Date.parse(item.dueAt!);
    const defaultStart = Number.isNaN(dueMs)
      ? undefined
      : new Date(dueMs - 60 * 60 * 1000).toISOString();
    // 시간 블록: override로 시작/종료를 직접 받으면 그 값을(시작≤종료 검증), 없으면 기본 블록.
    let startAt = defaultStart;
    let endAt = item.dueAt;
    if (overrides?.startAt || overrides?.endAt) {
      const block = parseScheduleRange({
        startAt: overrides.startAt ?? defaultStart ?? item.dueAt!,
        endAt: overrides.endAt ?? item.dueAt!,
      });
      startAt = block.startAt;
      endAt = block.endAt;
    }
    const task: Task = {
      id: this.nextId("task"),
      // title/description은 DB check 제약(200/2000자)과 동일한 상한으로 절단
      title: item.title.slice(0, 200),
      ownerId: actor.id,
      assigneeId: item.assigneeId!,
      projectId: item.projectId,
      startAt,
      endAt,
      status: "scheduled",
      priority: "normal",
      description: `회의록 출처: ${this.meetingNoteName(item.meetingNoteId)} — "${item.sourceText}"`.slice(0, 2000),
      source: "action_item",
      visibility: "team",
      lastChangedBy: actor.id,
      lastChangedAt: nowIso,
    };
    this.tasks.push(task);

    item.status = "created";
    item.createdTaskId = task.id;
    item.lastChangedBy = actor.id;
    item.lastChangedAt = nowIso;

    this.logChange(ctx, {
      entityType: "action_item",
      entityId: item.id,
      changeType: "update",
      afterValue: `created:${task.id}`,
    });
    this.logChange(ctx, {
      entityType: "task",
      entityId: task.id,
      changeType: "create",
      afterValue: task.title,
    });
    return task;
  }

  /** Action 후보 보류/무시. 담당자, 회의록 업로더, 관리자만 가능. */
  setActionItemStatus(
    ctx: ActorContext,
    input: { actionItemId: string; to: "held" | "ignored" },
  ): ActionItem {
    const actor = this.requireUser(ctx.actorId);
    const item = this.requireActionItem(input.actionItemId);
    assertCanResolveActionItem(actor, item, this.meetingNoteOf(item));
    const before = item.status;
    item.status = input.to;
    item.lastChangedBy = actor.id;
    item.lastChangedAt = this.now();

    this.logChange(ctx, {
      entityType: "action_item",
      entityId: item.id,
      changeType: "update",
      beforeValue: before,
      afterValue: input.to,
    });
    return item;
  }

  /** 작업 생성. 자연어 해석(parseTaskInput) 결과는 확인 카드를 거쳐 이 mutation으로 들어온다.
   *  담당자를 지정하지 않으면 본인 작업이 된다. 타인 지정은 허용하되 ChangeLog로 팀에 보인다. */
  createTask(
    ctx: ActorContext,
    input: {
      title: string;
      assigneeId?: string;
      projectId?: string;
      startAt?: string;
      endAt?: string;
      description?: string;
      estimatedHours?: number;
      priority?: Task["priority"];
      source: Task["source"];
    },
  ): Task {
    const actor = this.requireUser(ctx.actorId);
    const title = input.title.trim();
    if (!title) throw new QueRuleError("INVALID_INPUT", "작업명은 필수다");
    if (title.length > 200) throw new QueRuleError("INVALID_INPUT", "작업명은 200자 이내다");
    if ((input.description?.length ?? 0) > 2000) {
      throw new QueRuleError("INVALID_INPUT", "설명은 2000자 이내다");
    }
    // 담당자 미지정이면 본인(actor). 타인 지정 시 실재 + 재직(active) 검증 — 비활성 배정 거부.
    const assignee = input.assigneeId ? this.requireActiveAssignee(input.assigneeId) : actor;
    if (input.projectId && !this.projects.some((p) => p.id === input.projectId)) {
      throw new QueRuleError("NOT_FOUND", `프로젝트 없음: ${input.projectId}`);
    }
    let range: { startAt: string; endAt: string } | undefined;
    if (input.startAt || input.endAt) {
      range = parseScheduleRange({
        startAt: input.startAt ?? input.endAt!,
        endAt: input.endAt ?? input.startAt!,
      });
    }
    if (input.estimatedHours !== undefined && !(input.estimatedHours > 0)) {
      throw new QueRuleError("INVALID_INPUT", "예상 소요 시간은 0보다 커야 한다");
    }
    // priority는 클라이언트 직렬화값 — enum을 런타임 검증한다(마일스톤/클라이언트 선례).
    const priority = input.priority ?? "normal";
    if (!taskSchema.shape.priority.safeParse(priority).success) {
      throw new QueRuleError("INVALID_INPUT", "잘못된 우선순위다");
    }

    const nowIso = this.now();
    const task: Task = {
      id: this.nextId("task"),
      title,
      ownerId: actor.id,
      assigneeId: assignee.id,
      projectId: input.projectId,
      startAt: range?.startAt,
      endAt: range?.endAt,
      status: "scheduled",
      priority,
      description: input.description?.trim() || undefined,
      estimatedHours: input.estimatedHours,
      source: input.source,
      visibility: "team",
      lastChangedBy: actor.id,
      lastChangedAt: nowIso,
    };
    this.tasks.push(task);
    this.logChange(ctx, {
      entityType: "task",
      entityId: task.id,
      changeType: "create",
      afterValue: `${task.title} (담당 ${assignee.name})`,
    });
    return task;
  }

  /** 작업 상세 편집(제목·설명·우선순위·마감일) — PM 도구(/projects) 카드 드로어용.
   *  본인 작업만 수정 가능(assertCanEditTask). 전달된 필드만 부분 업데이트하고,
   *  실제로 바뀐 항목만 골라 before/after를 ChangeLog(update)에 남긴다.
   *  상태 변경은 여기서 다루지 않는다 — changeTaskStatus(사유 규칙)를 거친다.
   *  일정 이동(startAt/endAt 범위)은 moveTask를, 담당자 변경은 reassignTask를 쓴다.
   *  단, endAt(마감일)만 단독으로 바꾸는 건 카드 편집의 흔한 케이스라 여기서 허용한다. */
  updateTaskDetails(
    ctx: ActorContext,
    input: {
      taskId: string;
      title?: string;
      description?: string | null;
      priority?: Task["priority"];
      /** 시작 시각 ISO. null이면 시작 해제. */
      startAt?: string | null;
      /** 마감(종료) 시각 ISO. null이면 마감 해제. */
      endAt?: string | null;
      /** 소속 프로젝트 id. null이면 프로젝트 해제(무소속 잡무). */
      projectId?: string | null;
      /** 연결 KR(핵심결과) id. null이면 연결 해제. 지정 시 실재 검증(없는 id 거부). */
      keyResultId?: string | null;
    },
  ): Task {
    const actor = this.requireUser(ctx.actorId);
    const task = this.requireTask(input.taskId);
    assertCanEditTask(actor, task, this.projectOf(task));

    const changes: string[] = [];
    const before: string[] = [];

    if (input.title !== undefined) {
      const title = input.title.trim();
      if (!title) throw new QueRuleError("INVALID_INPUT", "작업명은 필수다");
      if (title.length > 200) throw new QueRuleError("INVALID_INPUT", "작업명은 200자 이내다");
      if (title !== task.title) {
        before.push(`제목: ${task.title}`);
        changes.push(`제목: ${title}`);
        task.title = title;
      }
    }
    if (input.description !== undefined) {
      const description = input.description?.trim() || undefined;
      if ((description?.length ?? 0) > 2000) {
        throw new QueRuleError("INVALID_INPUT", "설명은 2000자 이내다");
      }
      if (description !== task.description) {
        before.push(`설명: ${task.description ?? "(없음)"}`);
        changes.push(`설명: ${description ?? "(없음)"}`);
        task.description = description;
      }
    }
    if (input.priority !== undefined) {
      if (!taskSchema.shape.priority.safeParse(input.priority).success) {
        throw new QueRuleError("INVALID_INPUT", "잘못된 우선순위다");
      }
      if (input.priority !== task.priority) {
        before.push(`우선순위: ${task.priority}`);
        changes.push(`우선순위: ${input.priority}`);
        task.priority = input.priority;
      }
    }
    // 시작·마감을 함께 검증한다. 둘 중 하나만 바뀌어도 "최종" 시작·마감 조합으로 startAt≤endAt를
    // 판정해야 한다(한쪽만 보면 다른 쪽과의 역전을 놓친다). null은 해제, 미지정(undefined)은 유지.
    const parseSlot = (v: string | null): string | undefined =>
      // ISO 형식 강제(단일 시점도 range 파서로 검증하는 다른 mutation 선례).
      v === null ? undefined : parseScheduleRange({ startAt: v, endAt: v }).startAt;
    const nextStartAt = input.startAt !== undefined ? parseSlot(input.startAt) : task.startAt;
    const nextEndAt = input.endAt !== undefined ? parseSlot(input.endAt) : task.endAt;
    if (
      nextStartAt !== undefined &&
      nextEndAt !== undefined &&
      Date.parse(nextEndAt) < Date.parse(nextStartAt)
    ) {
      throw new QueRuleError("INVALID_SCHEDULE", "마감 시각은 시작 시각보다 빠를 수 없다");
    }
    if (input.startAt !== undefined && nextStartAt !== task.startAt) {
      before.push(`시작: ${task.startAt ?? "(없음)"}`);
      changes.push(`시작: ${nextStartAt ?? "(없음)"}`);
      task.startAt = nextStartAt;
    }
    if (input.endAt !== undefined && nextEndAt !== task.endAt) {
      before.push(`마감: ${task.endAt ?? "(없음)"}`);
      changes.push(`마감: ${nextEndAt ?? "(없음)"}`);
      task.endAt = nextEndAt;
    }
    if (input.projectId !== undefined) {
      const projectId = input.projectId === null ? undefined : input.projectId;
      // 지정 시 실재 프로젝트여야 한다(유령 id 차단). 해제(null)는 검증 없이 통과.
      const nextProject = projectId
        ? this.projects.find((p) => p.id === projectId)
        : undefined;
      if (projectId && !nextProject) {
        throw new QueRuleError("NOT_FOUND", `프로젝트 없음: ${projectId}`);
      }
      if (projectId !== task.projectId) {
        const prevProject = this.projects.find((p) => p.id === task.projectId);
        before.push(`프로젝트: ${prevProject?.name ?? "(없음)"}`);
        changes.push(`프로젝트: ${nextProject?.name ?? "(없음)"}`);
        task.projectId = projectId;
        // 선행 연결은 "같은 프로젝트 내"가 불변식 — 프로젝트가 바뀌면 걸린 링크를 자동 정리(E-9).
        this.clearPredecessorLinks(ctx, task, "프로젝트 이동");
      }
    }
    if (input.keyResultId !== undefined) {
      const keyResultId = input.keyResultId === null ? undefined : input.keyResultId;
      // 지정 시 실재 KR이어야 한다(유령 id 차단). 해제(null)는 검증 없이 통과.
      const nextKr = keyResultId ? this.keyResults.find((k) => k.id === keyResultId) : undefined;
      if (keyResultId && !nextKr) {
        throw new QueRuleError("NOT_FOUND", `핵심결과(KR) 없음: ${keyResultId}`);
      }
      if (keyResultId !== task.keyResultId) {
        const prevKr = this.keyResults.find((k) => k.id === task.keyResultId);
        before.push(`KR: ${prevKr?.title ?? "(없음)"}`);
        changes.push(`KR: ${nextKr?.title ?? "(없음)"}`);
        task.keyResultId = keyResultId;
      }
    }

    // 바뀐 게 없으면 아무것도 기록하지 않고 그대로 돌려준다(no-op ChangeLog 방지).
    if (changes.length === 0) return task;

    task.lastChangedBy = actor.id;
    task.lastChangedAt = this.now();
    this.logChange(ctx, {
      entityType: "task",
      entityId: task.id,
      changeType: "update",
      beforeValue: before.join(" · "),
      afterValue: changes.join(" · "),
    });
    return task;
  }

  /** 회의록 업로드. 원문 MD를 보존하고 추출 대기 상태로 저장한다. */
  createMeetingNote(
    ctx: ActorContext,
    input: {
      title: string;
      /** 대표 프로젝트(단일). projectIds가 오면 무시하고 projectIds[0]을 대표로 삼는다. */
      projectId?: string;
      /** 다중 프로젝트(주간회의 등). 지정 시 projectId보다 우선한다. */
      projectIds?: string[];
      meetingAt: string;
      attendeeIds: string[];
      fileName: string;
      markdownBody: string;
      visibility?: MeetingNote["visibility"];
      restrictedUserIds?: string[];
      /** 회의 종류(주간/마일스톤/일반). 미지정은 general. */
      kind?: MeetingNote["kind"];
    },
  ): MeetingNote {
    const actor = this.requireUser(ctx.actorId);
    if (!input.title.trim() || !input.fileName.trim()) {
      throw new QueRuleError("INVALID_INPUT", "회의명과 파일명은 필수다");
    }
    if (input.title.length > 200 || input.fileName.length > 200) {
      throw new QueRuleError("INVALID_INPUT", "회의명/파일명은 200자 이내다");
    }
    if (input.markdownBody.length > 500_000) {
      throw new QueRuleError("INVALID_INPUT", "회의록 본문은 500,000자 이내다");
    }
    if (input.visibility === "restricted" && !input.restrictedUserIds?.length) {
      throw new QueRuleError(
        "INVALID_INPUT",
        "지정 인원 공개 범위는 열람 가능한 사용자를 1명 이상 지정해야 한다",
      );
    }
    // meetingAt ISO 검증 (단일 시점)
    const range = parseScheduleRange({ startAt: input.meetingAt, endAt: input.meetingAt });

    // 다중 프로젝트 정규화: projectIds 우선, 없으면 단일 projectId. 중복 제거 후 실재 검증.
    const rawProjectIds = input.projectIds?.length
      ? input.projectIds
      : input.projectId
        ? [input.projectId]
        : [];
    const projectIds = rawProjectIds.filter((id, i) => rawProjectIds.indexOf(id) === i);
    for (const pid of projectIds) {
      if (!this.projects.some((p) => p.id === pid)) {
        throw new QueRuleError("NOT_FOUND", `프로젝트 없음: ${pid}`);
      }
    }

    const nowIso = this.now();
    const note: MeetingNote = {
      id: this.nextId("note"),
      title: input.title.trim(),
      // 대표값(projectId)은 목록·필터의 하위호환을 위해 projectIds[0]과 일치시킨다.
      projectId: projectIds[0],
      projectIds: projectIds.length ? projectIds : undefined,
      meetingAt: range.startAt,
      attendeeIds: input.attendeeIds,
      uploaderId: actor.id,
      fileName: input.fileName.trim(),
      markdownBody: input.markdownBody,
      visibility: input.visibility ?? "team",
      restrictedUserIds: input.visibility === "restricted" ? input.restrictedUserIds : undefined,
      kind: input.kind ?? "general",
      extractionStatus: "pending",
      createdAt: nowIso,
      updatedAt: nowIso,
    };
    this.meetingNotes.push(note);
    this.logChange(ctx, {
      entityType: "meeting_note",
      entityId: note.id,
      changeType: "create",
      afterValue: note.title,
    });
    return note;
  }

  /** 회의록에서 Action 후보를 규칙 기반으로 추출한다.
   *  자동으로 Task를 만들지 않는다 — 후보는 candidate/needs_review로만 생성된다. */
  extractActionItems(ctx: ActorContext, meetingNoteId: string): ActionItem[] {
    const actor = this.requireUser(ctx.actorId);
    const note = this.meetingNotes.find((n) => n.id === meetingNoteId);
    if (!note) throw new QueRuleError("NOT_FOUND", `회의록 없음: ${meetingNoteId}`);
    if (!canViewMeetingNote(actor, note)) {
      throw new QueRuleError(
        "NOT_AUTHORIZED",
        "열람 권한이 없는 회의록에서는 Action을 추출할 수 없다",
      );
    }
    if (note.extractionStatus === "done") {
      throw new QueRuleError(
        "ACTION_ALREADY_RESOLVED",
        "이미 추출이 완료된 회의록이다 — 중복 추출은 후보를 복제한다",
      );
    }

    const nowIso = this.now();
    const created: ActionItem[] = [];
    for (const line of note.markdownBody.split("\n")) {
      const bullet = line.match(/^\s*[-*]\s+(.+)$/)?.[1];
      if (!bullet) continue;

      // "(담당: 이름 ...)" 패턴에서 담당자 추출
      const assignee = this.users.find((u) => bullet.includes(`담당: ${u.name}`));
      // 제목은 200자 상한(DB check 제약과 동일)으로 절단 — 원문은 sourceText에 그대로 보존된다
      const title = bullet
        .replace(/\s*\(담당:[^)]*\)\s*/, "")
        .replace(/[.。]\s*$/, "")
        .trim()
        .slice(0, 200);
      if (!title) continue;

      const item: ActionItem = {
        id: this.nextId("act"),
        meetingNoteId: note.id,
        sourceText: bullet,
        title,
        assigneeId: assignee?.id,
        projectId: note.projectId,
        status: "needs_review", // 마감일은 추출하지 않으므로 항상 확인 필요로 시작
        confidence: assignee ? 0.8 : 0.5,
        createdAt: nowIso,
      };
      this.actionItems.push(item);
      created.push(item);
    }

    note.extractionStatus = "done";
    note.updatedAt = nowIso;
    this.logChange(ctx, {
      entityType: "meeting_note",
      entityId: note.id,
      changeType: "update",
      afterValue: `extracted:${created.length}`,
      reason: `${actor.name}이 Action 후보 ${created.length}건 추출`,
    });
    return created;
  }

  /** Action 후보의 담당자/마감일/프로젝트 지정. 확인 필요 → 생성 대기 승격을 처리한다. */
  updateActionItem(
    ctx: ActorContext,
    input: {
      actionItemId: string;
      assigneeId?: string;
      dueAt?: string;
      projectId?: string;
    },
  ): ActionItem {
    const actor = this.requireUser(ctx.actorId);
    const item = this.requireActionItem(input.actionItemId);
    assertCanResolveActionItem(actor, item, this.meetingNoteOf(item));
    if (item.status === "created" || item.status === "ignored") {
      throw new QueRuleError(
        "ACTION_ALREADY_RESOLVED",
        `이미 처리된 Action이다 (${item.status})`,
      );
    }
    if (input.assigneeId && !this.users.some((u) => u.id === input.assigneeId)) {
      throw new QueRuleError("NOT_FOUND", `사용자 없음: ${input.assigneeId}`);
    }
    if (input.dueAt) {
      const range = parseScheduleRange({ startAt: input.dueAt, endAt: input.dueAt });
      item.dueAt = range.startAt;
    }
    if (input.assigneeId) item.assigneeId = input.assigneeId;
    if (input.projectId) item.projectId = input.projectId;

    // 담당자와 마감일이 모두 갖춰지면 생성 대기로 승격
    if (item.status === "needs_review" && item.assigneeId && item.dueAt) {
      item.status = "candidate";
    }
    item.lastChangedBy = actor.id;
    item.lastChangedAt = this.now();

    this.logChange(ctx, {
      entityType: "action_item",
      entityId: item.id,
      changeType: "update",
      afterValue: item.status,
    });
    return item;
  }

  /** 작업 댓글 — 팀 누구나 타인의 작업에도 남길 수 있다 (수정 불가 팀원의 의사 전달 통로).
   *  helpUserId 지정 시 "도움 요청"이 되어 대상자 오늘 화면과 팀 현황 Attention에 노출된다. */
  addTaskComment(
    ctx: ActorContext,
    input: { taskId: string; body: string; helpUserId?: string; helpUserIds?: string[] },
  ): TaskComment {
    const actor = this.requireUser(ctx.actorId);
    const task = this.requireTask(input.taskId);
    const body = input.body.trim();
    if (!body) throw new QueRuleError("INVALID_INPUT", "댓글 내용은 필수다");
    if (body.length > 1000) throw new QueRuleError("INVALID_INPUT", "댓글은 1000자 이내다");
    // 단일/다중 입력을 정규화(statusLog와 동일 규약) — 전원 실재 검증, 최대 10명.
    const helpIds = helpUserIdsOf(input);
    if (helpIds.length > 10) throw new QueRuleError("INVALID_INPUT", "도움 대상은 최대 10명이다");
    for (const id of helpIds) this.requireUser(id);

    const comment: TaskComment = {
      id: this.nextId("cmt"),
      taskId: task.id,
      authorId: actor.id,
      body,
      helpUserId: helpIds[0], // FK·하위호환 — 첫 대상을 복제
      helpUserIds: helpIds.length > 0 ? helpIds : undefined,
      createdAt: this.now(),
    };
    this.taskComments.push(comment);

    // 도움 요청은 업무에 영향을 주는 변경 — ChangeLog로 팀에 보인다. 일반 댓글은 조용히 기록.
    if (helpIds.length > 0) {
      this.logChange(ctx, {
        entityType: "task",
        entityId: task.id,
        changeType: "update",
        afterValue: `도움 요청 → ${helpIds.map((id) => this.requireUser(id).name).join(", ")}`,
        reason: body.slice(0, 100),
      });
    }
    return comment;
  }

  /** 마일스톤 이동 (dueAt 변경). 프로젝트 담당자 또는 관리자만 가능.
   *  연결 작업 동반 이동 확인 플로우는 후속 단계에서 다룬다 (HANDOFF 참고). */
  moveMilestone(ctx: ActorContext, input: { milestoneId: string; dueAt: string }): Milestone {
    const actor = this.requireUser(ctx.actorId);
    const milestone = this.milestones.find((m) => m.id === input.milestoneId);
    if (!milestone) {
      throw new QueRuleError("NOT_FOUND", `마일스톤 없음: ${input.milestoneId}`);
    }
    const project = this.projects.find((p) => p.id === milestone.projectId);
    if (actor.role !== "admin" && project?.ownerId !== actor.id) {
      throw new QueRuleError(
        "NOT_AUTHORIZED",
        "마일스톤은 프로젝트 담당자 또는 관리자만 이동할 수 있다",
      );
    }
    // dueAt 단일 시점도 range 파서로 검증한다 (ISO 형식 강제)
    const range = parseScheduleRange({ startAt: input.dueAt, endAt: input.dueAt });

    const before = milestone.dueAt;
    milestone.dueAt = range.startAt;
    milestone.lastChangedBy = actor.id;
    milestone.lastChangedAt = this.now();

    this.logChange(ctx, {
      entityType: "milestone",
      entityId: milestone.id,
      changeType: "move",
      beforeValue: before,
      afterValue: range.startAt,
    });
    return milestone;
  }

  /** 마일스톤 생성 — 프로젝트 담당자 또는 관리자만. */
  createMilestone(
    ctx: ActorContext,
    input: {
      projectId: string;
      title: string;
      dueAt: string;
      riskStatus?: Milestone["riskStatus"];
    },
  ): Milestone {
    const actor = this.requireUser(ctx.actorId);
    const project = this.projects.find((p) => p.id === input.projectId);
    if (!project) {
      throw new QueRuleError("NOT_FOUND", `프로젝트 없음: ${input.projectId}`);
    }
    if (actor.role !== "admin" && project.ownerId !== actor.id) {
      throw new QueRuleError(
        "NOT_AUTHORIZED",
        "마일스톤은 프로젝트 담당자 또는 관리자만 만들 수 있다",
      );
    }
    if (!input.title.trim()) {
      throw new QueRuleError("INVALID_INPUT", "제목은 필수다");
    }
    // 서버 액션 인자는 클라이언트 직렬화값 — TS 타입만 믿지 말고 enum을 런타임 검증한다.
    const riskStatus = input.riskStatus ?? "on_track";
    if (!milestoneSchema.shape.riskStatus.safeParse(riskStatus).success) {
      throw new QueRuleError("INVALID_INPUT", "잘못된 위험 상태다");
    }
    const range = parseScheduleRange({ startAt: input.dueAt, endAt: input.dueAt });
    const milestone: Milestone = {
      id: this.nextId("ms"),
      projectId: input.projectId,
      title: input.title.trim(),
      dueAt: range.startAt,
      riskStatus,
      lastChangedBy: actor.id,
      lastChangedAt: this.now(),
    };
    this.milestones.push(milestone);
    this.logChange(ctx, {
      entityType: "milestone",
      entityId: milestone.id,
      changeType: "create",
      afterValue: milestone.title,
    });
    return milestone;
  }

  /** 마일스톤 수정(제목·기한·위험 상태) — 프로젝트 담당자 또는 관리자만. */
  updateMilestone(
    ctx: ActorContext,
    input: {
      milestoneId: string;
      title?: string;
      dueAt?: string;
      riskStatus?: Milestone["riskStatus"];
      /** 위험 상태 변경 등 결정 사유(선택) — ChangeLog afterValue에 남긴다("사유는 남기는 것"). */
      reason?: string;
    },
  ): Milestone {
    const actor = this.requireUser(ctx.actorId);
    const milestone = this.milestones.find((m) => m.id === input.milestoneId);
    if (!milestone) {
      throw new QueRuleError("NOT_FOUND", `마일스톤 없음: ${input.milestoneId}`);
    }
    const project = this.projects.find((p) => p.id === milestone.projectId);
    if (actor.role !== "admin" && project?.ownerId !== actor.id) {
      throw new QueRuleError(
        "NOT_AUTHORIZED",
        "마일스톤은 프로젝트 담당자 또는 관리자만 수정할 수 있다",
      );
    }
    if (input.title !== undefined) {
      if (!input.title.trim()) {
        throw new QueRuleError("INVALID_INPUT", "제목은 필수다");
      }
      milestone.title = input.title.trim();
    }
    if (input.dueAt !== undefined) {
      milestone.dueAt = parseScheduleRange({ startAt: input.dueAt, endAt: input.dueAt }).startAt;
    }
    if (input.riskStatus !== undefined) {
      if (!milestoneSchema.shape.riskStatus.safeParse(input.riskStatus).success) {
        throw new QueRuleError("INVALID_INPUT", "잘못된 위험 상태다");
      }
      milestone.riskStatus = input.riskStatus;
    }
    milestone.lastChangedBy = actor.id;
    milestone.lastChangedAt = this.now();
    this.logChange(ctx, {
      entityType: "milestone",
      entityId: milestone.id,
      changeType: "update",
      afterValue: input.reason?.trim()
        ? `${milestone.title} — 사유: ${input.reason.trim()}`
        : milestone.title,
    });
    return milestone;
  }

  /** 클라이언트(거래처) 생성 — 관리자만. 이름은 200자 이내로 검증한다. */
  createClient(
    ctx: ActorContext,
    input: { name: string; status?: Client["status"] },
  ): Client {
    const actor = this.requireUser(ctx.actorId);
    if (!canManageClient(actor)) {
      throw new QueRuleError("NOT_AUTHORIZED", "클라이언트는 관리자만 만들 수 있다");
    }
    // 신뢰 못 할 클라이언트 인자 — 이름/상태를 런타임 검증한다(밀리스톤 mutation 선례).
    const parsed = clientSchema
      .pick({ name: true, status: true })
      .safeParse({ name: input.name, status: input.status ?? "active" });
    if (!parsed.success) {
      throw new QueRuleError(
        "INVALID_INPUT",
        `클라이언트 입력이 유효하지 않다: ${parsed.error.issues.map((i) => i.message).join(", ")}`,
      );
    }

    // 새 클라이언트는 표시 순서 맨 끝에 붙인다(현재 max + 1). 빈 목록이면 0.
    const maxSort = this.clients.reduce((m, c) => Math.max(m, c.sortOrder), -1);
    const client: Client = {
      id: this.nextId("client"),
      name: parsed.data.name,
      status: parsed.data.status,
      sortOrder: maxSort + 1,
    };
    this.clients.push(client);
    this.logChange(ctx, {
      entityType: "client",
      entityId: client.id,
      changeType: "create",
      afterValue: client.name,
    });
    return client;
  }

  /** 클라이언트 표시 순서 변경 — 관리자만. orderedIds 순서대로 sortOrder를 0..n-1로 재설정한다.
   *  존재하지 않는 id나 중복은 거부한다(부분 반영 없이 통째로 실패). ChangeLog(via) 1건 기록. */
  reorderClients(ctx: ActorContext, input: { orderedIds: string[] }): Client[] {
    const actor = this.requireUser(ctx.actorId);
    if (!canManageClient(actor)) {
      throw new QueRuleError("NOT_AUTHORIZED", "클라이언트 순서는 관리자만 변경할 수 있다");
    }
    const ids = input.orderedIds;
    if (!Array.isArray(ids) || ids.length === 0) {
      throw new QueRuleError("INVALID_INPUT", "정렬할 클라이언트 목록이 비어 있다");
    }
    if (new Set(ids).size !== ids.length) {
      throw new QueRuleError("INVALID_INPUT", "정렬 목록에 중복된 클라이언트가 있다");
    }
    // 먼저 전부 검증한 뒤에 반영한다 — 잘못된 id가 하나라도 있으면 아무것도 바꾸지 않는다.
    const targets = ids.map((id) => {
      const client = this.clients.find((c) => c.id === id);
      if (!client) throw new QueRuleError("NOT_FOUND", `클라이언트 없음: ${id}`);
      return client;
    });
    const before = targets.map((c) => `${c.id}:${c.sortOrder}`).join(",");
    targets.forEach((client, index) => {
      client.sortOrder = index;
    });
    this.logChange(ctx, {
      entityType: "client",
      entityId: targets[0].id, // 대표 — before/after에 전체 순서를 담는다
      changeType: "update",
      beforeValue: before,
      afterValue: ids.map((id, i) => `${id}:${i}`).join(","),
      reason: "표시 순서 변경",
    });
    return targets;
  }

  /** 클라이언트 수정(이름·상태) — 관리자만. */
  updateClient(
    ctx: ActorContext,
    input: { clientId: string; name?: string; status?: Client["status"] },
  ): Client {
    const actor = this.requireUser(ctx.actorId);
    if (!canManageClient(actor)) {
      throw new QueRuleError("NOT_AUTHORIZED", "클라이언트는 관리자만 수정할 수 있다");
    }
    const client = this.clients.find((c) => c.id === input.clientId);
    if (!client) throw new QueRuleError("NOT_FOUND", `클라이언트 없음: ${input.clientId}`);

    if (input.name !== undefined) {
      const parsed = clientSchema.shape.name.safeParse(input.name);
      if (!parsed.success) {
        throw new QueRuleError("INVALID_INPUT", "이름은 1~200자여야 한다");
      }
      client.name = parsed.data;
    }
    if (input.status !== undefined) {
      if (!clientSchema.shape.status.safeParse(input.status).success) {
        throw new QueRuleError("INVALID_INPUT", "잘못된 클라이언트 상태다");
      }
      client.status = input.status;
    }
    this.logChange(ctx, {
      entityType: "client",
      entityId: client.id,
      changeType: "update",
      afterValue: client.name,
    });
    return client;
  }

  /** 프로젝트 생성 — 관리자만. clientId(상위 거래처)는 선택이며, 지정 시 존재를 검증한다. */
  createProject(
    ctx: ActorContext,
    input: {
      name: string;
      ownerId?: string;
      clientId?: string;
      status?: Project["status"];
      description?: string;
    },
  ): Project {
    const actor = this.requireUser(ctx.actorId);
    // 생성은 전원 허용(2026-07-12 사용자 결정 — Copilot 대화 중 즉석 생성 필요).
    // 편집·보관·클라이언트 재배정은 여전히 관리자·담당자만(updateProject 경로 유지).
    const name = input.name.trim();
    if (!name) throw new QueRuleError("INVALID_INPUT", "프로젝트명은 필수다");
    if (name.length > 200) throw new QueRuleError("INVALID_INPUT", "프로젝트명은 200자 이내다");
    const owner = input.ownerId ? this.requireUser(input.ownerId) : actor;
    if (input.clientId && !this.clients.some((c) => c.id === input.clientId)) {
      throw new QueRuleError("NOT_FOUND", `클라이언트 없음: ${input.clientId}`);
    }
    const status = input.status ?? "active";
    if (!projectSchema.shape.status.safeParse(status).success) {
      throw new QueRuleError("INVALID_INPUT", "잘못된 프로젝트 상태다");
    }
    const description = input.description?.trim() || undefined;
    if ((description?.length ?? 0) > 2000) {
      throw new QueRuleError("INVALID_INPUT", "프로젝트 설명은 2000자 이내다");
    }

    const project: Project = {
      id: this.nextId("prj"),
      name,
      ownerId: owner.id,
      status,
      clientId: input.clientId,
      description,
      milestoneIds: [],
    };
    this.projects.push(project);
    this.logChange(ctx, {
      entityType: "project",
      entityId: project.id,
      changeType: "create",
      afterValue: project.name,
    });
    return project;
  }

  /** 프로젝트 수정(이름·상태·상위 클라이언트·담당자) — 관리자 또는 프로젝트 담당자만.
   *  clientId에 null을 주면 클라이언트 연결을 해제한다(내부 잡무로 전환). */
  updateProject(
    ctx: ActorContext,
    input: {
      projectId: string;
      name?: string;
      status?: Project["status"];
      clientId?: string | null;
      ownerId?: string;
      /** 프로젝트 설명. null이면 설명 제거. */
      description?: string | null;
    },
  ): Project {
    const actor = this.requireUser(ctx.actorId);
    const project = this.projects.find((p) => p.id === input.projectId);
    if (!project) throw new QueRuleError("NOT_FOUND", `프로젝트 없음: ${input.projectId}`);
    if (!canManageProject(actor, project)) {
      throw new QueRuleError(
        "NOT_AUTHORIZED",
        "프로젝트는 관리자 또는 프로젝트 담당자만 수정할 수 있다",
      );
    }
    if (input.name !== undefined) {
      const name = input.name.trim();
      if (!name) throw new QueRuleError("INVALID_INPUT", "프로젝트명은 필수다");
      if (name.length > 200) throw new QueRuleError("INVALID_INPUT", "프로젝트명은 200자 이내다");
      project.name = name;
    }
    if (input.status !== undefined) {
      if (!projectSchema.shape.status.safeParse(input.status).success) {
        throw new QueRuleError("INVALID_INPUT", "잘못된 프로젝트 상태다");
      }
      project.status = input.status;
    }
    if (input.clientId !== undefined) {
      if (input.clientId === null) {
        project.clientId = undefined; // 연결 해제
      } else {
        if (!this.clients.some((c) => c.id === input.clientId)) {
          throw new QueRuleError("NOT_FOUND", `클라이언트 없음: ${input.clientId}`);
        }
        project.clientId = input.clientId;
      }
    }
    if (input.ownerId !== undefined) {
      project.ownerId = this.requireUser(input.ownerId).id;
    }
    if (input.description !== undefined) {
      if (input.description === null) {
        project.description = undefined; // 설명 제거
      } else {
        const description = input.description.trim() || undefined;
        if ((description?.length ?? 0) > 2000) {
          throw new QueRuleError("INVALID_INPUT", "프로젝트 설명은 2000자 이내다");
        }
        project.description = description;
      }
    }
    this.logChange(ctx, {
      entityType: "project",
      entityId: project.id,
      changeType: "update",
      afterValue: project.name,
    });
    return project;
  }

  /** 체크인 스케줄러 — 시작 시간이 지난 "예정" 작업에 체크인을 생성한다 (멱등).
   *  기획서 체크인 정책: Que 작업에만 묻고, 이미 상태가 업데이트된 작업(진행중/완료 등)은
   *  묻지 않으며, 회의/휴가(CalendarEvent)는 대상이 아니다.
   *  mock 단계에서는 조회 시점에 lazy 실행하고, 배포 후 Vercel Cron으로 전환한다.
   *  시스템 동작이므로 ChangeLog를 남기지 않는다 (업무 내용 변경이 아님). */
  syncCheckIns(now: Date = this.clock()): CheckIn[] {
    const dayStart = new Date(now);
    dayStart.setHours(0, 0, 0, 0);
    const created: CheckIn[] = [];

    for (const task of this.tasks) {
      if (task.status !== "scheduled" || !task.startAt) continue;
      const start = new Date(task.startAt);
      // 오늘 시작해서 이미 시작 시간이 지난 작업만 — 과거 날짜 작업에 뒤늦게 묻지 않는다
      if (start > now || start < dayStart) continue;
      if (this.checkIns.some((c) => c.taskId === task.id)) continue; // 작업당 1회

      const checkIn: CheckIn = {
        id: this.nextId("chk"),
        taskId: task.id,
        assigneeId: task.assigneeId,
        scheduledAt: task.startAt,
        followUpRequired: false,
      };
      this.checkIns.push(checkIn);
      created.push(checkIn);
    }
    return created;
  }

  /** 반복 업무 템플릿 등록. 담당자는 항상 필요하고, 주기별 필수 필드는 스키마가 강제한다. */
  createRecurringTemplate(
    ctx: ActorContext,
    input: {
      title: string;
      assigneeId: string;
      projectId?: string;
      frequency: RecurrenceFrequency;
      dayOfWeek?: number;
      dayOfMonth?: number;
      startTime: string;
      durationMinutes?: number;
      description?: string;
    },
  ): RecurringTemplate {
    const actor = this.requireUser(ctx.actorId);
    this.requireUser(input.assigneeId);
    if (!input.title.trim()) {
      throw new QueRuleError("INVALID_INPUT", "제목은 필수다");
    }
    if (input.projectId && !this.projects.some((p) => p.id === input.projectId)) {
      throw new QueRuleError("NOT_FOUND", `프로젝트 없음: ${input.projectId}`);
    }
    if (input.frequency === "weekly") {
      if (input.dayOfWeek === undefined) {
        throw new QueRuleError("INVALID_INPUT", "매주 반복은 요일을 지정해야 한다");
      }
      if (!Number.isInteger(input.dayOfWeek) || input.dayOfWeek < 0 || input.dayOfWeek > 6) {
        throw new QueRuleError("INVALID_INPUT", "요일은 0(일)~6(토) 사이여야 한다");
      }
    }
    if (input.frequency === "monthly") {
      if (input.dayOfMonth === undefined) {
        throw new QueRuleError("INVALID_INPUT", "매월 반복은 날짜를 지정해야 한다");
      }
      if (!Number.isInteger(input.dayOfMonth) || input.dayOfMonth < 1 || input.dayOfMonth > 28) {
        throw new QueRuleError("INVALID_INPUT", "매월 반복 날짜는 1~28 사이여야 한다 (월말 문제 회피)");
      }
    }
    const timeMatch = /^(\d{2}):(\d{2})$/.exec(input.startTime);
    if (!timeMatch || Number(timeMatch[1]) > 23 || Number(timeMatch[2]) > 59) {
      throw new QueRuleError("INVALID_INPUT", "시작 시각은 HH:mm 형식(00:00~23:59)이어야 한다");
    }
    if (input.durationMinutes !== undefined) {
      if (
        !Number.isInteger(input.durationMinutes) ||
        input.durationMinutes < 1 ||
        input.durationMinutes > 24 * 60
      ) {
        throw new QueRuleError("INVALID_INPUT", "소요 시간은 1분~24시간 사이여야 한다");
      }
    }

    const template: RecurringTemplate = {
      id: this.nextId("tmpl"),
      title: input.title.trim().slice(0, 200),
      assigneeId: input.assigneeId,
      projectId: input.projectId,
      frequency: input.frequency,
      dayOfWeek: input.frequency === "weekly" ? input.dayOfWeek : undefined,
      dayOfMonth: input.frequency === "monthly" ? input.dayOfMonth : undefined,
      startTime: input.startTime,
      durationMinutes: input.durationMinutes ?? 60,
      description: input.description?.slice(0, 2000),
      active: true,
      createdBy: actor.id,
      createdAt: this.now(),
    };
    this.recurringTemplates.push(template);
    this.logChange(ctx, {
      entityType: "recurring_template",
      entityId: template.id,
      changeType: "create",
      afterValue: template.title,
    });
    return template;
  }

  /** 반복 업무 템플릿 켜기/끄기. 만든 사람과 관리자만 가능하다. 끄면 다음 회차부터 생성이 멈춘다. */
  setRecurringTemplateActive(ctx: ActorContext, templateId: string, active: boolean): RecurringTemplate {
    const actor = this.requireUser(ctx.actorId);
    const template = this.recurringTemplates.find((t) => t.id === templateId);
    if (!template) throw new QueRuleError("NOT_FOUND", `템플릿 없음: ${templateId}`);
    assertCanManageRecurringTemplate(actor, template);
    const before = template.active;
    template.active = active;
    this.logChange(ctx, {
      entityType: "recurring_template",
      entityId: template.id,
      changeType: "update",
      beforeValue: String(before),
      afterValue: String(active),
    });
    return template;
  }

  /** 템플릿 기준으로 다음 회차 날짜(YYYY-MM-DD)를 계산한다. now 당일도 포함한다. */
  private nextOccurrenceDate(template: RecurringTemplate, now: Date): string {
    const cursor = new Date(now);
    cursor.setHours(0, 0, 0, 0);
    if (template.frequency === "weekly") {
      const target = template.dayOfWeek!;
      const diff = (target - cursor.getDay() + 7) % 7;
      cursor.setDate(cursor.getDate() + diff);
    } else {
      const target = template.dayOfMonth!;
      // cursor에 이미 큰 날짜(예: 30)가 들어있는 채로 setMonth를 먼저 하면 월 오버플로우가 나므로
      // (1/30 + 1개월 = "2/30" → 3/2로 밀림), year/month/day를 한 번에 새로 구성한다.
      const month = cursor.getDate() > target ? cursor.getMonth() + 1 : cursor.getMonth();
      cursor.setTime(new Date(cursor.getFullYear(), month, target).getTime());
    }
    const y = cursor.getFullYear();
    const m = String(cursor.getMonth() + 1).padStart(2, "0");
    const d = String(cursor.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }

  /** 반복 업무 템플릿 스케줄러 — 다가오는(3일 이내) 회차를 Task로 미리 만들어둔다 (멱등).
   *  체크인과 같은 이유로 조회 시점에 lazy 실행하고, 배포 후 Vercel Cron으로 전환한다.
   *  시스템 동작이므로 ChangeLog는 생성된 Task 쪽에만 남긴다(템플릿 자체의 변경이 아님). */
  syncRecurringTemplates(now: Date = this.clock()): Task[] {
    const WINDOW_DAYS = 3;
    const windowEnd = new Date(now);
    windowEnd.setDate(windowEnd.getDate() + WINDOW_DAYS);
    windowEnd.setHours(23, 59, 59, 999);

    const created: Task[] = [];
    for (const template of this.recurringTemplates) {
      if (!template.active) continue;
      const occurrence = this.nextOccurrenceDate(template, now);
      if (occurrence === template.lastGeneratedFor) continue; // 이미 만들어준 회차다
      const [h, min] = template.startTime.split(":").map(Number);
      const startAt = new Date(`${occurrence}T00:00:00`);
      startAt.setHours(h, min, 0, 0);
      if (startAt > windowEnd) continue; // 아직 너무 먼 회차 — 다음에 다시 계산한다

      const endAt = new Date(startAt.getTime() + template.durationMinutes * 60_000);
      const task: Task = {
        id: this.nextId("task"),
        title: template.title,
        ownerId: template.createdBy,
        assigneeId: template.assigneeId,
        projectId: template.projectId,
        startAt: startAt.toISOString(),
        endAt: endAt.toISOString(),
        status: "scheduled",
        priority: "normal",
        description: template.description,
        source: "recurring_template",
        recurringTemplateId: template.id,
        visibility: "team",
      };
      this.tasks.push(task);
      template.lastGeneratedFor = occurrence;
      created.push(task);

      this.logChange(
        { actorId: template.createdBy, via: "web" },
        {
          entityType: "task",
          entityId: task.id,
          changeType: "create",
          afterValue: `${task.title} (반복 템플릿 ${template.id}에서 자동 생성)`,
        },
      );
    }
    return created;
  }

  /**
   * 회사 캘린더 동기화 — 제공자(Google 등)에서 기간 내 외부 일정을 읽어 회사 일정(source:"company")으로
   * 멱등 upsert 한다. 같은 externalCalendarId가 있으면 변경분만 갱신, 없으면 추가한다.
   * 회사 일정은 Que에서 수정/이동 불가(canMoveCalendarEvent가 source==="que"만 허용)이므로 읽기 전용이 유지된다.
   * 매핑 불가(존재하지 않는 ownerId)·시간 역전 일정은 건너뛴다. 삭제 동기화는 후속 과제.
   * env(OAuth) 도착 후 GoogleCalendarProvider를 같은 인터페이스로 넘기면 실 연동이 된다.
   */
  async syncExternalCalendar(
    provider: CalendarProvider,
    rangeStart: Date,
    rangeEnd: Date,
  ): Promise<{ added: number; updated: number; skipped: number }> {
    const external = await provider.listEvents(rangeStart, rangeEnd);
    let added = 0;
    let updated = 0;
    let skipped = 0;
    const nowIso = this.now();

    for (const ext of external) {
      // 매핑 불가한 소유자, 시간 역전은 신뢰하지 않고 버린다
      if (!this.users.some((u) => u.id === ext.ownerId)) {
        skipped += 1;
        continue;
      }
      if (Date.parse(ext.startAt) > Date.parse(ext.endAt)) {
        skipped += 1;
        continue;
      }

      const existing = this.calendarEvents.find(
        (e) => e.source === "company" && e.externalCalendarId === ext.externalId,
      );
      if (existing) {
        const extAttendees = ext.attendeeIds ?? existing.attendeeIds;
        const changed =
          existing.title !== ext.title ||
          existing.startAt !== ext.startAt ||
          existing.endAt !== ext.endAt ||
          existing.ownerId !== ext.ownerId ||
          (ext.visibility !== undefined && existing.visibility !== ext.visibility) ||
          JSON.stringify(existing.attendeeIds) !== JSON.stringify(extAttendees);
        if (changed) {
          existing.title = ext.title;
          existing.startAt = ext.startAt;
          existing.endAt = ext.endAt;
          existing.ownerId = ext.ownerId;
          existing.attendeeIds = ext.attendeeIds ?? existing.attendeeIds;
          existing.visibility = ext.visibility ?? existing.visibility;
          existing.lastChangedAt = nowIso; // "수정됨" 배지가 반영되도록
          updated += 1;
        }
      } else {
        this.calendarEvents.push({
          id: this.nextId("evt"),
          source: "company",
          title: ext.title,
          ownerId: ext.ownerId,
          startAt: ext.startAt,
          endAt: ext.endAt,
          attendeeIds: ext.attendeeIds ?? [],
          visibility: ext.visibility ?? "team",
          externalCalendarId: ext.externalId,
          lastChangedAt: nowIso,
        });
        added += 1;
      }
    }
    return { added, updated, skipped };
  }

  /** 자동 체크인 응답. 담당자(또는 관리자)만 응답할 수 있고,
   *  응답에 따라 작업 상태를 함께 갱신한다. `later`는 상태를 바꾸지 않고 후속 확인만 남긴다. */
  answerCheckIn(
    ctx: ActorContext,
    input: {
      checkInId: string;
      response: CheckInResponse;
      detail?: StatusDetail;
      /** response가 merged일 때 필수 — 병합 대상 작업 */
      mergedIntoTaskId?: string;
      /** response가 later일 때만 유효 — 다시 물어볼 시각(미래, now+48h 이내). */
      snoozeUntil?: string;
    },
  ): CheckIn {
    const actor = this.requireUser(ctx.actorId);
    const checkIn = this.checkIns.find((c) => c.id === input.checkInId);
    if (!checkIn) throw new QueRuleError("NOT_FOUND", `체크인 없음: ${input.checkInId}`);
    if (actor.role !== "admin" && checkIn.assigneeId !== actor.id) {
      throw new QueRuleError("NOT_AUTHORIZED", "체크인은 담당자만 응답할 수 있다");
    }
    if (checkIn.answeredAt && checkIn.response !== "later") {
      throw new QueRuleError("ALREADY_ANSWERED", "이미 응답한 체크인이다");
    }

    // 스누즈는 '나중에' 응답에서만 의미가 있다. 다른 응답이면 조용히 무시하고(아래에서) 정리한다.
    let snoozeUntil: string | undefined;
    if (input.response === "later" && input.snoozeUntil !== undefined) {
      // ISO 형식 검증은 단일 시점도 range 파서로 강제한다(다른 mutation 선례).
      const validated = parseScheduleRange({
        startAt: input.snoozeUntil,
        endAt: input.snoozeUntil,
      }).startAt;
      const snoozeMs = Date.parse(validated);
      const nowMs = Date.parse(this.now());
      if (snoozeMs <= nowMs) {
        throw new QueRuleError("INVALID_INPUT", "스누즈 시각은 미래여야 한다");
      }
      if (snoozeMs > nowMs + 48 * 60 * 60 * 1000) {
        throw new QueRuleError("INVALID_INPUT", "스누즈는 지금부터 최대 48시간까지만 미룰 수 있다");
      }
      snoozeUntil = validated;
    }

    // 응답 → 작업 상태 매핑. 상태 변경은 changeTaskStatus를 거쳐 규칙/로그가 동일 적용된다.
    const statusByResponse: Partial<Record<CheckInResponse, TaskStatus>> = {
      working: "in_progress",
      done: "done",
      needs_reschedule: "needs_reschedule",
      issue: "issue",
      not_needed: "cancelled",
      merged: "merged",
    };
    const to = statusByResponse[input.response];
    if (to) {
      this.changeTaskStatus(ctx, {
        taskId: checkIn.taskId,
        to,
        detail: input.detail,
        mergedIntoTaskId: input.mergedIntoTaskId,
      });
    }

    checkIn.answeredAt = this.now();
    checkIn.response = input.response;
    checkIn.followUpRequired = input.response === "later" || input.response === "issue";
    // later면 스누즈를 반영(없으면 undefined로 즉시 재노출), 그 외 definitive 응답은 스누즈를 정리한다.
    checkIn.snoozeUntil = input.response === "later" ? snoozeUntil : undefined;
    return checkIn;
  }

  /** 결제 요청 등록. 요청자는 본인(actor), 기본 상태 대기. */
  createPaymentRequest(
    ctx: ActorContext,
    input: {
      title: string;
      recipientName?: string;
      bankName: string;
      accountNumber: string;
      amount: number;
      description?: string;
      dueAt?: string;
      category: string;
    },
  ): PaymentRequest {
    const actor = this.requireUser(ctx.actorId);
    if (
      !input.title.trim() ||
      !input.bankName.trim() ||
      !input.accountNumber.trim() ||
      !input.category.trim()
    ) {
      throw new QueRuleError("INVALID_INPUT", "제목, 은행명, 계좌번호, 분류는 필수다");
    }
    if (
      input.title.length > 200 ||
      (input.recipientName?.length ?? 0) > 100 ||
      input.bankName.length > 50 ||
      input.accountNumber.length > 50 ||
      input.category.length > 50 ||
      (input.description?.length ?? 0) > 2000
    ) {
      throw new QueRuleError("INVALID_INPUT", "입력 길이 상한 초과 (제목 200, 수신자명 100, 은행/계좌/분류 50, 내용 2000자)");
    }
    if (!Number.isFinite(input.amount) || input.amount <= 0 || input.amount > 1_000_000_000_000) {
      throw new QueRuleError("INVALID_INPUT", "금액은 0보다 크고 1조 이하의 숫자여야 한다");
    }
    if (input.dueAt) {
      parseScheduleRange({ startAt: input.dueAt, endAt: input.dueAt });
    }

    const payment: PaymentRequest = {
      id: this.nextId("pay"),
      title: input.title.trim(),
      requesterId: actor.id,
      recipientName: input.recipientName?.trim() || undefined,
      bankName: input.bankName.trim(),
      accountNumber: input.accountNumber.trim(),
      amount: input.amount,
      description: input.description?.trim() || undefined,
      dueAt: input.dueAt,
      category: input.category.trim(),
      status: "waiting",
      createdAt: this.now(),
    };
    this.paymentRequests.push(payment);
    this.logChange(ctx, {
      entityType: "payment_request",
      entityId: payment.id,
      changeType: "create",
      afterValue: payment.title,
    });
    return payment;
  }

  /** 결제 상태 변경. 관리자는 전체, 요청자는 본인 요청 취소만 가능. */
  updatePaymentStatus(
    ctx: ActorContext,
    input: { paymentId: string; to: PaymentStatus },
  ): PaymentRequest {
    const actor = this.requireUser(ctx.actorId);
    const payment = this.paymentRequests.find((p) => p.id === input.paymentId);
    if (!payment) throw new QueRuleError("NOT_FOUND", `결제 요청 없음: ${input.paymentId}`);

    const isSelfCancel = payment.requesterId === actor.id && input.to === "cancelled";
    if (actor.role !== "admin" && !isSelfCancel) {
      throw new QueRuleError(
        "NOT_AUTHORIZED",
        "결제 상태는 관리자(또는 본인 취소)만 변경할 수 있다",
      );
    }

    const before = payment.status;
    payment.status = input.to;
    payment.lastChangedBy = actor.id;
    payment.lastChangedAt = this.now();

    this.logChange(ctx, {
      entityType: "payment_request",
      entityId: payment.id,
      changeType: "status_change",
      beforeValue: before,
      afterValue: input.to,
    });
    return payment;
  }

  paymentCategoryById(id: string | undefined): PaymentCategory | undefined {
    if (!id) return undefined;
    return this.paymentCategories.find((c) => c.id === id);
  }

  /** 결제 분류(카테고리) 생성 — 관리자만. 이름은 50자 이내로 검증한다(클라이언트 선례와 동일 구조). */
  createPaymentCategory(
    ctx: ActorContext,
    input: { name: string; status?: PaymentCategory["status"] },
  ): PaymentCategory {
    const actor = this.requireUser(ctx.actorId);
    if (!canManagePaymentCategory(actor)) {
      throw new QueRuleError("NOT_AUTHORIZED", "결제 분류는 관리자만 만들 수 있다");
    }
    // 신뢰 못 할 클라이언트 인자 — 이름/상태를 런타임 검증한다.
    const parsed = paymentCategorySchema
      .pick({ name: true, status: true })
      .safeParse({ name: input.name, status: input.status ?? "active" });
    if (!parsed.success) {
      throw new QueRuleError(
        "INVALID_INPUT",
        `결제 분류 입력이 유효하지 않다: ${parsed.error.issues.map((i) => i.message).join(", ")}`,
      );
    }

    // 새 분류는 표시 순서 맨 끝에 붙인다(현재 max + 1). 빈 목록이면 0.
    const maxSort = this.paymentCategories.reduce((m, c) => Math.max(m, c.sortOrder), -1);
    const category: PaymentCategory = {
      id: this.nextId("paycat"),
      name: parsed.data.name,
      status: parsed.data.status,
      sortOrder: maxSort + 1,
    };
    this.paymentCategories.push(category);
    this.logChange(ctx, {
      entityType: "payment_category",
      entityId: category.id,
      changeType: "create",
      afterValue: category.name,
    });
    return category;
  }

  /** 결제 분류 수정(이름·보관) — 관리자만. payment.category 문자열은 건드리지 않는다(하위호환). */
  updatePaymentCategory(
    ctx: ActorContext,
    input: { categoryId: string; name?: string; status?: PaymentCategory["status"] },
  ): PaymentCategory {
    const actor = this.requireUser(ctx.actorId);
    if (!canManagePaymentCategory(actor)) {
      throw new QueRuleError("NOT_AUTHORIZED", "결제 분류는 관리자만 수정할 수 있다");
    }
    const category = this.paymentCategories.find((c) => c.id === input.categoryId);
    if (!category) throw new QueRuleError("NOT_FOUND", `결제 분류 없음: ${input.categoryId}`);

    if (input.name !== undefined) {
      const parsed = paymentCategorySchema.shape.name.safeParse(input.name);
      if (!parsed.success) {
        throw new QueRuleError("INVALID_INPUT", "이름은 1~50자여야 한다");
      }
      category.name = parsed.data;
    }
    if (input.status !== undefined) {
      if (!paymentCategorySchema.shape.status.safeParse(input.status).success) {
        throw new QueRuleError("INVALID_INPUT", "잘못된 결제 분류 상태다");
      }
      category.status = input.status;
    }
    this.logChange(ctx, {
      entityType: "payment_category",
      entityId: category.id,
      changeType: "update",
      afterValue: category.name,
    });
    return category;
  }

  /** 결제 분류 표시 순서 변경 — 관리자만. orderedIds 순서대로 sortOrder를 0..n-1로 재설정한다.
   *  존재하지 않는 id나 중복은 거부한다(부분 반영 없이 통째로 실패). ChangeLog(via) 1건 기록. */
  reorderPaymentCategories(
    ctx: ActorContext,
    input: { orderedIds: string[] },
  ): PaymentCategory[] {
    const actor = this.requireUser(ctx.actorId);
    if (!canManagePaymentCategory(actor)) {
      throw new QueRuleError("NOT_AUTHORIZED", "결제 분류 순서는 관리자만 변경할 수 있다");
    }
    const ids = input.orderedIds;
    if (!Array.isArray(ids) || ids.length === 0) {
      throw new QueRuleError("INVALID_INPUT", "정렬할 결제 분류 목록이 비어 있다");
    }
    if (new Set(ids).size !== ids.length) {
      throw new QueRuleError("INVALID_INPUT", "정렬 목록에 중복된 결제 분류가 있다");
    }
    // 먼저 전부 검증한 뒤에 반영한다 — 잘못된 id가 하나라도 있으면 아무것도 바꾸지 않는다.
    const targets = ids.map((id) => {
      const category = this.paymentCategories.find((c) => c.id === id);
      if (!category) throw new QueRuleError("NOT_FOUND", `결제 분류 없음: ${id}`);
      return category;
    });
    const before = targets.map((c) => `${c.id}:${c.sortOrder}`).join(",");
    targets.forEach((category, index) => {
      category.sortOrder = index;
    });
    this.logChange(ctx, {
      entityType: "payment_category",
      entityId: targets[0].id, // 대표 — before/after에 전체 순서를 담는다
      changeType: "update",
      beforeValue: before,
      afterValue: ids.map((id, i) => `${id}:${i}`).join(","),
      reason: "표시 순서 변경",
    });
    return targets;
  }

  /** 수정사항(이슈/피드백) 등록 — 팀 공용. 인증만 하면 누구나 작성한다(소유자 제한 없음).
   *  테스트 중 발견한 수정사항 메모라 비즈니스 업무 데이터가 아니다 — ChangeLog는 남기지 않는다.
   *  입력은 신뢰하지 않고 스키마로 파싱한다(웹/MCP/CLI 공유 경로). status 기본은 미해결(unresolved). */
  createRevisionNote(
    ctx: ActorContext,
    input: { menu: string; location?: string; description: string; status?: RevisionNoteStatus },
  ): RevisionNote {
    const actor = this.requireUser(ctx.actorId);
    const parsed = createRevisionNoteInputSchema.safeParse(input);
    if (!parsed.success) {
      throw new QueRuleError(
        "INVALID_INPUT",
        parsed.error.issues.map((i) => i.message).join(", "),
      );
    }
    const note: RevisionNote = {
      id: this.nextId("rev"),
      menu: parsed.data.menu,
      // trim 후 빈 문자열이면 undefined로 정규화(선택 컬럼)
      location: parsed.data.location || undefined,
      description: parsed.data.description,
      status: parsed.data.status ?? "unresolved",
      authorId: actor.id,
      createdAt: this.now(),
    };
    this.revisionNotes.push(note);
    return note;
  }

  /** 수정사항 상태 변경 — 팀 공용. 누구나 상태를 바꿀 수 있다(소유자 제한 없음).
   *  updatedAt/updatedBy만 추적한다(ChangeLog 없음). status는 enum을 런타임 검증한다. */
  updateRevisionNoteStatus(
    ctx: ActorContext,
    input: { id: string; status: RevisionNoteStatus },
  ): RevisionNote {
    const actor = this.requireUser(ctx.actorId);
    const note = this.revisionNotes.find((n) => n.id === input.id);
    if (!note) throw new QueRuleError("NOT_FOUND", `수정사항 없음: ${input.id}`);
    if (!revisionNoteStatusSchema.safeParse(input.status).success) {
      throw new QueRuleError("INVALID_INPUT", "잘못된 상태다");
    }
    note.status = input.status;
    note.updatedAt = this.now();
    note.updatedBy = actor.id;
    return note;
  }

  // ---------- 데일리 스탠드업 (비동기 체크인, 기획 §2) ----------

  /** 스탠드업 체크인 제출. **본인만** — userId는 입력이 아니라 ctx.actorId에서 온다(대리 제출 차단).
   *  (date, userId) 유니크 1건: 이미 있으면 덮어쓰기(updatedAt 갱신·submittedAt 유지), 없으면 생성.
   *  focus 필수. ChangeLog는 남기지 않는다(운영 리듬 기록 — RevisionNote 선례, 기획 §2 명시).
   *  입력은 신뢰하지 않고 스키마로 파싱한다(웹/MCP/CLI 공유 경로). */
  submitStandupEntry(
    ctx: ActorContext,
    input: {
      date: string;
      focus: string;
      note?: string;
      blockerText?: string;
      blockedTaskIds?: string[];
      snapshotTaskIds: StandupEntry["snapshotTaskIds"];
      aiDrafted?: boolean;
      draftEdited?: boolean;
    },
  ): StandupEntry {
    const actor = this.requireUser(ctx.actorId);
    const parsed = submitStandupEntryInputSchema.safeParse(input);
    if (!parsed.success) {
      throw new QueRuleError(
        "INVALID_INPUT",
        parsed.error.issues.map((i) => i.message).join(", "),
      );
    }
    const data = parsed.data;
    const nowIso = this.now();
    const existing = this.standupEntries.find(
      (e) => e.date === data.date && e.userId === actor.id,
    );
    if (existing) {
      // 덮어쓰기 — 최초 제출 시각(submittedAt)은 유지하고 updatedAt만 갱신한다.
      existing.focus = data.focus;
      existing.note = data.note || undefined;
      existing.blockerText = data.blockerText || undefined;
      existing.blockedTaskIds = data.blockedTaskIds?.length ? data.blockedTaskIds : undefined;
      existing.snapshotTaskIds = data.snapshotTaskIds;
      existing.aiDrafted = data.aiDrafted ?? false;
      existing.draftEdited = data.draftEdited;
      existing.updatedAt = nowIso;
      return existing;
    }
    const entry: StandupEntry = {
      id: this.nextId("standup"),
      date: data.date,
      userId: actor.id,
      focus: data.focus,
      note: data.note || undefined,
      blockerText: data.blockerText || undefined,
      blockedTaskIds: data.blockedTaskIds?.length ? data.blockedTaskIds : undefined,
      snapshotTaskIds: data.snapshotTaskIds,
      aiDrafted: data.aiDrafted ?? false,
      draftEdited: data.draftEdited,
      submittedAt: nowIso,
      updatedAt: nowIso,
    };
    this.standupEntries.push(entry);
    return entry;
  }

  /** 특정 날짜(KST YYYY-MM-DD)의 스탠드업 체크인 전체 — 조회는 전원 열람. */
  standupEntriesByDate(date: string): StandupEntry[] {
    return this.standupEntries.filter((e) => e.date === date);
  }

  /**
   * AI 팀 요약 저장(date 유니크 덮어쓰기). **시스템(크론) 생성이라 권한은 호출부가 강제한다** —
   * 최초 자동 생성은 크론, 재생성은 admin만(regeneratedBy에 그 actorId). AI 저장 관례의 의도적 예외(기획 §2).
   * content/model/submittedUserIds를 받아 generatedAt=now로 upsert한다. ChangeLog는 남기지 않는다(운영 리듬 산출물).
   */
  saveStandupTeamSummary(input: {
    date: string;
    model: StandupTeamSummary["model"];
    content: string;
    submittedUserIds: string[];
    regeneratedBy?: string;
  }): StandupTeamSummary {
    const nowIso = this.now();
    const existing = this.standupTeamSummaries.find((s) => s.date === input.date);
    if (existing) {
      // 재생성 — 같은 행을 덮어쓴다(새 행 없이 generatedAt만 갱신).
      existing.model = input.model;
      existing.content = input.content;
      existing.submittedUserIds = input.submittedUserIds;
      existing.regeneratedBy = input.regeneratedBy;
      existing.generatedAt = nowIso;
      return existing;
    }
    const summary: StandupTeamSummary = {
      id: this.nextId("stsum"),
      date: input.date,
      generatedAt: nowIso,
      model: input.model,
      content: input.content,
      submittedUserIds: input.submittedUserIds,
      regeneratedBy: input.regeneratedBy,
    };
    this.standupTeamSummaries.push(summary);
    return summary;
  }

  /** 특정 날짜(KST YYYY-MM-DD)의 AI 팀 요약 — 없으면 undefined. 조회는 전원 열람. */
  standupTeamSummaryByDate(date: string): StandupTeamSummary | undefined {
    return this.standupTeamSummaries.find((s) => s.date === date);
  }

  // ---------- OKR (분기 목표 + 월 핵심결과, 기획 §2·§6) ----------
  // 목표 데이터는 감사 대상 — 생성·진척 변경은 ChangeLog에 남긴다(운영 리듬 산출물인 standup과 다르다).
  // 입력은 신뢰하지 않고 스키마로 파싱한다(웹/MCP/CLI 공유 경로).

  private requireObjective(id: string): Objective {
    const obj = this.objectives.find((o) => o.id === id);
    if (!obj) throw new QueRuleError("NOT_FOUND", `Objective 없음: ${id}`);
    return obj;
  }

  private requireKeyResult(id: string): KeyResult {
    const kr = this.keyResults.find((k) => k.id === id);
    if (!kr) throw new QueRuleError("NOT_FOUND", `핵심결과(KR) 없음: ${id}`);
    return kr;
  }

  /** Objective 생성 — **admin만**(기획 §6). ownerId 실재+재직 검증. ChangeLog(create) 기록. */
  createObjective(
    ctx: ActorContext,
    input: {
      title: string;
      description?: string;
      period: string;
      ownerId: string;
      status?: ObjectiveStatus;
      order?: number;
    },
  ): Objective {
    const actor = this.requireUser(ctx.actorId);
    if (actor.role !== "admin") {
      throw new QueRuleError("NOT_AUTHORIZED", "분기 목표(Objective)는 관리자만 만들 수 있다");
    }
    const parsed = createObjectiveInputSchema.safeParse(input);
    if (!parsed.success) {
      throw new QueRuleError("INVALID_INPUT", parsed.error.issues.map((i) => i.message).join(", "));
    }
    const data = parsed.data;
    this.requireActiveAssignee(data.ownerId); // 소유자 실재+재직 검증
    // order 미지정이면 같은 분기 내 마지막 뒤에 붙인다.
    const order =
      data.order ??
      this.objectives.filter((o) => o.period === data.period).reduce((m, o) => Math.max(m, o.order + 1), 0);
    const objective: Objective = {
      id: this.nextId("obj"),
      title: data.title,
      description: data.description || undefined,
      period: data.period,
      ownerId: data.ownerId,
      status: data.status ?? "active",
      order,
      createdAt: this.now(),
    };
    this.objectives.push(objective);
    this.logChange(ctx, {
      entityType: "objective",
      entityId: objective.id,
      changeType: "create",
      afterValue: `${objective.title} (${objective.period})`,
    });
    return objective;
  }

  /** Objective 수정 — **admin만**(title/description/status/order). ChangeLog(update) 기록. */
  updateObjective(
    ctx: ActorContext,
    input: {
      objectiveId: string;
      title?: string;
      description?: string | null;
      status?: ObjectiveStatus;
      order?: number;
    },
  ): Objective {
    const actor = this.requireUser(ctx.actorId);
    if (actor.role !== "admin") {
      throw new QueRuleError("NOT_AUTHORIZED", "분기 목표(Objective)는 관리자만 수정할 수 있다");
    }
    const objective = this.requireObjective(input.objectiveId);
    const before: string[] = [];
    const changes: string[] = [];

    if (input.title !== undefined) {
      const title = input.title.trim();
      if (!title) throw new QueRuleError("INVALID_INPUT", "제목은 필수다");
      if (title.length > 200) throw new QueRuleError("INVALID_INPUT", "제목은 200자 이내다");
      if (title !== objective.title) {
        before.push(`제목: ${objective.title}`);
        changes.push(`제목: ${title}`);
        objective.title = title;
      }
    }
    if (input.description !== undefined) {
      const description = input.description?.trim() || undefined;
      if ((description?.length ?? 0) > 2000) {
        throw new QueRuleError("INVALID_INPUT", "설명은 2000자 이내다");
      }
      if (description !== objective.description) {
        before.push(`설명: ${objective.description ?? "(없음)"}`);
        changes.push(`설명: ${description ?? "(없음)"}`);
        objective.description = description;
      }
    }
    if (input.status !== undefined) {
      if (!objectiveStatusSchema.safeParse(input.status).success) {
        throw new QueRuleError("INVALID_INPUT", "잘못된 Objective 상태다");
      }
      if (input.status !== objective.status) {
        before.push(`상태: ${objective.status}`);
        changes.push(`상태: ${input.status}`);
        objective.status = input.status;
      }
    }
    if (input.order !== undefined) {
      if (!Number.isFinite(input.order)) {
        throw new QueRuleError("INVALID_INPUT", "잘못된 정렬 순서다");
      }
      if (input.order !== objective.order) {
        before.push(`순서: ${objective.order}`);
        changes.push(`순서: ${input.order}`);
        objective.order = input.order;
      }
    }

    if (changes.length === 0) return objective; // no-op ChangeLog 방지
    this.logChange(ctx, {
      entityType: "objective",
      entityId: objective.id,
      changeType: "update",
      beforeValue: before.join(" · "),
      afterValue: changes.join(" · "),
    });
    return objective;
  }

  /** 특정 분기(YYYY-Qn)의 Objective — order 오름차순. 조회는 전원 열람. */
  objectivesByPeriod(period: string): Objective[] {
    return this.objectives
      .filter((o) => o.period === period)
      .sort((a, b) => a.order - b.order);
  }

  /** KR 생성 — **admin 또는 해당 Objective 소유자**(기획 §6). manual이면 targetValue 필수(스키마 강제).
   *  ownerId 실재+재직 검증. ChangeLog(create) 기록. */
  createKeyResult(
    ctx: ActorContext,
    input: {
      objectiveId: string;
      title: string;
      ownerId: string;
      month: string;
      metricType: KeyResult["metricType"];
      targetValue?: number;
      currentValue?: number;
      unit?: string;
      stateChecks?: StateCheckInput[];
      status?: KeyResultStatus;
    },
  ): KeyResult {
    const actor = this.requireUser(ctx.actorId);
    const parsed = createKeyResultInputSchema.safeParse(input);
    if (!parsed.success) {
      throw new QueRuleError("INVALID_INPUT", parsed.error.issues.map((i) => i.message).join(", "));
    }
    const data = parsed.data;
    const objective = this.requireObjective(data.objectiveId); // Objective 실재 검증
    if (actor.role !== "admin" && objective.ownerId !== actor.id) {
      throw new QueRuleError(
        "NOT_AUTHORIZED",
        "핵심결과(KR)는 관리자 또는 해당 목표 소유자만 만들 수 있다",
      );
    }
    this.requireActiveAssignee(data.ownerId); // KR 소유자 실재+재직 검증
    const nowIso = this.now();
    // state면 입력 체크 항목에 id를 부여하고 done=false로 초기화(id·done은 서버가 소유).
    const stateChecks: StateCheck[] | undefined =
      data.metricType === "state"
        ? (data.stateChecks ?? []).map((c) => ({
            id: this.nextId("chk"),
            label: c.label,
            done: false,
            requiresAdminConfirm: c.requiresAdminConfirm,
          }))
        : undefined;
    const kr: KeyResult = {
      id: this.nextId("kr"),
      objectiveId: data.objectiveId,
      title: data.title,
      ownerId: data.ownerId,
      month: data.month,
      metricType: data.metricType,
      targetValue: data.metricType === "manual" ? data.targetValue : undefined,
      currentValue: data.metricType === "manual" ? data.currentValue ?? 0 : undefined,
      unit: data.metricType === "manual" ? data.unit || undefined : undefined,
      stateChecks,
      status: data.status ?? "active",
      updatedAt: nowIso,
      updatedBy: actor.id,
    };
    this.keyResults.push(kr);
    this.logChange(ctx, {
      entityType: "key_result",
      entityId: kr.id,
      changeType: "create",
      afterValue: `${kr.title} (${kr.month}, ${kr.metricType})`,
    });
    return kr;
  }

  /** KR 수정(제목·월·metricType·단위·목표치·상태·소유자) — **admin 또는 해당 Objective 소유자**.
   *  진척(currentValue)은 여기서 바꾸지 않는다 — updateKeyResultProgress(소유자+admin) 별도 경로. */
  updateKeyResult(
    ctx: ActorContext,
    input: {
      keyResultId: string;
      title?: string;
      month?: string;
      metricType?: KeyResult["metricType"];
      targetValue?: number | null;
      unit?: string | null;
      stateChecks?: StateCheckInput[];
      status?: KeyResultStatus;
      ownerId?: string;
    },
  ): KeyResult {
    const actor = this.requireUser(ctx.actorId);
    const kr = this.requireKeyResult(input.keyResultId);
    const objective = this.requireObjective(kr.objectiveId);
    if (actor.role !== "admin" && objective.ownerId !== actor.id) {
      throw new QueRuleError(
        "NOT_AUTHORIZED",
        "핵심결과(KR)는 관리자 또는 해당 목표 소유자만 수정할 수 있다",
      );
    }
    const before: string[] = [];
    const changes: string[] = [];

    if (input.title !== undefined) {
      const title = input.title.trim();
      if (!title) throw new QueRuleError("INVALID_INPUT", "제목은 필수다");
      if (title.length > 200) throw new QueRuleError("INVALID_INPUT", "제목은 200자 이내다");
      if (title !== kr.title) {
        before.push(`제목: ${kr.title}`);
        changes.push(`제목: ${title}`);
        kr.title = title;
      }
    }
    if (input.month !== undefined) {
      if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(input.month)) {
        throw new QueRuleError("INVALID_INPUT", "월은 YYYY-MM 형식이어야 한다 (예: 2026-07)");
      }
      if (input.month !== kr.month) {
        before.push(`월: ${kr.month}`);
        changes.push(`월: ${input.month}`);
        kr.month = input.month;
      }
    }
    if (input.ownerId !== undefined && input.ownerId !== kr.ownerId) {
      this.requireActiveAssignee(input.ownerId); // 새 소유자 실재+재직 검증
      before.push(`소유자: ${kr.ownerId}`);
      changes.push(`소유자: ${input.ownerId}`);
      kr.ownerId = input.ownerId;
    }
    if (input.status !== undefined) {
      if (!keyResultStatusSchema.safeParse(input.status).success) {
        throw new QueRuleError("INVALID_INPUT", "잘못된 KR 상태다");
      }
      if (input.status !== kr.status) {
        before.push(`상태: ${kr.status}`);
        changes.push(`상태: ${input.status}`);
        kr.status = input.status;
      }
    }
    // metricType/targetValue/unit는 상호 의존(manual만 target·unit 유효)이라 함께 판정한다.
    const nextMetricType = input.metricType ?? kr.metricType;
    if (input.metricType !== undefined && input.metricType !== kr.metricType) {
      if (!keyResultMetricTypeSchema.safeParse(input.metricType).success) {
        throw new QueRuleError("INVALID_INPUT", "잘못된 측정 방식이다");
      }
      before.push(`측정: ${kr.metricType}`);
      changes.push(`측정: ${input.metricType}`);
      kr.metricType = input.metricType;
    }
    // stateChecks 입력은 state KR에서만 유효 — 다른 측정 방식이면 거부(배타).
    if (input.stateChecks !== undefined && nextMetricType !== "state") {
      throw new QueRuleError("INVALID_INPUT", "state가 아닌 KR에는 체크 항목을 넣을 수 없다");
    }
    if (nextMetricType === "manual") {
      // 목표치: 지정되면 갱신, 미지정이면 유지. 최종 목표치가 없으면(양수 아님) 거부.
      const nextTarget =
        input.targetValue === undefined
          ? kr.targetValue
          : input.targetValue === null
            ? undefined
            : input.targetValue;
      if ((nextTarget ?? 0) <= 0) {
        throw new QueRuleError("INVALID_INPUT", "manual KR은 목표치(targetValue)가 필수다 (양수)");
      }
      if (nextTarget !== kr.targetValue) {
        before.push(`목표치: ${kr.targetValue ?? "(없음)"}`);
        changes.push(`목표치: ${nextTarget}`);
        kr.targetValue = nextTarget;
      }
      if (input.unit !== undefined) {
        const unit = input.unit === null ? undefined : input.unit.trim() || undefined;
        if ((unit?.length ?? 0) > 20) throw new QueRuleError("INVALID_INPUT", "단위는 20자 이내다");
        if (unit !== kr.unit) {
          before.push(`단위: ${kr.unit ?? "(없음)"}`);
          changes.push(`단위: ${unit ?? "(없음)"}`);
          kr.unit = unit;
        }
      }
      // manual로 바뀌면 state 체크는 정리한다.
      if (kr.stateChecks !== undefined) kr.stateChecks = undefined;
    } else if (nextMetricType === "state") {
      // 체크 항목 정의를 새로 받으면 교체(id 재부여). 같은 label의 done/confirmedBy/doneAt는 보존한다.
      if (input.stateChecks !== undefined) {
        if (input.stateChecks.length < 1) {
          throw new QueRuleError("INVALID_INPUT", "state KR은 체크 항목이 1개 이상 필요하다");
        }
        if (input.stateChecks.length > 7) {
          throw new QueRuleError("INVALID_INPUT", "체크 항목은 7개 이내다");
        }
        const prevByLabel = new Map((kr.stateChecks ?? []).map((c) => [c.label, c]));
        const next: StateCheck[] = input.stateChecks.map((c) => {
          const label = c.label.trim();
          if (!label) throw new QueRuleError("INVALID_INPUT", "체크 항목 라벨은 필수다");
          if (label.length > 100) throw new QueRuleError("INVALID_INPUT", "체크 항목은 100자 이내다");
          const prev = prevByLabel.get(label);
          return {
            id: prev?.id ?? this.nextId("chk"),
            label,
            done: prev?.done ?? false,
            requiresAdminConfirm: c.requiresAdminConfirm,
            confirmedBy: prev?.done ? prev.confirmedBy : undefined,
            doneAt: prev?.done ? prev.doneAt : undefined,
          };
        });
        before.push(`체크: ${(kr.stateChecks ?? []).map((c) => c.label).join("/") || "(없음)"}`);
        changes.push(`체크: ${next.map((c) => c.label).join("/")}`);
        kr.stateChecks = next;
      } else if ((kr.stateChecks?.length ?? 0) < 1) {
        // state로 전환하는데 기존/입력 체크가 없으면 거부(1개 이상 필수).
        throw new QueRuleError("INVALID_INPUT", "state KR은 체크 항목이 1개 이상 필요하다");
      }
      // state로 바뀌면 manual 필드는 정리한다.
      if (kr.targetValue !== undefined || kr.currentValue !== undefined || kr.unit !== undefined) {
        kr.targetValue = undefined;
        kr.currentValue = undefined;
        kr.unit = undefined;
      }
    } else if (nextMetricType === "task_auto") {
      // task_auto로 바뀌면 manual·state 필드는 의미가 없다 — 정리한다(진척은 연결 Task로 계산).
      if (kr.targetValue !== undefined || kr.currentValue !== undefined || kr.unit !== undefined) {
        kr.targetValue = undefined;
        kr.currentValue = undefined;
        kr.unit = undefined;
      }
      if (kr.stateChecks !== undefined) kr.stateChecks = undefined;
    }

    if (changes.length === 0) return kr; // no-op ChangeLog 방지
    kr.updatedAt = this.now();
    kr.updatedBy = actor.id;
    this.logChange(ctx, {
      entityType: "key_result",
      entityId: kr.id,
      changeType: "update",
      beforeValue: before.join(" · "),
      afterValue: changes.join(" · "),
    });
    return kr;
  }

  /** KR 진척(currentValue) 입력 — **KR 소유자 본인 또는 admin만**(기획 §6). manual KR에서만 유효.
   *  목표 데이터는 감사 대상이라 ChangeLog(update) 기록. */
  updateKeyResultProgress(
    ctx: ActorContext,
    input: { keyResultId: string; currentValue: number },
  ): KeyResult {
    const actor = this.requireUser(ctx.actorId);
    const kr = this.requireKeyResult(input.keyResultId);
    if (actor.role !== "admin" && kr.ownerId !== actor.id) {
      throw new QueRuleError(
        "NOT_AUTHORIZED",
        "핵심결과(KR) 진척은 소유자 본인 또는 관리자만 입력할 수 있다",
      );
    }
    if (kr.metricType !== "manual") {
      throw new QueRuleError(
        "INVALID_INPUT",
        "task_auto KR의 진척은 연결 작업 완료율로 자동 계산된다 — 직접 입력할 수 없다",
      );
    }
    if (!Number.isFinite(input.currentValue) || input.currentValue < 0) {
      throw new QueRuleError("INVALID_INPUT", "진척 값은 0 이상의 숫자여야 한다");
    }
    const before = kr.currentValue ?? 0;
    if (input.currentValue === before) return kr; // no-op
    kr.currentValue = input.currentValue;
    kr.updatedAt = this.now();
    kr.updatedBy = actor.id;
    this.logChange(ctx, {
      entityType: "key_result",
      entityId: kr.id,
      changeType: "update",
      beforeValue: `진척: ${before}`,
      afterValue: `진척: ${input.currentValue}`,
    });
    return kr;
  }

  /** 특정 Objective의 KR 목록 — 월 오름차순. 조회는 전원 열람. */
  keyResultsByObjective(objectiveId: string): KeyResult[] {
    return this.keyResults
      .filter((k) => k.objectiveId === objectiveId)
      .sort((a, b) => a.month.localeCompare(b.month));
  }

  /** 상태형 KR(OS-1 부록 A)의 체크 항목 토글 — **KR 소유자 또는 admin**. 단,
   *  requiresAdminConfirm 항목은 **admin만** 토글할 수 있다(클라이언트 최종 승인 등 이중 확인).
   *  done→doneAt·confirmedBy 기록, 해제→둘 다 정리. 목표 데이터는 감사 대상이라 ChangeLog(update). */
  toggleKeyResultCheck(
    ctx: ActorContext,
    input: { keyResultId: string; checkId: string; done: boolean },
  ): KeyResult {
    const actor = this.requireUser(ctx.actorId);
    const kr = this.requireKeyResult(input.keyResultId);
    const isAdmin = actor.role === "admin";
    if (!isAdmin && kr.ownerId !== actor.id) {
      throw new QueRuleError(
        "NOT_AUTHORIZED",
        "핵심결과(KR) 체크는 소유자 본인 또는 관리자만 토글할 수 있다",
      );
    }
    if (kr.metricType !== "state") {
      throw new QueRuleError("INVALID_INPUT", "상태 체크는 state 측정 KR에서만 토글할 수 있다");
    }
    const check = kr.stateChecks?.find((c) => c.id === input.checkId);
    if (!check) {
      throw new QueRuleError("NOT_FOUND", `체크 항목 없음: ${input.checkId}`);
    }
    if (check.requiresAdminConfirm && !isAdmin) {
      throw new QueRuleError(
        "NOT_AUTHORIZED",
        "'관리자 확인' 항목은 관리자만 완료/해제할 수 있다",
      );
    }
    if (check.done === input.done) return kr; // no-op
    check.done = input.done;
    if (input.done) {
      check.doneAt = this.now();
      check.confirmedBy = actor.id;
    } else {
      check.doneAt = undefined;
      check.confirmedBy = undefined;
    }
    kr.updatedAt = this.now();
    kr.updatedBy = actor.id;
    this.logChange(ctx, {
      entityType: "key_result",
      entityId: kr.id,
      changeType: "update",
      afterValue: `체크: ${check.label} ${input.done ? "완료" : "해제"}`,
    });
    return kr;
  }

  // ---------- MilestoneRetro (OS-2a 실패 분류, 부록 B) ----------
  // 회고=기록 그 자체라 ChangeLog를 남기지 않는다(revision_notes 선례). 불변 레코드(updatedAt 없음).
  // 권한: 마일스톤 담당(프로젝트 owner)·admin(canManageMilestone 준용).

  private requireMilestone(id: string): Milestone {
    const m = this.milestones.find((x) => x.id === id);
    if (!m) throw new QueRuleError("NOT_FOUND", `마일스톤 없음: ${id}`);
    return m;
  }

  /** 마일스톤 회고 생성 — **마일스톤 담당·admin**(canManageMilestone 준용). enum은 스키마가 강제. */
  createMilestoneRetro(
    ctx: ActorContext,
    input: {
      milestoneId: string;
      cause: RetroCause;
      causeDetail: RetroCauseDetail;
      note?: string;
      managed?: boolean;
    },
  ): MilestoneRetro {
    const actor = this.requireUser(ctx.actorId);
    const parsed = createMilestoneRetroInputSchema.safeParse(input);
    if (!parsed.success) {
      throw new QueRuleError("INVALID_INPUT", parsed.error.issues.map((i) => i.message).join(", "));
    }
    const data = parsed.data;
    const milestone = this.requireMilestone(data.milestoneId); // 마일스톤 실재 검증
    const project = this.projects.find((p) => p.id === milestone.projectId);
    if (!canManageMilestone(actor, project)) {
      throw new QueRuleError(
        "NOT_AUTHORIZED",
        "마일스톤 회고는 담당자 또는 관리자만 남길 수 있다",
      );
    }
    const retro: MilestoneRetro = {
      id: this.nextId("retro"),
      milestoneId: data.milestoneId,
      cause: data.cause,
      causeDetail: data.causeDetail,
      note: data.note || undefined,
      managed: data.managed,
      createdBy: actor.id,
      createdAt: this.now(),
    };
    this.milestoneRetros.push(retro);
    return retro;
  }

  /** 특정 마일스톤의 회고 목록(최신순). 조회는 전원 열람. */
  retrosByMilestone(milestoneId: string): MilestoneRetro[] {
    return this.milestoneRetros
      .filter((r) => r.milestoneId === milestoneId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  // ---------- ChangeRequest (OS-2b 외부 변경 접수, 부록 C) ----------
  // 접수→분석→재협의→승인→종결 5단계(순서 강제). SLA 24h. 업무 영향이라 ChangeLog 기록.

  private requireChangeRequest(id: string): ChangeRequest {
    const cr = this.changeRequests.find((c) => c.id === id);
    if (!cr) throw new QueRuleError("NOT_FOUND", `변경 요청 없음: ${id}`);
    return cr;
  }

  /** 외부 변경 접수 — **프로젝트 담당·admin**(canManageProject 준용). impactDeadline=접수+24h 자동. */
  createChangeRequest(
    ctx: ActorContext,
    input: {
      projectId: string;
      milestoneId?: string;
      title: string;
      description?: string;
    },
  ): ChangeRequest {
    const actor = this.requireUser(ctx.actorId);
    const parsed = createChangeRequestInputSchema.safeParse(input);
    if (!parsed.success) {
      throw new QueRuleError("INVALID_INPUT", parsed.error.issues.map((i) => i.message).join(", "));
    }
    const data = parsed.data;
    const project = this.projects.find((p) => p.id === data.projectId);
    if (!project) {
      throw new QueRuleError("NOT_FOUND", `프로젝트 없음: ${data.projectId}`);
    }
    if (!canManageProject(actor, project)) {
      throw new QueRuleError(
        "NOT_AUTHORIZED",
        "외부 변경 접수는 프로젝트 담당자 또는 관리자만 할 수 있다",
      );
    }
    if (data.milestoneId) this.requireMilestone(data.milestoneId); // 지정 시 실재 검증
    const nowIso = this.now();
    const deadline = new Date(new Date(nowIso).getTime() + 24 * 60 * 60 * 1000).toISOString();
    const cr: ChangeRequest = {
      id: this.nextId("chgreq"),
      projectId: data.projectId,
      milestoneId: data.milestoneId || undefined,
      title: data.title,
      description: data.description || undefined,
      stage: "received",
      receivedAt: nowIso,
      impactDeadline: deadline,
      stageLog: [{ stage: "received", at: nowIso, by: actor.id }],
    };
    this.changeRequests.push(cr);
    this.logChange(ctx, {
      entityType: "change_request",
      entityId: cr.id,
      changeType: "create",
      afterValue: `${cr.title} (접수)`,
    });
    return cr;
  }

  /** 변경 대응 단계 진행 — **프로젝트 담당·admin**. 순서 강제(건너뛰기 거부), approved는 **admin만**,
   *  closed 도달 시 closedAt 기록 + (milestoneId 있으면) external·managed 회고 자동 생성. */
  advanceChangeRequestStage(
    ctx: ActorContext,
    input: { changeRequestId: string; toStage: ChangeRequestStage },
  ): ChangeRequest {
    const actor = this.requireUser(ctx.actorId);
    const cr = this.requireChangeRequest(input.changeRequestId);
    const project = this.projects.find((p) => p.id === cr.projectId);
    if (!canManageProject(actor, project)) {
      throw new QueRuleError(
        "NOT_AUTHORIZED",
        "변경 대응 진행은 프로젝트 담당자 또는 관리자만 할 수 있다",
      );
    }
    const ORDER: ChangeRequestStage[] = [
      "received",
      "impact_analyzed",
      "renegotiated",
      "approved",
      "closed",
    ];
    const fromIdx = ORDER.indexOf(cr.stage);
    const toIdx = ORDER.indexOf(input.toStage);
    if (toIdx < 0) {
      throw new QueRuleError("INVALID_INPUT", "잘못된 단계다");
    }
    if (toIdx !== fromIdx + 1) {
      throw new QueRuleError(
        "INVALID_INPUT",
        "변경 대응 단계는 순서대로만 진행할 수 있다(건너뛰기 불가)",
      );
    }
    if (input.toStage === "approved" && actor.role !== "admin") {
      throw new QueRuleError("NOT_AUTHORIZED", "승인 단계는 관리자만 진행할 수 있다");
    }
    const nowIso = this.now();
    const before = cr.stage;
    cr.stage = input.toStage;
    cr.stageLog = [...cr.stageLog, { stage: input.toStage, at: nowIso, by: actor.id }];
    if (input.toStage === "closed") {
      cr.closedAt = nowIso;
    }
    this.logChange(ctx, {
      entityType: "change_request",
      entityId: cr.id,
      changeType: "status_change",
      beforeValue: `단계: ${before}`,
      afterValue: `단계: ${input.toStage}`,
    });
    // 종결 시 external·managed 회고 자동 생성("대응을 탔다"는 사실 기록) — milestoneId 있을 때만.
    if (input.toStage === "closed" && cr.milestoneId) {
      const milestone = this.milestones.find((m) => m.id === cr.milestoneId);
      if (milestone) {
        const retro: MilestoneRetro = {
          id: this.nextId("retro"),
          milestoneId: cr.milestoneId,
          cause: "external",
          causeDetail: "client_direction",
          note: `외부 변경 대응 종결: ${cr.title}`,
          managed: true,
          createdBy: actor.id,
          createdAt: nowIso,
        };
        this.milestoneRetros.push(retro);
      }
    }
    return cr;
  }

  /** 진행 중(종결 전) 변경 요청 목록 — 접수 최신순. 조회는 전원 열람. */
  openChangeRequests(): ChangeRequest[] {
    return this.changeRequests
      .filter((c) => c.stage !== "closed")
      .sort((a, b) => b.receivedAt.localeCompare(a.receivedAt));
  }

  // ---------- 내부 ----------

  private requireActionItem(id: string): ActionItem {
    const item = this.actionItems.find((a) => a.id === id);
    if (!item) throw new QueRuleError("NOT_FOUND", `Action 없음: ${id}`);
    return item;
  }

  private meetingNoteName(id: string): string {
    return this.meetingNotes.find((n) => n.id === id)?.fileName ?? id;
  }

  private meetingNoteOf(item: ActionItem): MeetingNote | undefined {
    return this.meetingNotes.find((n) => n.id === item.meetingNoteId);
  }

  // ---------- 알림 아웃박스 (Slack 발송 원장, B-1) ----------
  // mutation과 동일 인스턴스에서 조작하고, 호출부가 이어서 `await db.persist()`로 write-through한다.
  // 발송/드레인/훅 배선은 web 계층(dispatch·cron)이 담당한다 — core는 원장 CRUD만 제공.

  /**
   * 발송 의도를 아웃박스에 적재. dedup_key 기준 "ON CONFLICT DO NOTHING" 시맨틱 —
   * 이미 같은 키가 있으면 무시한다(재요청·크론 재실행 안전). 새로 적재된 항목만 반환한다.
   * holdUntil을 주면 방해금지 보류 상태(held)로 적재(없으면 pending).
   */
  enqueueNotifications(
    intents: NotificationIntent[],
    opts?: { holdUntil?: string },
  ): NotificationOutboxEntry[] {
    const existing = new Set(this.notificationOutbox.map((e) => e.dedupKey));
    const created: NotificationOutboxEntry[] = [];
    for (const intent of intents) {
      const dedupKey = dedupKeyFor(intent);
      if (existing.has(dedupKey)) continue; // 이미 있음 → 무시
      existing.add(dedupKey);
      const entry: NotificationOutboxEntry = {
        id: this.nextId("notif"),
        dedupKey,
        kind: intent.kind,
        entityType: intent.entityType,
        entityId: intent.entityId,
        recipient: intent.recipient, // 팀채널 계열=undefined, personal_digest=Que userId(발송 직전 해석)
        payload: intent.payload,
        status: opts?.holdUntil ? "held" : "pending",
        attempts: 0,
        holdUntil: opts?.holdUntil,
        createdAt: this.now(),
      };
      this.notificationOutbox.push(entry);
      created.push(entry);
    }
    return created;
  }

  /** 발송 대기(pending) 항목. */
  pendingNotifications(): NotificationOutboxEntry[] {
    return this.notificationOutbox.filter((e) => e.status === "pending");
  }

  /** 방해금지로 보류(held)된 항목. 크론이 hold_until 경과분을 드레인한다. */
  heldNotifications(): NotificationOutboxEntry[] {
    return this.notificationOutbox.filter((e) => e.status === "held");
  }

  /**
   * 방해금지(quiet hours)로 보류(held)된 항목 중 hold_until이 지난 것을 pending으로 푼다.
   * 크론 드레인이 먼저 호출해, 방해금지 창이 끝난 알림을 발송 대기로 되돌린다. 푼 항목을 반환한다.
   * (hold_until이 없는 held는 방어적으로 즉시 해제한다 — 정상 경로에선 항상 hold_until이 있다.)
   */
  releaseHeldNotifications(now: Date = new Date()): NotificationOutboxEntry[] {
    const nowMs = now.getTime();
    const released: NotificationOutboxEntry[] = [];
    for (const entry of this.notificationOutbox) {
      if (entry.status !== "held") continue;
      if (entry.holdUntil && Date.parse(entry.holdUntil) > nowMs) continue; // 아직 보류 창 안
      entry.status = "pending";
      entry.holdUntil = undefined;
      released.push(entry);
    }
    return released;
  }

  private outboxEntry(id: string): NotificationOutboxEntry {
    const entry = this.notificationOutbox.find((e) => e.id === id);
    if (!entry) throw new QueRuleError("NOT_FOUND", `알림 없음: ${id}`);
    return entry;
  }

  /** 발송 성공 기록. */
  markNotificationSent(id: string): NotificationOutboxEntry {
    const entry = this.outboxEntry(id);
    entry.status = "sent";
    entry.sentAt = this.now();
    return entry;
  }

  /** 발송 실패 기록(재시도 대상). attempts 증가. */
  markFailed(id: string): NotificationOutboxEntry {
    const entry = this.outboxEntry(id);
    entry.status = "failed";
    entry.attempts += 1;
    return entry;
  }

  /** 발송하지 않기로 함(예: 조건 미충족). */
  markSkipped(id: string): NotificationOutboxEntry {
    const entry = this.outboxEntry(id);
    entry.status = "skipped";
    return entry;
  }

  /**
   * 알림 읽음 처리(C-3a) — 본인 것만, 멱등 upsert(사용자·알림당 1행). 알림은 상태 파생
   * 스냅샷이라 저장하지 않고 읽음만 저장한다. 업무 데이터가 아니라 ChangeLog를 남기지 않는다
   * (revision_notes 선례). 읽음은 표시(뱃지·강조)에만 영향 — 항목 자체는 해결 시 자연 소멸.
   */
  markAlertsRead(ctx: ActorContext, input: { alertIds: string[] }): number {
    const actor = this.requireUser(ctx.actorId);
    const nowIso = this.now();
    let added = 0;
    for (const alertId of new Set(input.alertIds)) {
      if (!alertId || alertId.length > 200) continue; // 형식 방어(파생 id는 짧다)
      const id = `${actor.id}:${alertId}`;
      if (this.alertReads.some((r) => r.id === id)) continue; // 멱등
      this.alertReads.push({ id, userId: actor.id, alertId, readAt: nowIso });
      added += 1;
    }
    return added;
  }

  private logChange(
    ctx: ActorContext,
    entry: Omit<ChangeLog, "id" | "actorId" | "via" | "createdAt">,
  ): void {
    this.changeLogs.push({
      ...entry,
      id: this.nextId("clog"),
      actorId: ctx.actorId,
      via: ctx.via,
      createdAt: this.now(),
    });
  }

  /**
   * 변경 영속화 훅. 인메모리 mock은 아무것도 하지 않는다(no-op) — 상태가 프로세스 메모리에 이미 있다.
   * Supabase 어댑터가 override해 mutation 이후 변경분을 실 DB에 write-through한다.
   * 호출부(서버 액션/API)는 mock/supabase 구분 없이 mutation 뒤 `await db.persist()`를 부른다.
   */
  async persist(): Promise<void> {
    // no-op (mock)
  }

  // protected: Supabase 어댑터가 요청 간 충돌 없는 전역 고유 id로 override한다(인메모리 시퀀스는
  // 요청마다 0부터 재시작해 충돌 가능).
  protected nextId(prefix: string): string {
    this.seq += 1;
    return `${prefix}-gen-${this.seq}`;
  }

  protected now(): string {
    return this.clock().toISOString();
  }
}

export function createMockDb(now: Date = new Date()): MockQueDb {
  return new MockQueDb(now);
}
