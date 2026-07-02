import { describe, expect, it } from "vitest";
import { createMockDb } from "./data/mock-db";
import { QueRuleError } from "./rules";

// 도메인 규칙이 core 계층에서 실제로 강제되는지 검증한다.
// 이 규칙들은 CLAUDE.md "도메인 규칙"과 기획서의 운영 규칙에서 온다.

const NOW = new Date("2026-07-02T09:00:00+09:00");

function db() {
  return createMockDb(NOW);
}

describe("작업 상태 변경", () => {
  it("문제발생 전환은 사유 없이 거부된다", () => {
    const d = db();
    expect(() =>
      d.changeTaskStatus(
        { actorId: "hwang-sunghyeon", via: "web" },
        { taskId: "task-landing-copy", to: "issue" },
      ),
    ).toThrowError(QueRuleError);
    expect(d.requireTask("task-landing-copy").status).toBe("in_progress");
  });

  it("사유가 있으면 전환되고 StatusLog와 ChangeLog(via)가 남는다", () => {
    const d = db();
    d.changeTaskStatus(
      { actorId: "hwang-sunghyeon", via: "mcp" },
      {
        taskId: "task-landing-copy",
        to: "on_hold",
        detail: { reason: "디자인 확정 대기", helpUserId: "kim-riwon" },
      },
    );
    expect(d.requireTask("task-landing-copy").status).toBe("on_hold");

    const slog = d.statusLogs.at(-1)!;
    expect(slog.toStatus).toBe("on_hold");
    expect(slog.reason).toBe("디자인 확정 대기");

    const clog = d.changeLogs.at(-1)!;
    expect(clog.via).toBe("mcp");
    expect(clog.changeType).toBe("status_change");
  });

  it("타인 작업은 팀원이 수정할 수 없다", () => {
    const d = db();
    // task-landing-copy는 황성현(admin) 소유. 팀원 송수용이 수정 시도.
    expect(() =>
      d.changeTaskStatus(
        { actorId: "song-suyong", via: "web" },
        { taskId: "task-landing-copy", to: "done" },
      ),
    ).toThrowError(/수정할 수 없다/);
  });

  it("프로젝트 담당자는 프로젝트 작업을 수정할 수 있다", () => {
    const d = db();
    // task-payment-qa(담당 박승환)는 prj-payment 소속, 담당자는 오승훈.
    const task = d.changeTaskStatus(
      { actorId: "oh-seunghoon", via: "web" },
      { taskId: "task-payment-qa", to: "in_progress" },
    );
    expect(task.status).toBe("in_progress");
  });
});

describe("캘린더 일정 이동", () => {
  it("외부 회사 일정은 이동할 수 없다", () => {
    const d = db();
    expect(() =>
      d.moveCalendarEvent(
        { actorId: "hwang-sunghyeon", via: "web" },
        { eventId: "evt-ad-meeting", startAt: NOW.toISOString(), endAt: NOW.toISOString() },
      ),
    ).toThrowError(/이동할 수 없다/);
  });

  it("비공개 일정은 이동할 수 없다", () => {
    const d = db();
    expect(() =>
      d.moveCalendarEvent(
        { actorId: "park-seunghwan", via: "web" },
        { eventId: "evt-park-away", startAt: NOW.toISOString(), endAt: NOW.toISOString() },
      ),
    ).toThrowError(QueRuleError);
  });

  it("Que 일정은 소유자가 이동할 수 있고 ChangeLog가 남는다", () => {
    const d = db();
    const moved = d.moveCalendarEvent(
      { actorId: "lee-yejin", via: "cli" },
      {
        eventId: "evt-cs-review",
        startAt: "2026-07-05T05:00:00.000Z",
        endAt: "2026-07-05T06:00:00.000Z",
      },
    );
    expect(moved.startAt).toBe("2026-07-05T05:00:00.000Z");
    expect(d.changeLogs.at(-1)!.via).toBe("cli");
  });
});

describe("Action → Task 확정", () => {
  it("담당자 없는 Action은 거부되고 확인 필요로 남는다", () => {
    const d = db();
    expect(() =>
      d.confirmActionItem({ actorId: "hwang-sunghyeon", via: "web" }, "act-refund-copy"),
    ).toThrowError(/확인 필요/);
    expect(d.actionItems.find((a) => a.id === "act-refund-copy")!.status).toBe("needs_review");
  });

  it("마감일 없는 Action도 거부된다", () => {
    const d = db();
    expect(() =>
      d.confirmActionItem({ actorId: "hwang-sunghyeon", via: "web" }, "act-banner-copy"),
    ).toThrowError(QueRuleError);
  });

  it("담당자와 마감일이 있으면 Task가 생성되고 원문 출처가 연결된다", () => {
    const d = db();
    const task = d.confirmActionItem({ actorId: "hwang-sunghyeon", via: "web" }, "act-error-doc");
    expect(task.source).toBe("action_item");
    expect(task.assigneeId).toBe("park-seunghwan");
    expect(task.description).toContain("결제 플로우 QA.md");
    expect(task.description).toContain("오류 재현 시나리오");

    const item = d.actionItems.find((a) => a.id === "act-error-doc")!;
    expect(item.status).toBe("created");
    expect(item.createdTaskId).toBe(task.id);
  });
});

