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
  StatusDetail,
  StatusLog,
  Task,
  TaskStatus,
  User,
} from "../domain";
import { USERS } from "../mock/users";
import {
  QueRuleError,
  assertCanConfirmActionItem,
  assertCanEditTask,
  assertCanMoveCalendarEvent,
  assertCanResolveActionItem,
  assertStatusDetail,
  parseScheduleRange,
} from "../rules";
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

  /** 작업 상태 변경. 문제발생/홀드는 사유 필수, StatusLog + ChangeLog 기록. */
  changeTaskStatus(
    ctx: ActorContext,
    input: { taskId: string; to: TaskStatus; detail?: StatusDetail },
  ): Task {
    const actor = this.requireUser(ctx.actorId);
    const task = this.requireTask(input.taskId);
    assertCanEditTask(actor, task, this.projectOf(task));
    assertStatusDetail(input.to, input.detail);

    const from = task.status;
    const nowIso = this.now();
    task.status = input.to;
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
      title: item.title,
      ownerId: actor.id,
      assigneeId: item.assigneeId!,
      projectId: item.projectId,
      startAt: undefined,
      endAt: item.dueAt,
      status: "scheduled",
      priority: "normal",
      description: `회의록 출처: ${this.meetingNoteName(item.meetingNoteId)} — "${item.sourceText}"`,
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
    },
  ): MeetingNote {
    const actor = this.requireUser(ctx.actorId);
    if (!input.title.trim() || !input.fileName.trim()) {
      throw new QueRuleError("INVALID_SCHEDULE", "회의명과 파일명은 필수다");
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
      const title = bullet.replace(/\s*\(담당:[^)]*\)\s*/, "").replace(/[.。]\s*$/, "").trim();
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

  /** 자동 체크인 응답. 담당자(또는 관리자)만 응답할 수 있고,
   *  응답에 따라 작업 상태를 함께 갱신한다. `later`는 상태를 바꾸지 않고 후속 확인만 남긴다. */
  answerCheckIn(
    ctx: ActorContext,
    input: { checkInId: string; response: CheckInResponse; detail?: StatusDetail },
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
      this.changeTaskStatus(ctx, { taskId: checkIn.taskId, to, detail: input.detail });
    }

    checkIn.answeredAt = this.now();
    checkIn.response = input.response;
    checkIn.followUpRequired = input.response === "later" || input.response === "issue";
    return checkIn;
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

  private nextId(prefix: string): string {
    this.seq += 1;
    return `${prefix}-gen-${this.seq}`;
  }

  private now(): string {
    return this.clock().toISOString();
  }
}

export function createMockDb(now: Date = new Date()): MockQueDb {
  return new MockQueDb(now);
}
