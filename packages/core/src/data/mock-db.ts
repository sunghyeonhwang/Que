import type {
  ActionItem,
  CalendarEvent,
  ChangeLog,
  ChangeVia,
  CheckIn,
  CheckInResponse,
  MeetingNote,
  Milestone,
  PaymentRequest,
  PaymentStatus,
  Project,
  RecurrenceFrequency,
  RecurringTemplate,
  StatusDetail,
  StatusLog,
  Task,
  TaskComment,
  TaskStatus,
  User,
} from "../domain";
import { milestoneSchema } from "../domain";
import { USERS } from "../mock/users";
import {
  QueRuleError,
  assertCanConfirmActionItem,
  assertCanEditTask,
  assertCanManageRecurringTemplate,
  assertCanMoveCalendarEvent,
  assertCanResolveActionItem,
  assertStatusDetail,
  canViewMeetingNote,
  parseScheduleRange,
} from "../rules";
import type { CalendarProvider } from "../calendar-provider";
import { createSeed } from "./seed";

// 인메모리 mock DB. 모든 변경(mutation)은 도메인 규칙을 통과해야 하고
// ChangeLog에 via(web|mcp|cli)와 함께 기록된다.
// Phase B(API 계층)에서 같은 인터페이스의 API 어댑터로 교체한다.

export interface QueDb {
  users: User[];
  projects: Project[];
  milestones: Milestone[];
  tasks: Task[];
  calendarEvents: CalendarEvent[];
  meetingNotes: MeetingNote[];
  actionItems: ActionItem[];
  paymentRequests: PaymentRequest[];
  statusLogs: StatusLog[];
  changeLogs: ChangeLog[];
  checkIns: CheckIn[];
  taskComments: TaskComment[];
  recurringTemplates: RecurringTemplate[];
}

interface ActorContext {
  actorId: string;
  via: ChangeVia;
}

export class MockQueDb implements QueDb {
  users: User[];
  projects: Project[];
  milestones: Milestone[];
  tasks: Task[];
  calendarEvents: CalendarEvent[];
  meetingNotes: MeetingNote[];
  actionItems: ActionItem[];
  paymentRequests: PaymentRequest[];
  statusLogs: StatusLog[];
  changeLogs: ChangeLog[];
  checkIns: CheckIn[];
  taskComments: TaskComment[];
  recurringTemplates: RecurringTemplate[];

  private seq = 0;
  private readonly clock: () => Date;

  constructor(now: Date = new Date(), clock?: () => Date) {
    this.clock = clock ?? (() => new Date());
    const seed = createSeed(now);
    this.users = [...USERS];
    this.projects = seed.projects;
    this.milestones = seed.milestones;
    this.tasks = seed.tasks;
    this.calendarEvents = seed.calendarEvents;
    this.meetingNotes = seed.meetingNotes;
    this.actionItems = seed.actionItems;
    this.paymentRequests = seed.paymentRequests;
    this.statusLogs = seed.statusLogs;
    this.changeLogs = seed.changeLogs;
    this.checkIns = seed.checkIns;
    this.taskComments = seed.taskComments;
    this.recurringTemplates = seed.recurringTemplates;
  }

  // ---------- 조회 ----------

  requireUser(id: string): User {
    const user = this.users.find((u) => u.id === id);
    if (!user) throw new QueRuleError("NOT_FOUND", `사용자 없음: ${id}`);
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
    task.lastChangedBy = actor.id;
    task.lastChangedAt = nowIso;

    this.statusLogs.push({
      id: this.nextId("slog"),
      taskId: task.id,
      actorId: actor.id,
      fromStatus: from,
      toStatus: input.to,
      reason: input.detail?.reason,
      nextAction: input.detail?.nextAction,
      helpUserId: input.detail?.helpUserId,
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

  /** Action 후보를 Task로 확정. 담당자·마감일 없으면 거부하고 확인 필요로 남긴다.
   *  이미 처리된(created/ignored) Action의 재확정은 거부한다 — 중복 Task 방지. */
  confirmActionItem(ctx: ActorContext, actionItemId: string): Task {
    const actor = this.requireUser(ctx.actorId);
    const item = this.requireActionItem(actionItemId);
    assertCanResolveActionItem(actor, item, this.meetingNoteOf(item));
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
    const task: Task = {
      id: this.nextId("task"),
      // title/description은 DB check 제약(200/2000자)과 동일한 상한으로 절단
      title: item.title.slice(0, 200),
      ownerId: actor.id,
      assigneeId: item.assigneeId!,
      projectId: item.projectId,
      startAt: undefined,
      endAt: item.dueAt,
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
    const assignee = input.assigneeId ? this.requireUser(input.assigneeId) : actor;
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
      priority: "normal",
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

  /** 회의록 업로드. 원문 MD를 보존하고 추출 대기 상태로 저장한다. */
  createMeetingNote(
    ctx: ActorContext,
    input: {
      title: string;
      projectId?: string;
      meetingAt: string;
      attendeeIds: string[];
      fileName: string;
      markdownBody: string;
      visibility?: MeetingNote["visibility"];
      restrictedUserIds?: string[];
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

    const nowIso = this.now();
    const note: MeetingNote = {
      id: this.nextId("note"),
      title: input.title.trim(),
      projectId: input.projectId,
      meetingAt: range.startAt,
      attendeeIds: input.attendeeIds,
      uploaderId: actor.id,
      fileName: input.fileName.trim(),
      markdownBody: input.markdownBody,
      visibility: input.visibility ?? "team",
      restrictedUserIds: input.visibility === "restricted" ? input.restrictedUserIds : undefined,
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
    input: { taskId: string; body: string; helpUserId?: string },
  ): TaskComment {
    const actor = this.requireUser(ctx.actorId);
    const task = this.requireTask(input.taskId);
    const body = input.body.trim();
    if (!body) throw new QueRuleError("INVALID_INPUT", "댓글 내용은 필수다");
    if (body.length > 1000) throw new QueRuleError("INVALID_INPUT", "댓글은 1000자 이내다");
    if (input.helpUserId) this.requireUser(input.helpUserId);

    const comment: TaskComment = {
      id: this.nextId("cmt"),
      taskId: task.id,
      authorId: actor.id,
      body,
      helpUserId: input.helpUserId,
      createdAt: this.now(),
    };
    this.taskComments.push(comment);

    // 도움 요청은 업무에 영향을 주는 변경 — ChangeLog로 팀에 보인다. 일반 댓글은 조용히 기록.
    if (input.helpUserId) {
      this.logChange(ctx, {
        entityType: "task",
        entityId: task.id,
        changeType: "update",
        afterValue: `도움 요청 → ${this.requireUser(input.helpUserId).name}`,
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
      afterValue: milestone.title,
    });
    return milestone;
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
    return checkIn;
  }

  /** 결제 요청 등록. 요청자는 본인(actor), 기본 상태 대기. */
  createPaymentRequest(
    ctx: ActorContext,
    input: {
      title: string;
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
      input.bankName.length > 50 ||
      input.accountNumber.length > 50 ||
      input.category.length > 50 ||
      (input.description?.length ?? 0) > 2000
    ) {
      throw new QueRuleError("INVALID_INPUT", "입력 길이 상한 초과 (제목 200, 은행/계좌/분류 50, 내용 2000자)");
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