describe("게이트 반려 회귀 (글래도스 공격 케이스)", () => {
  it("공백 사유로는 문제발생 전환이 거부된다", () => {
    const d = db();
    expect(() =>
      d.changeTaskStatus(
        { actorId: "hwang-sunghyeon", via: "web" },
        { taskId: "task-landing-copy", to: "issue", detail: { reason: "   " } },
      ),
    ).toThrowError(QueRuleError);
    expect(d.requireTask("task-landing-copy").status).toBe("in_progress");
  });

  it("이미 생성된 Action의 재확정은 거부된다 (중복 Task 방지)", () => {
    const d = db();
    const first = d.confirmActionItem({ actorId: "hwang-sunghyeon", via: "web" }, "act-error-doc");
    const taskCount = d.tasks.length;

    expect(() =>
      d.confirmActionItem({ actorId: "hwang-sunghyeon", via: "web" }, "act-error-doc"),
    ).toThrowError(/이미 처리된/);
    expect(d.tasks.length).toBe(taskCount);
    expect(d.actionItems.find((a) => a.id === "act-error-doc")!.createdTaskId).toBe(first.id);
  });

  it("무시된 Action의 확정은 거부되지만 보류된 Action은 확정할 수 있다", () => {
    const d = db();
    d.setActionItemStatus(
      { actorId: "park-seunghwan", via: "web" },
      { actionItemId: "act-error-doc", to: "ignored" },
    );
    expect(() =>
      d.confirmActionItem({ actorId: "hwang-sunghyeon", via: "web" }, "act-error-doc"),
    ).toThrowError(/이미 처리된/);

    const d2 = db();
    d2.setActionItemStatus(
      { actorId: "park-seunghwan", via: "web" },
      { actionItemId: "act-error-doc", to: "held" },
    );
    const task = d2.confirmActionItem({ actorId: "hwang-sunghyeon", via: "web" }, "act-error-doc");
    expect(task.source).toBe("action_item");
  });

  it("잘못된 날짜 문자열로는 일정을 이동할 수 없다", () => {
    const d = db();
    const before = d.requireTask("task-landing-copy").startAt;
    expect(() =>
      d.moveTask(
        { actorId: "hwang-sunghyeon", via: "mcp" },
        { taskId: "task-landing-copy", startAt: "banana", endAt: "kiwi" },
      ),
    ).toThrowError(/유효하지 않은 일정 범위/);
    expect(d.requireTask("task-landing-copy").startAt).toBe(before);
  });

  it("종료가 시작보다 빠른 이동은 거부된다", () => {
    const d = db();
    expect(() =>
      d.moveTask(
        { actorId: "hwang-sunghyeon", via: "web" },
        {
          taskId: "task-landing-copy",
          startAt: "2026-07-05T10:00:00.000Z",
          endAt: "2026-07-05T09:00:00.000Z",
        },
      ),
    ).toThrowError(QueRuleError);
  });

  it("무관한 팀원은 타인 담당 Action을 무시 처리할 수 없다", () => {
    const d = db();
    // act-error-doc: 담당 박승환, 업로더 오승훈. 무관한 송수용이 시도.
    expect(() =>
      d.setActionItemStatus(
        { actorId: "song-suyong", via: "web" },
        { actionItemId: "act-error-doc", to: "ignored" },
      ),
    ).toThrowError(/담당자, 회의록 업로더, 관리자만/);

    // 회의록 업로더(오승훈)는 가능
    const item = d.setActionItemStatus(
      { actorId: "oh-seunghoon", via: "web" },
      { actionItemId: "act-error-doc", to: "held" },
    );
    expect(item.status).toBe("held");
  });

  it("확정 거부로 확인 필요로 내려간 변경도 ChangeLog에 남는다", () => {
    const d = db();
    // candidate 상태인 act-error-doc의 마감일이 빠진 상황을 재현
    const item = d.actionItems.find((a) => a.id === "act-error-doc")!;
    item.dueAt = undefined;

    expect(() =>
      d.confirmActionItem({ actorId: "hwang-sunghyeon", via: "web" }, "act-error-doc"),
    ).toThrowError(/확인 필요/);
    expect(item.status).toBe("needs_review");

    const clog = d.changeLogs.at(-1)!;
    expect(clog.entityId).toBe("act-error-doc");
    expect(clog.beforeValue).toBe("candidate");
    expect(clog.afterValue).toBe("needs_review");
    expect(clog.reason).toContain("누락");
  });
});

describe("결제 상태 변경", () => {
  it("관리자는 완료 처리할 수 있다", () => {
    const d = db();
    const paid = d.updatePaymentStatus(
      { actorId: "hwang-sunghyeon", via: "web" },
      { paymentId: "pay-stock-photo", to: "done" },
    );
    expect(paid.status).toBe("done");
  });

  it("요청자는 본인 요청을 취소할 수 있지만 완료 처리는 못 한다", () => {
    const d = db();
    const cancelled = d.updatePaymentStatus(
      { actorId: "kim-riwon", via: "web" },
      { paymentId: "pay-stock-photo", to: "cancelled" },
    );
    expect(cancelled.status).toBe("cancelled");

    expect(() =>
      d.updatePaymentStatus(
        { actorId: "song-suyong", via: "web" },
        { paymentId: "pay-courier", to: "done" },
      ),
    ).toThrowError(/관리자/);
  });
});

describe("체크인 응답", () => {
  it("담당자가 아니면 응답할 수 없다", () => {
    const d = db();
    // chk-detail-qa의 담당자는 황성현
    expect(() =>
      d.answerCheckIn(
        { actorId: "song-suyong", via: "web" },
        { checkInId: "chk-detail-qa", response: "working" },
      ),
    ).toThrowError(/담당자만/);
  });

  it("작업중 응답은 작업 상태를 진행중으로 바꾸고 로그를 남긴다", () => {
    const d = db();
    const checkIn = d.answerCheckIn(
      { actorId: "hwang-sunghyeon", via: "web" },
      { checkInId: "chk-detail-qa", response: "working" },
    );
    expect(checkIn.answeredAt).toBeDefined();
    expect(d.requireTask("task-detail-qa").status).toBe("in_progress");
    expect(d.statusLogs.at(-1)!.toStatus).toBe("in_progress");
  });

  it("문제발생 응답은 사유 없이 거부되고 체크인은 미응답으로 남는다", () => {
    const d = db();
    expect(() =>
      d.answerCheckIn(
        { actorId: "hwang-sunghyeon", via: "web" },
        { checkInId: "chk-detail-qa", response: "issue" },
      ),
    ).toThrowError(QueRuleError);
    const checkIn = d.checkIns.find((c) => c.id === "chk-detail-qa")!;
    expect(checkIn.answeredAt).toBeUndefined();
    expect(d.requireTask("task-detail-qa").status).toBe("scheduled");
  });

  it("나중에 답변은 상태를 바꾸지 않고 후속 확인만 남긴다", () => {
    const d = db();
    const checkIn = d.answerCheckIn(
      { actorId: "hwang-sunghyeon", via: "web" },
      { checkInId: "chk-detail-qa", response: "later" },
    );
    expect(checkIn.followUpRequired).toBe(true);
    expect(d.requireTask("task-detail-qa").status).toBe("scheduled");

    // later 이후 실제 응답은 가능하다
    d.answerCheckIn(
      { actorId: "hwang-sunghyeon", via: "web" },
      { checkInId: "chk-detail-qa", response: "done" },
    );
    expect(d.requireTask("task-detail-qa").status).toBe("done");
  });

  it("이미 응답한 체크인은 다시 응답할 수 없다", () => {
    const d = db();
    d.answerCheckIn(
      { actorId: "hwang-sunghyeon", via: "web" },
      { checkInId: "chk-detail-qa", response: "done" },
    );
    expect(() =>
      d.answerCheckIn(
        { actorId: "hwang-sunghyeon", via: "web" },
        { checkInId: "chk-detail-qa", response: "working" },
      ),
    ).toThrowError(/이미 응답한/);
  });
});

describe("시드 데이터 정합성", () => {
  it("시드가 스키마를 통과한다", async () => {
    const d = db();
    const {
      taskSchema,
      calendarEventSchema,
      actionItemSchema,
      paymentRequestSchema,
      meetingNoteSchema,
      milestoneSchema,
      projectSchema,
    } = await import("./domain");

    for (const t of d.tasks) taskSchema.parse(t);
    for (const e of d.calendarEvents) calendarEventSchema.parse(e);
    for (const a of d.actionItems) actionItemSchema.parse(a);
    for (const p of d.paymentRequests) paymentRequestSchema.parse(p);
    for (const n of d.meetingNotes) meetingNoteSchema.parse(n);
    for (const m of d.milestones) milestoneSchema.parse(m);
    for (const pr of d.projects) projectSchema.parse(pr);
  });

  it("생성된 Action Task의 참조가 유효하다", () => {
    const d = db();
    for (const item of d.actionItems.filter((a) => a.status === "created")) {
      expect(d.tasks.some((t) => t.id === item.createdTaskId)).toBe(true);
    }
  });
});
