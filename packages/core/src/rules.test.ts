import { describe, expect, it } from "vitest";
import { createMockDb } from "./data/mock-db";
import {
  QueRuleError,
  canMoveCalendarEvent,
  canViewMeetingNote,
  canViewPrivateEventDetail,
  latestStatusLog,
} from "./rules";
import { USERS } from "./mock/users";
import { MockGoogleCalendarProvider, type ExternalCalendarEvent, type StatusLog } from "./index";

// 도메인 규칙이 core 계층에서 실제로 강제되는지 검증한다.
// 이 규칙들은 CLAUDE.md "도메인 규칙"과 기획서의 운영 규칙에서 온다.

const NOW = new Date("2026-07-02T09:00:00+09:00");

function db() {
  return createMockDb(NOW);
}

describe("latestStatusLog — 최신 로그는 배열 순서가 아니라 createdAt으로 판정", () => {
  function log(id: string, createdAt: string): StatusLog {
    return {
      id,
      taskId: "task-1",
      actorId: "hwang-sunghyeon",
      fromStatus: "in_progress",
      toStatus: "issue",
      reason: id,
      createdAt,
    };
  }

  it("배열이 뒤섞여 있어도 createdAt 최대값을 고른다", () => {
    // Supabase의 select("*")처럼 순서가 시간순이 아닌 배열
    const logs: StatusLog[] = [
      log("mid", "2026-07-02T11:00:00+09:00"),
      log("newest", "2026-07-02T13:00:00+09:00"),
      log("oldest", "2026-07-02T09:00:00+09:00"),
    ];
    expect(latestStatusLog(logs, "task-1", "issue")?.id).toBe("newest");
  });

  it("taskId·toStatus가 일치하는 로그만 후보로 삼는다", () => {
    const logs: StatusLog[] = [
      { ...log("other-task", "2026-07-02T14:00:00+09:00"), taskId: "task-2" },
      { ...log("other-status", "2026-07-02T15:00:00+09:00"), toStatus: "on_hold" },
      log("match", "2026-07-02T10:00:00+09:00"),
    ];
    expect(latestStatusLog(logs, "task-1", "issue")?.id).toBe("match");
  });

  it("일치하는 로그가 없으면 undefined", () => {
    expect(latestStatusLog([log("a", "2026-07-02T10:00:00+09:00")], "task-1", "on_hold")).toBeUndefined();
  });
});

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

describe("결제 요청 등록", () => {
  it("필수값과 금액을 검증하고 대기 상태로 생성한다", () => {
    const d = db();
    const payment = d.createPaymentRequest(
      { actorId: "kim-riwon", via: "web" },
      {
        title: "CS 교육 자료 구매",
        bankName: "국민은행",
        accountNumber: "123-45-678901",
        amount: 33000,
        category: "교육",
      },
    );
    expect(payment.status).toBe("waiting");
    expect(payment.requesterId).toBe("kim-riwon");
    expect(d.changeLogs.at(-1)!.entityType).toBe("payment_request");

    expect(() =>
      d.createPaymentRequest(
        { actorId: "kim-riwon", via: "web" },
        { title: " ", bankName: "국민", accountNumber: "1", amount: 1000, category: "기타" },
      ),
    ).toThrowError(/필수다/);

    expect(() =>
      d.createPaymentRequest(
        { actorId: "kim-riwon", via: "web" },
        { title: "t", bankName: "b", accountNumber: "1", amount: -5, category: "기타" },
      ),
    ).toThrowError(/0보다 크고/);
  });
});

describe("자연어 작업 해석 (parseTaskInput)", () => {
  it("기획서 예시: '내일 오후 3시에 황성현씨 상세페이지 QA 넣어줘'", async () => {
    const { parseTaskInput } = await import("./parse-task");
    const { USERS } = await import("./mock/users");
    const draft = parseTaskInput({
      text: "내일 오후 3시에 황성현씨 상세페이지 QA 넣어줘",
      users: USERS,
      now: NOW,
    });
    expect(draft.title).toBe("상세페이지 QA");
    expect(draft.assigneeId).toBe("hwang-sunghyeon");
    const start = new Date(draft.startAt!);
    expect(start.getDate()).toBe(3); // 7/2 기준 내일
    expect(start.getHours()).toBe(15);
    expect(draft.questions).toHaveLength(0);
  });

  it("명사 끝의 '등록'을 명령어로 오인해 자르지 않는다 ('작업등록')", async () => {
    const { parseTaskInput } = await import("./parse-task");
    const { USERS } = await import("./mock/users");
    // 공백 없이 붙은 '작업등록'은 통째로 제목이어야 한다(과거엔 '작업'으로 잘림).
    const draft = parseTaskInput({ text: "오늘 오후 1시에 작업등록", users: USERS, now: NOW });
    expect(draft.title).toBe("작업등록");
    expect(new Date(draft.startAt!).getHours()).toBe(13);
    // 반면 공백/조사 경계가 있으면 명령어 '등록'으로 보고 제거한다.
    const spaced = parseTaskInput({ text: "상세페이지 QA 등록", users: USERS, now: NOW });
    expect(spaced.title).toBe("상세페이지 QA");
    // 명령형 어미가 있으면 그것만 1회 제거 — '등록'이 이중으로 잘리지 않는다.
    const phrase = parseTaskInput({ text: "회원 등록 넣어줘", users: USERS, now: NOW });
    expect(phrase.title).toBe("회원 등록");
  });

  it("날짜/담당자가 없으면 질문을 남기고 저장하지 않는다", async () => {
    const { parseTaskInput } = await import("./parse-task");
    const { USERS } = await import("./mock/users");
    const draft = parseTaskInput({ text: "배너 시안 검토", users: USERS, now: NOW });
    expect(draft.title).toBe("배너 시안 검토");
    expect(draft.startAt).toBeUndefined();
    expect(draft.questions.some((q) => q.includes("날짜"))).toBe(true);
    expect(draft.questions.some((q) => q.includes("본인 작업"))).toBe(true);
  });
});

describe("작업 생성 (createTask)", () => {
  it("확인된 초안으로 생성되고 ChangeLog가 남는다", () => {
    const d = db();
    const task = d.createTask(
      { actorId: "lee-yejin", via: "web" },
      {
        title: "상세페이지 QA",
        assigneeId: "hwang-sunghyeon",
        startAt: "2026-07-03T06:00:00.000Z",
        endAt: "2026-07-03T07:00:00.000Z",
        source: "natural_language",
      },
    );
    expect(task.status).toBe("scheduled");
    expect(task.ownerId).toBe("lee-yejin");
    expect(task.assigneeId).toBe("hwang-sunghyeon");
    const clog = d.changeLogs.at(-1)!;
    expect(clog.changeType).toBe("create");
    expect(clog.afterValue).toContain("황성현");
  });

  it("빈 제목, 유령 담당자, 역순 일정은 거부된다", () => {
    const d = db();
    expect(() =>
      d.createTask({ actorId: "lee-yejin", via: "web" }, { title: "  ", source: "manual" }),
    ).toThrowError(/작업명은 필수/);
    expect(() =>
      d.createTask(
        { actorId: "lee-yejin", via: "web" },
        { title: "t", assigneeId: "ghost", source: "manual" },
      ),
    ).toThrowError(/사용자 없음/);
    expect(() =>
      d.createTask(
        { actorId: "lee-yejin", via: "web" },
        {
          title: "t",
          startAt: "2026-07-03T10:00:00.000Z",
          endAt: "2026-07-03T09:00:00.000Z",
          source: "manual",
        },
      ),
    ).toThrowError(QueRuleError);
  });
});

describe("입력 길이 상한 (DoS 표면 축소)", () => {
  it("초대형 결제 제목과 1조 초과 금액은 거부된다", () => {
    const d = db();
    expect(() =>
      d.createPaymentRequest(
        { actorId: "kim-riwon", via: "cli" },
        {
          title: "가".repeat(201),
          bankName: "국민",
          accountNumber: "1-2-3",
          amount: 1000,
          category: "기타",
        },
      ),
    ).toThrowError(/길이 상한/);

    expect(() =>
      d.createPaymentRequest(
        { actorId: "kim-riwon", via: "cli" },
        { title: "t", bankName: "b", accountNumber: "1", amount: 2_000_000_000_000, category: "c" },
      ),
    ).toThrowError(/1조 이하/);
  });

  it("250자 bullet은 title 200자로 절단되고 원문은 보존되며, 확정된 Task도 상한을 지킨다", () => {
    const d = db();
    const longLine = `아주 긴 할 일 ${"가".repeat(250)}`;
    const note = d.createMeetingNote(
      { actorId: "oh-seunghoon", via: "web" },
      {
        title: "긴 항목 회의",
        meetingAt: NOW.toISOString(),
        attendeeIds: [],
        fileName: "long.md",
        markdownBody: `- ${longLine}`,
      },
    );
    const [item] = d.extractActionItems({ actorId: "oh-seunghoon", via: "web" }, note.id);
    expect(item.title.length).toBe(200); // DB check 제약(200자)과 동일한 절단
    expect(item.sourceText).toBe(longLine); // 원문은 그대로 보존

    d.updateActionItem(
      { actorId: "hwang-sunghyeon", via: "web" },
      { actionItemId: item.id, assigneeId: "oh-seunghoon", dueAt: "2026-07-10T09:00:00.000Z" },
    );
    const task = d.confirmActionItem({ actorId: "hwang-sunghyeon", via: "web" }, item.id);
    expect(task.title.length).toBeLessThanOrEqual(200);
    expect((task.description ?? "").length).toBeLessThanOrEqual(2000);
  });

  it("초대형 회의록 본문과 500자 초과 사유는 거부된다", () => {
    const d = db();
    expect(() =>
      d.createMeetingNote(
        { actorId: "oh-seunghoon", via: "web" },
        {
          title: "t",
          meetingAt: NOW.toISOString(),
          attendeeIds: [],
          fileName: "f.md",
          markdownBody: "a".repeat(500_001),
        },
      ),
    ).toThrowError(/500,000자 이내/);

    expect(() =>
      d.changeTaskStatus(
        { actorId: "hwang-sunghyeon", via: "web" },
        { taskId: "task-landing-copy", to: "issue", detail: { reason: "가".repeat(501) } },
      ),
    ).toThrowError(QueRuleError);
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

describe("회의록 업로드와 Action 추출", () => {
  const MD = [
    "# 주간 회의",
    "",
    "## 할 일",
    "- 상세페이지 QA 시나리오 정리 (담당: 황성현)",
    "- 배너 문구 검토",
    "일반 문단은 후보가 아니다",
  ].join("\n");

  it("업로드하면 원문이 보존되고 추출 대기 상태다", () => {
    const d = db();
    const note = d.createMeetingNote(
      { actorId: "oh-seunghoon", via: "web" },
      {
        title: "주간 회의",
        meetingAt: NOW.toISOString(),
        attendeeIds: ["oh-seunghoon", "hwang-sunghyeon"],
        fileName: "주간회의.md",
        markdownBody: MD,
      },
    );
    expect(note.extractionStatus).toBe("pending");
    expect(note.markdownBody).toBe(MD);
    expect(d.changeLogs.at(-1)!.entityType).toBe("meeting_note");
  });

  it("추출은 bullet만 후보로 만들고 Task는 자동 생성하지 않는다", () => {
    const d = db();
    const note = d.createMeetingNote(
      { actorId: "oh-seunghoon", via: "web" },
      {
        title: "주간 회의",
        meetingAt: NOW.toISOString(),
        attendeeIds: [],
        fileName: "주간회의.md",
        markdownBody: MD,
      },
    );
    const taskCountBefore = d.tasks.length;
    const items = d.extractActionItems({ actorId: "oh-seunghoon", via: "web" }, note.id);

    expect(items).toHaveLength(2);
    expect(items[0].assigneeId).toBe("hwang-sunghyeon"); // (담당: 황성현) 매칭
    expect(items[0].title).toBe("상세페이지 QA 시나리오 정리");
    expect(items[0].sourceText).toContain("담당: 황성현"); // 원문 보존
    expect(items[1].assigneeId).toBeUndefined();
    expect(items.every((i) => i.status === "needs_review")).toBe(true);
    expect(d.tasks.length).toBe(taskCountBefore); // 자동 생성 없음
    expect(d.meetingNotes.find((n) => n.id === note.id)!.extractionStatus).toBe("done");
  });

  it("이미 추출된 회의록의 재추출은 거부된다", () => {
    const d = db();
    expect(() =>
      d.extractActionItems({ actorId: "oh-seunghoon", via: "web" }, "note-payment-qa"),
    ).toThrowError(/이미 추출이 완료된/);
  });

  it("열람 권한 없는 지정 인원 회의록은 추출도 거부된다 (글래도스 반려 회귀)", () => {
    const d = db();
    const note = d.createMeetingNote(
      { actorId: "hwang-sunghyeon", via: "web" },
      {
        title: "연봉협상",
        meetingAt: NOW.toISOString(),
        attendeeIds: [],
        fileName: "연봉협상.md",
        markdownBody: "# 연봉협상\n\n- 인상안 검토 (담당: 박승환)",
        visibility: "restricted",
        restrictedUserIds: ["park-seunghwan"],
      },
    );
    // 지정 인원(박승환)은 추출 가능
    expect(() => d.extractActionItems({ actorId: "park-seunghwan", via: "web" }, note.id)).not.toThrow();
  });

  it("지정 인원이 아닌 외부인은 추출을 시도해도 원문이 새지 않는다 (글래도스 반려 회귀)", () => {
    const d = db();
    const note = d.createMeetingNote(
      { actorId: "hwang-sunghyeon", via: "web" },
      {
        title: "연봉협상2",
        meetingAt: NOW.toISOString(),
        attendeeIds: [],
        fileName: "연봉협상2.md",
        markdownBody: "# 연봉협상2\n\n- 인상안 검토 (담당: 박승환)",
        visibility: "restricted",
        restrictedUserIds: ["park-seunghwan"],
      },
    );
    expect(() =>
      d.extractActionItems({ actorId: "song-suyong", via: "web" }, note.id),
    ).toThrowError(/열람 권한이 없는/);
    expect(d.actionItems.some((a) => a.meetingNoteId === note.id)).toBe(false);
  });

  it("지정 인원 공개 범위는 대상자를 최소 1명 지정해야 한다", () => {
    const d = db();
    expect(() =>
      d.createMeetingNote(
        { actorId: "hwang-sunghyeon", via: "web" },
        {
          title: "연봉협상",
          meetingAt: NOW.toISOString(),
          attendeeIds: [],
          fileName: "연봉협상.md",
          markdownBody: MD,
          visibility: "restricted",
        },
      ),
    ).toThrowError(/1명 이상 지정/);
  });

  it("지정 인원 공개 범위로 업로드하면 restrictedUserIds가 저장된다", () => {
    const d = db();
    const note = d.createMeetingNote(
      { actorId: "hwang-sunghyeon", via: "web" },
      {
        title: "연봉협상",
        meetingAt: NOW.toISOString(),
        attendeeIds: [],
        fileName: "연봉협상.md",
        markdownBody: MD,
        visibility: "restricted",
        restrictedUserIds: ["park-seunghwan"],
      },
    );
    expect(note.visibility).toBe("restricted");
    expect(note.restrictedUserIds).toEqual(["park-seunghwan"]);
  });
});

describe("비공개 일정 열람 권한 (canViewPrivateEventDetail)", () => {
  const [admin, member1, member2] = USERS;
  const privateEvent = {
    id: "evt-1",
    source: "que" as const,
    title: "병원",
    ownerId: member1.id,
    startAt: NOW.toISOString(),
    endAt: NOW.toISOString(),
    attendeeIds: [],
    visibility: "private" as const,
  };

  it("본인은 자신의 비공개 일정 상세를 본다", () => {
    expect(canViewPrivateEventDetail(privateEvent, member1)).toBe(true);
  });

  it("관리자는 타인의 비공개 일정도 상세를 본다 (2026-07-03 확정)", () => {
    expect(canViewPrivateEventDetail(privateEvent, admin)).toBe(true);
  });

  it("일반 팀원은 타인의 비공개 일정 상세를 볼 수 없다", () => {
    expect(canViewPrivateEventDetail(privateEvent, member2)).toBe(false);
  });
});

describe("회의록 열람 권한 (canViewMeetingNote)", () => {
  const [admin, uploader, outsider, allowed] = USERS;

  it("팀 전체 공개 회의록은 누구나 본다", () => {
    const note = { visibility: "team" as const, uploaderId: uploader.id };
    expect(canViewMeetingNote(outsider, note)).toBe(true);
  });

  it("관리자 전용 회의록은 관리자/업로더만 본다", () => {
    const note = { visibility: "admin" as const, uploaderId: uploader.id };
    expect(canViewMeetingNote(admin, note)).toBe(true);
    expect(canViewMeetingNote(uploader, note)).toBe(true);
    expect(canViewMeetingNote(outsider, note)).toBe(false);
  });

  it("지정 인원 회의록은 목록에 있는 사람과 관리자/업로더만 본다", () => {
    const note = {
      visibility: "restricted" as const,
      uploaderId: uploader.id,
      restrictedUserIds: [allowed.id],
    };
    expect(canViewMeetingNote(admin, note)).toBe(true);
    expect(canViewMeetingNote(uploader, note)).toBe(true);
    expect(canViewMeetingNote(allowed, note)).toBe(true);
    expect(canViewMeetingNote(outsider, note)).toBe(false);
  });
});

describe("Action 후보 필드 지정", () => {
  it("담당자와 마감일이 채워지면 확인 필요 → 생성 대기로 승격된다", () => {
    const d = db();
    // act-refund-copy: needs_review, 담당자 없음, dueAt 있음
    const updated = d.updateActionItem(
      { actorId: "hwang-sunghyeon", via: "web" },
      { actionItemId: "act-refund-copy", assigneeId: "kim-riwon" },
    );
    expect(updated.assigneeId).toBe("kim-riwon");
    expect(updated.status).toBe("candidate");

    // 승격 후에는 확정 가능
    const task = d.confirmActionItem({ actorId: "hwang-sunghyeon", via: "web" }, "act-refund-copy");
    expect(task.assigneeId).toBe("kim-riwon");
  });

  it("무관한 팀원은 후보 필드를 지정할 수 없고, 유령 사용자 지정은 거부된다", () => {
    const d = db();
    expect(() =>
      d.updateActionItem(
        { actorId: "song-suyong", via: "web" },
        { actionItemId: "act-refund-copy", assigneeId: "song-suyong" },
      ),
    ).toThrowError(/담당자, 회의록 업로더, 관리자만/);

    expect(() =>
      d.updateActionItem(
        { actorId: "hwang-sunghyeon", via: "web" },
        { actionItemId: "act-refund-copy", assigneeId: "ghost" },
      ),
    ).toThrowError(/사용자 없음/);
  });

  it("잘못된 마감일은 거부된다", () => {
    const d = db();
    expect(() =>
      d.updateActionItem(
        { actorId: "hwang-sunghyeon", via: "web" },
        { actionItemId: "act-refund-copy", dueAt: "mango" },
      ),
    ).toThrowError(/유효하지 않은 일정 범위/);
  });
});

describe("마일스톤 이동", () => {
  it("무관한 팀원은 마일스톤을 이동할 수 없다", () => {
    const d = db();
    // ms-payment-qa는 prj-payment(담당 오승훈) 소속
    expect(() =>
      d.moveMilestone(
        { actorId: "song-suyong", via: "web" },
        { milestoneId: "ms-payment-qa", dueAt: "2026-07-10T09:00:00.000Z" },
      ),
    ).toThrowError(/프로젝트 담당자 또는 관리자만/);
  });

  it("프로젝트 담당자는 이동할 수 있고 ChangeLog가 남는다", () => {
    const d = db();
    const moved = d.moveMilestone(
      { actorId: "oh-seunghoon", via: "web" },
      { milestoneId: "ms-payment-qa", dueAt: "2026-07-10T09:00:00.000Z" },
    );
    expect(moved.dueAt).toBe("2026-07-10T09:00:00.000Z");
    const clog = d.changeLogs.at(-1)!;
    expect(clog.entityType).toBe("milestone");
    expect(clog.changeType).toBe("move");
  });

  it("잘못된 날짜로는 이동할 수 없다", () => {
    const d = db();
    expect(() =>
      d.moveMilestone(
        { actorId: "hwang-sunghyeon", via: "cli" },
        { milestoneId: "ms-payment-qa", dueAt: "durian" },
      ),
    ).toThrowError(/유효하지 않은 일정 범위/);
  });
});

describe("마일스톤 생성·수정", () => {
  it("무관한 팀원은 마일스톤을 만들 수 없다", () => {
    const d = db();
    expect(() =>
      d.createMilestone(
        { actorId: "song-suyong", via: "web" },
        { projectId: "prj-payment", title: "테스트", dueAt: "2026-07-10T09:00:00.000Z" },
      ),
    ).toThrowError(/프로젝트 담당자 또는 관리자만/);
  });

  it("관리자는 만들 수 있고 기본 위험은 on_track, ChangeLog가 남는다", () => {
    const d = db();
    const m = d.createMilestone(
      { actorId: "hwang-sunghyeon", via: "web" },
      { projectId: "prj-payment", title: "새 마일스톤", dueAt: "2026-07-12T09:00:00.000Z" },
    );
    expect(m.riskStatus).toBe("on_track");
    const clog = d.changeLogs.at(-1)!;
    expect(clog.entityType).toBe("milestone");
    expect(clog.changeType).toBe("create");
  });

  it("[우회 공격] riskStatus에 enum 밖 문자열을 주입하면 생성이 거부된다", () => {
    const d = db();
    expect(() =>
      d.createMilestone(
        { actorId: "hwang-sunghyeon", via: "web" },
        {
          projectId: "prj-payment",
          title: "공격",
          dueAt: "2026-07-12T09:00:00.000Z",
          riskStatus: "GLaDOS_was_here" as never,
        },
      ),
    ).toThrowError(/잘못된 위험 상태/);
  });

  it("[우회 공격] riskStatus에 enum 밖 문자열을 주입하면 수정이 거부된다", () => {
    const d = db();
    expect(() =>
      d.updateMilestone(
        { actorId: "oh-seunghoon", via: "web" },
        { milestoneId: "ms-payment-qa", riskStatus: "on_fire" as never },
      ),
    ).toThrowError(/잘못된 위험 상태/);
  });

  it("프로젝트 담당자는 위험 상태를 바꿀 수 있고 ChangeLog가 남는다", () => {
    const d = db();
    const updated = d.updateMilestone(
      { actorId: "oh-seunghoon", via: "web" },
      { milestoneId: "ms-payment-qa", riskStatus: "late" },
    );
    expect(updated.riskStatus).toBe("late");
    const clog = d.changeLogs.at(-1)!;
    expect(clog.entityType).toBe("milestone");
    expect(clog.changeType).toBe("update");
  });
});

describe("자연어 요일 파싱", () => {
  it("'금요일'은 다가오는 금요일, '다음주 화요일'은 다음 주로 해석된다", async () => {
    const { parseTaskInput } = await import("./parse-task");
    const { USERS } = await import("./mock/users");
    // NOW = 2026-07-02 (목)
    const friday = parseTaskInput({ text: "금요일 오후 2시 보고서 검토", users: USERS, now: NOW });
    expect(friday.title).toBe("보고서 검토");
    const fridayStart = new Date(friday.startAt!);
    expect([fridayStart.getMonth() + 1, fridayStart.getDate()]).toEqual([7, 3]);
    expect(fridayStart.getHours()).toBe(14);

    const nextTue = parseTaskInput({ text: "다음주 화요일 회의 준비", users: USERS, now: NOW });
    const tueStart = new Date(nextTue.startAt!);
    expect([tueStart.getMonth() + 1, tueStart.getDate()]).toEqual([7, 7]);

    // 오늘이 목요일 — "목요일"은 오늘
    const today = parseTaskInput({ text: "목요일 정리", users: USERS, now: NOW });
    expect(new Date(today.startAt!).getDate()).toBe(2);
  });
});

describe("작업 병합 (merged)", () => {
  it("대상 없이/자기 자신과는 병합할 수 없고, 정상 병합은 대상이 기록된다", () => {
    const d = db();
    expect(() =>
      d.changeTaskStatus(
        { actorId: "hwang-sunghyeon", via: "web" },
        { taskId: "task-detail-qa", to: "merged" },
      ),
    ).toThrowError(/대상 작업/);
    expect(() =>
      d.changeTaskStatus(
        { actorId: "hwang-sunghyeon", via: "web" },
        { taskId: "task-detail-qa", to: "merged", mergedIntoTaskId: "task-detail-qa" },
      ),
    ).toThrowError(/자기 자신/);
    expect(() =>
      d.changeTaskStatus(
        { actorId: "hwang-sunghyeon", via: "web" },
        { taskId: "task-detail-qa", to: "merged", mergedIntoTaskId: "ghost" },
      ),
    ).toThrowError(/작업 없음/);

    const merged = d.changeTaskStatus(
      { actorId: "hwang-sunghyeon", via: "web" },
      { taskId: "task-detail-qa", to: "merged", mergedIntoTaskId: "task-final-review" },
    );
    expect(merged.status).toBe("merged");
    expect(merged.mergedIntoTaskId).toBe("task-final-review");
    expect(d.statusLogs.at(-1)!.toStatus).toBe("merged");
  });
});

describe("작업 댓글 / 도움 요청", () => {
  it("팀원은 타인의 작업에도 댓글을 남길 수 있고, 도움 요청은 ChangeLog에 남는다", () => {
    const d = db();
    // task-landing-copy는 황성현 작업 — 송수용(무관 팀원)이 댓글 (수정은 불가하지만 댓글은 가능)
    const plain = d.addTaskComment(
      { actorId: "song-suyong", via: "web" },
      { taskId: "task-landing-copy", body: "문구 시안 B가 더 좋아 보여요" },
    );
    expect(plain.authorId).toBe("song-suyong");
    const logCountAfterPlain = d.changeLogs.length;

    const help = d.addTaskComment(
      { actorId: "park-seunghwan", via: "web" },
      { taskId: "task-payment-qa", body: "스테이징 API 키 확인 부탁드립니다", helpUserId: "oh-seunghoon" },
    );
    expect(help.helpUserId).toBe("oh-seunghoon");
    // 일반 댓글은 조용히, 도움 요청만 ChangeLog
    expect(d.changeLogs.length).toBe(logCountAfterPlain + 1);
    expect(d.changeLogs.at(-1)!.afterValue).toContain("오승훈");
  });

  it("빈 본문, 1000자 초과, 유령 도움 대상은 거부된다", () => {
    const d = db();
    expect(() =>
      d.addTaskComment({ actorId: "song-suyong", via: "web" }, { taskId: "task-landing-copy", body: "  " }),
    ).toThrowError(/댓글 내용은 필수/);
    expect(() =>
      d.addTaskComment(
        { actorId: "song-suyong", via: "web" },
        { taskId: "task-landing-copy", body: "가".repeat(1001) },
      ),
    ).toThrowError(/1000자 이내/);
    expect(() =>
      d.addTaskComment(
        { actorId: "song-suyong", via: "web" },
        { taskId: "task-landing-copy", body: "b", helpUserId: "ghost" },
      ),
    ).toThrowError(/사용자 없음/);
  });
});

describe("체크인 스케줄러 (syncCheckIns)", () => {
  it("시작 시간이 지난 예정 작업에만 생성하고, 멱등하다", () => {
    const d = db();
    // NOW=09:00 기준: 시작 지난 scheduled 작업은 아직 없음 (13:00 상세페이지 QA는 시드 체크인 보유)
    const at14 = new Date("2026-07-02T14:00:00+09:00");
    const created = d.syncCheckIns(at14);

    // 11:30 광고 소재 검수(scheduled, 체크인 없음)가 생성 대상
    expect(created.some((c) => c.taskId === "task-ad-review")).toBe(true);
    // 13:00 상세페이지 QA는 시드 체크인이 있어 중복 생성 안 됨
    expect(created.some((c) => c.taskId === "task-detail-qa")).toBe(false);
    // 09:30 랜딩페이지(in_progress — 이미 상태 업데이트됨), 10:00 결제 QA(issue)는 묻지 않음
    expect(created.some((c) => c.taskId === "task-landing-copy")).toBe(false);
    expect(created.some((c) => c.taskId === "task-payment-qa")).toBe(false);
    // 15:30 주간 리포트는 아직 시작 전
    expect(created.some((c) => c.taskId === "task-weekly-report")).toBe(false);

    // 멱등성: 다시 호출해도 추가 생성 없음
    expect(d.syncCheckIns(at14)).toHaveLength(0);
  });

  it("과거 날짜 작업에는 뒤늦게 묻지 않고, 생성된 체크인은 응답 가능하다", () => {
    const d = db();
    const nextDay = new Date("2026-07-03T18:00:00+09:00");
    const created = d.syncCheckIns(nextDay);
    // 7/3 기준: 어제(7/2) 작업들은 dayStart 이전이라 제외, 7/3 작업(CS FAQ 초안 등)만 생성
    expect(created.some((c) => c.taskId === "task-ad-review")).toBe(false);
    const faq = created.find((c) => c.taskId === "task-faq-draft");
    expect(faq).toBeDefined();

    const answered = d.answerCheckIn(
      { actorId: "lee-yejin", via: "web" },
      { checkInId: faq!.id, response: "working" },
    );
    expect(answered.response).toBe("working");
    expect(d.requireTask("task-faq-draft").status).toBe("in_progress");
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
      recurringTemplateSchema,
    } = await import("./domain");

    for (const t of d.tasks) taskSchema.parse(t);
    for (const e of d.calendarEvents) calendarEventSchema.parse(e);
    for (const a of d.actionItems) actionItemSchema.parse(a);
    for (const p of d.paymentRequests) paymentRequestSchema.parse(p);
    for (const n of d.meetingNotes) meetingNoteSchema.parse(n);
    for (const m of d.milestones) milestoneSchema.parse(m);
    for (const pr of d.projects) projectSchema.parse(pr);
    for (const rt of d.recurringTemplates) recurringTemplateSchema.parse(rt);
  });

  it("생성된 Action Task의 참조가 유효하다", () => {
    const d = db();
    for (const item of d.actionItems.filter((a) => a.status === "created")) {
      expect(d.tasks.some((t) => t.id === item.createdTaskId)).toBe(true);
    }
  });
});

describe("반복 업무 템플릿", () => {
  it("weekly 템플릿은 요일 없이 만들 수 없다", () => {
    const d = db();
    expect(() =>
      d.createRecurringTemplate(
        { actorId: "hwang-sunghyeon", via: "web" },
        { title: "매주 회의", assigneeId: "hwang-sunghyeon", frequency: "weekly", startTime: "10:00" },
      ),
    ).toThrowError(/요일을 지정/);
  });

  it("monthly 템플릿은 날짜 없이 만들 수 없다", () => {
    const d = db();
    expect(() =>
      d.createRecurringTemplate(
        { actorId: "hwang-sunghyeon", via: "web" },
        { title: "월간 정산", assigneeId: "hwang-sunghyeon", frequency: "monthly", startTime: "10:00" },
      ),
    ).toThrowError(/날짜를 지정/);
  });

  it("정상 생성하면 changeLog가 기록된다", () => {
    const d = db();
    const tmpl = d.createRecurringTemplate(
      { actorId: "hwang-sunghyeon", via: "web" },
      {
        title: "테스트 반복",
        assigneeId: "oh-seunghoon",
        frequency: "weekly",
        dayOfWeek: 1,
        startTime: "09:00",
      },
    );
    expect(tmpl.active).toBe(true);
    expect(d.changeLogs.at(-1)!.entityType).toBe("recurring_template");
  });

  it("만든 사람/관리자가 아니면 켜고 끌 수 없다", () => {
    const d = db();
    const tmpl = d.createRecurringTemplate(
      { actorId: "oh-seunghoon", via: "web" },
      { title: "테스트", assigneeId: "oh-seunghoon", frequency: "weekly", dayOfWeek: 2, startTime: "09:00" },
    );
    expect(() =>
      d.setRecurringTemplateActive({ actorId: "song-suyong", via: "web" }, tmpl.id, false),
    ).toThrowError(/만든 사람과 관리자만/);
    const updated = d.setRecurringTemplateActive(
      { actorId: "hwang-sunghyeon", via: "web" },
      tmpl.id,
      false,
    );
    expect(updated.active).toBe(false);
  });

  it("오늘이 해당 요일이면 3일 이내 회차로 Task를 만든다 (멱등)", () => {
    const d = db();
    const todayDow = NOW.getDay();
    const tmpl = d.createRecurringTemplate(
      { actorId: "hwang-sunghyeon", via: "web" },
      {
        title: "오늘 반복",
        assigneeId: "oh-seunghoon",
        frequency: "weekly",
        dayOfWeek: todayDow,
        startTime: "15:00",
      },
    );
    const before = d.tasks.length;
    const created1 = d.syncRecurringTemplates(NOW);
    expect(created1).toHaveLength(1);
    expect(created1[0].source).toBe("recurring_template");
    expect(created1[0].recurringTemplateId).toBe(tmpl.id);
    expect(d.tasks.length).toBe(before + 1);

    const created2 = d.syncRecurringTemplates(NOW); // 같은 시각에 재실행
    expect(created2).toHaveLength(0); // 중복 생성 없음
    expect(d.tasks.length).toBe(before + 1);
  });

  it("비활성 템플릿은 생성하지 않는다", () => {
    const d = db();
    const todayDow = NOW.getDay();
    const tmpl = d.createRecurringTemplate(
      { actorId: "hwang-sunghyeon", via: "web" },
      {
        title: "꺼진 반복",
        assigneeId: "hwang-sunghyeon",
        frequency: "weekly",
        dayOfWeek: todayDow,
        startTime: "15:00",
      },
    );
    d.setRecurringTemplateActive({ actorId: "hwang-sunghyeon", via: "web" }, tmpl.id, true);
    d.setRecurringTemplateActive({ actorId: "hwang-sunghyeon", via: "web" }, tmpl.id, false);
    const created = d.syncRecurringTemplates(NOW);
    expect(created.some((t) => t.recurringTemplateId === tmpl.id)).toBe(false);
  });

  it("3일보다 먼 회차는 아직 만들지 않는다", () => {
    const d = db();
    const farDow = (NOW.getDay() + 5) % 7; // 모듈러 연산상 항상 5일 뒤
    const tmpl = d.createRecurringTemplate(
      { actorId: "hwang-sunghyeon", via: "web" },
      { title: "먼 반복", assigneeId: "hwang-sunghyeon", frequency: "weekly", dayOfWeek: farDow, startTime: "09:00" },
    );
    const created = d.syncRecurringTemplates(NOW);
    expect(created.some((t) => t.recurringTemplateId === tmpl.id)).toBe(false);
  });

  it("범위를 벗어난 입력은 거부된다 (글래도스 반려 회귀)", () => {
    const d = db();
    const base = {
      title: "잘못된 반복",
      assigneeId: "hwang-sunghyeon",
      startTime: "10:00",
    } as const;
    expect(() =>
      d.createRecurringTemplate(
        { actorId: "hwang-sunghyeon", via: "web" },
        { ...base, frequency: "monthly", dayOfMonth: 31 },
      ),
    ).toThrowError(/1~28/);
    expect(() =>
      d.createRecurringTemplate(
        { actorId: "hwang-sunghyeon", via: "web" },
        { ...base, frequency: "weekly", dayOfWeek: 9 },
      ),
    ).toThrowError(/0\(일\)~6\(토\)/);
    expect(() =>
      d.createRecurringTemplate(
        { actorId: "hwang-sunghyeon", via: "web" },
        { ...base, frequency: "weekly", dayOfWeek: 1, startTime: "99:99" },
      ),
    ).toThrowError(/HH:mm/);
    expect(() =>
      d.createRecurringTemplate(
        { actorId: "hwang-sunghyeon", via: "web" },
        {
          ...base,
          frequency: "weekly",
          dayOfWeek: 1,
          projectId: "prj-does-not-exist",
        },
      ),
    ).toThrowError(/프로젝트 없음/);
  });

  it("월말에서 다음 달로 넘어가는 회차를 정확히 계산한다 (글래도스 반려 회귀)", () => {
    const d = db();
    const tmpl = d.createRecurringTemplate(
      { actorId: "hwang-sunghyeon", via: "web" },
      {
        title: "매월 1일 정산",
        assigneeId: "hwang-sunghyeon",
        frequency: "monthly",
        dayOfMonth: 1,
        startTime: "09:00",
      },
    );
    // 1/30 시점 — 다음 회차는 "2/30"(존재하지 않음)이 아니라 정확히 2/1이어야 하고, 3일 윈도우 안이라 미리 생성돼야 한다.
    const jan30 = new Date(2026, 0, 30, 9, 0);
    const created = d.syncRecurringTemplates(jan30);
    const generated = created.find((t) => t.recurringTemplateId === tmpl.id);
    expect(generated).toBeDefined();
    expect(generated!.startAt!.slice(0, 10)).toBe("2026-02-01");

    // 아무도 2/1 당일에 접속하지 않아도(체크인/템플릿 모두 lazy 실행) 회차가 유실되지 않는다 —
    // 이미 1/30에 생성됐으므로 2/3에 다시 돌려도 중복 생성되지 않는다.
    const feb3 = new Date(2026, 1, 3, 9, 0);
    const createdAgain = d.syncRecurringTemplates(feb3);
    expect(createdAgain.some((t) => t.recurringTemplateId === tmpl.id)).toBe(false);
    expect(d.tasks.filter((t) => t.recurringTemplateId === tmpl.id)).toHaveLength(1);
  });
});

describe("회사 캘린더 동기화 (syncExternalCalendar)", () => {
  const RANGE_START = new Date("2026-06-25T00:00:00+09:00");
  const RANGE_END = new Date("2026-07-31T00:00:00+09:00");
  const ev = (over: Partial<ExternalCalendarEvent> = {}): ExternalCalendarEvent => ({
    externalId: "google:townhall",
    title: "월간 타운홀",
    ownerId: "oh-seunghoon",
    startAt: "2026-07-04T07:00:00.000Z",
    endAt: "2026-07-04T08:00:00.000Z",
    visibility: "team",
    ...over,
  });

  it("신규 외부 일정은 회사 일정으로 추가되고 읽기 전용이다", async () => {
    const d = db();
    const before = d.calendarEvents.length;
    const r = await d.syncExternalCalendar(
      new MockGoogleCalendarProvider([ev()]),
      RANGE_START,
      RANGE_END,
    );
    expect(r).toEqual({ added: 1, updated: 0, skipped: 0 });
    expect(d.calendarEvents.length).toBe(before + 1);
    const added = d.calendarEvents.find((e) => e.externalCalendarId === "google:townhall")!;
    expect(added.source).toBe("company");
    expect(canMoveCalendarEvent(added)).toBe(false); // 회사 일정은 이동 불가
  });

  it("같은 데이터로 다시 동기화하면 아무것도 바뀌지 않는다 (멱등)", async () => {
    const d = db();
    const provider = new MockGoogleCalendarProvider([ev()]);
    await d.syncExternalCalendar(provider, RANGE_START, RANGE_END);
    const after1 = d.calendarEvents.length;
    const r2 = await d.syncExternalCalendar(provider, RANGE_START, RANGE_END);
    expect(r2).toEqual({ added: 0, updated: 0, skipped: 0 });
    expect(d.calendarEvents.length).toBe(after1);
  });

  it("시간이 바뀐 외부 일정은 추가가 아니라 갱신된다", async () => {
    const d = db();
    await d.syncExternalCalendar(new MockGoogleCalendarProvider([ev()]), RANGE_START, RANGE_END);
    const countAfterAdd = d.calendarEvents.length;
    const r = await d.syncExternalCalendar(
      new MockGoogleCalendarProvider([ev({ endAt: "2026-07-04T09:00:00.000Z" })]),
      RANGE_START,
      RANGE_END,
    );
    expect(r).toEqual({ added: 0, updated: 1, skipped: 0 });
    expect(d.calendarEvents.length).toBe(countAfterAdd); // 중복 생성 없음
    const ev2 = d.calendarEvents.find((e) => e.externalCalendarId === "google:townhall")!;
    expect(ev2.endAt).toBe("2026-07-04T09:00:00.000Z");
    expect(ev2.lastChangedAt).toBeDefined(); // 수정됨 배지용
  });

  it("존재하지 않는 소유자·시간 역전 일정은 건너뛴다", async () => {
    const d = db();
    const before = d.calendarEvents.length;
    const r = await d.syncExternalCalendar(
      new MockGoogleCalendarProvider([
        ev({ externalId: "google:ghost", ownerId: "not-a-real-user" }),
        ev({ externalId: "google:reversed", startAt: "2026-07-04T09:00:00.000Z", endAt: "2026-07-04T08:00:00.000Z" }),
      ]),
      RANGE_START,
      RANGE_END,
    );
    expect(r).toEqual({ added: 0, updated: 0, skipped: 2 });
    expect(d.calendarEvents.length).toBe(before);
  });

  it("기간 밖 일정은 제공자가 반환하지 않는다", async () => {
    const d = db();
    const r = await d.syncExternalCalendar(
      new MockGoogleCalendarProvider([ev({ startAt: "2025-01-01T00:00:00.000Z", endAt: "2025-01-01T01:00:00.000Z" })]),
      RANGE_START,
      RANGE_END,
    );
    expect(r).toEqual({ added: 0, updated: 0, skipped: 0 });
  });
});

describe("회사 캘린더 동기화 — 참석자/공개범위 변경 감지 (글래도스 비차단 관찰 반영)", () => {
  const RS = new Date("2026-06-25T00:00:00+09:00");
  const RE = new Date("2026-07-31T00:00:00+09:00");
  const base: ExternalCalendarEvent = {
    externalId: "google:townhall",
    title: "월간 타운홀",
    ownerId: "oh-seunghoon",
    startAt: "2026-07-04T07:00:00.000Z",
    endAt: "2026-07-04T08:00:00.000Z",
    attendeeIds: ["oh-seunghoon", "hwang-sunghyeon"],
    visibility: "team",
  };

  it("시간·제목이 그대로여도 참석자만 바뀌면 갱신으로 감지된다", async () => {
    const d = db();
    await d.syncExternalCalendar(new MockGoogleCalendarProvider([base]), RS, RE);
    const r = await d.syncExternalCalendar(
      new MockGoogleCalendarProvider([{ ...base, attendeeIds: ["oh-seunghoon"] }]),
      RS,
      RE,
    );
    expect(r).toEqual({ added: 0, updated: 1, skipped: 0 });
    const ev = d.calendarEvents.find((e) => e.externalCalendarId === "google:townhall")!;
    expect(ev.attendeeIds).toEqual(["oh-seunghoon"]);
  });
});

describe("클라이언트(거래처) — 관리자만 생성·수정", () => {
  it("비관리자는 클라이언트를 만들 수 없다", () => {
    const d = db();
    expect(() =>
      d.createClient({ actorId: "kim-riwon", via: "web" }, { name: "새 거래처" }),
    ).toThrowError(/관리자만/);
    // 실패한 시도는 아무것도 추가하지 않는다
    expect(d.clients.some((c) => c.name === "새 거래처")).toBe(false);
  });

  it("관리자는 클라이언트를 만들고 ChangeLog(entityType=client, via)가 남는다", () => {
    const d = db();
    const client = d.createClient({ actorId: "hwang-sunghyeon", via: "mcp" }, { name: "새 거래처" });
    expect(client.status).toBe("active");
    expect(d.clients.some((c) => c.id === client.id)).toBe(true);
    const clog = d.changeLogs.at(-1)!;
    expect(clog.entityType).toBe("client");
    expect(clog.changeType).toBe("create");
    expect(clog.via).toBe("mcp");
  });

  it("이름이 비었거나 200자를 넘으면 거부된다", () => {
    const d = db();
    expect(() =>
      d.createClient({ actorId: "hwang-sunghyeon", via: "web" }, { name: "   " }),
    ).toThrowError(QueRuleError);
    expect(() =>
      d.createClient({ actorId: "hwang-sunghyeon", via: "web" }, { name: "가".repeat(201) }),
    ).toThrowError(/200자/);
  });

  it("잘못된 status는 거부된다 (신뢰 못 할 클라이언트 인자 런타임 검증)", () => {
    const d = db();
    expect(() =>
      d.createClient(
        { actorId: "hwang-sunghyeon", via: "web" },
        { name: "정상 이름", status: "garbage" as never },
      ),
    ).toThrowError(QueRuleError);
  });

  it("비관리자는 클라이언트를 수정할 수 없다", () => {
    const d = db();
    expect(() =>
      d.updateClient({ actorId: "kim-riwon", via: "web" }, { clientId: "client-mendix", status: "archived" }),
    ).toThrowError(/관리자만/);
    expect(d.clientById("client-mendix")!.status).toBe("active");
  });

  it("관리자는 클라이언트를 보관 처리할 수 있다", () => {
    const d = db();
    const updated = d.updateClient(
      { actorId: "hwang-sunghyeon", via: "web" },
      { clientId: "client-mendix", status: "archived" },
    );
    expect(updated.status).toBe("archived");
    expect(d.changeLogs.at(-1)!.entityType).toBe("client");
  });

  it("새 클라이언트는 표시 순서 맨 끝(max+1)으로 붙는다", () => {
    const d = db();
    const maxBefore = Math.max(...d.clients.map((c) => c.sortOrder));
    const created = d.createClient({ actorId: "hwang-sunghyeon", via: "web" }, { name: "새 거래처" });
    expect(created.sortOrder).toBe(maxBefore + 1);
  });
});

describe("클라이언트 표시 순서 변경 (reorderClients)", () => {
  it("orderedIds 순서대로 sortOrder를 0..n-1로 재설정하고 ChangeLog(via)를 남긴다", () => {
    const d = db();
    const reversed = [...d.clients].sort((a, b) => a.sortOrder - b.sortOrder).map((c) => c.id).reverse();
    const result = d.reorderClients({ actorId: "hwang-sunghyeon", via: "mcp" }, { orderedIds: reversed });
    // 반환값과 저장값 모두 인덱스대로 sortOrder가 매겨진다
    reversed.forEach((id, i) => {
      expect(d.clientById(id)!.sortOrder).toBe(i);
      expect(result[i].id).toBe(id);
    });
    const clog = d.changeLogs.at(-1)!;
    expect(clog.entityType).toBe("client");
    expect(clog.changeType).toBe("update");
    expect(clog.via).toBe("mcp");
  });

  it("비관리자는 순서를 바꿀 수 없다(아무것도 반영되지 않음)", () => {
    const d = db();
    const before = d.clients.map((c) => ({ id: c.id, sortOrder: c.sortOrder }));
    expect(() =>
      d.reorderClients({ actorId: "kim-riwon", via: "web" }, { orderedIds: ["client-epic", "client-mendix"] }),
    ).toThrowError(/관리자만/);
    for (const b of before) expect(d.clientById(b.id)!.sortOrder).toBe(b.sortOrder);
  });

  it("존재하지 않는 id나 중복이 있으면 거부하고 순서를 바꾸지 않는다", () => {
    const d = db();
    const before = d.clients.map((c) => ({ id: c.id, sortOrder: c.sortOrder }));
    expect(() =>
      d.reorderClients({ actorId: "hwang-sunghyeon", via: "web" }, { orderedIds: ["client-mendix", "client-none"] }),
    ).toThrowError(/클라이언트 없음/);
    expect(() =>
      d.reorderClients({ actorId: "hwang-sunghyeon", via: "web" }, { orderedIds: ["client-mendix", "client-mendix"] }),
    ).toThrowError(/중복/);
    // 두 실패 모두 원본 순서를 보존한다
    for (const b of before) expect(d.clientById(b.id)!.sortOrder).toBe(b.sortOrder);
  });
});

describe("프로젝트 — 생성은 관리자, 수정은 관리자 또는 담당자", () => {
  it("clientOf는 프로젝트의 상위 클라이언트를 되돌린다", () => {
    const d = db();
    const summer = d.projects.find((p) => p.id === "prj-summer")!;
    expect(d.clientOf(summer)?.id).toBe("client-mendix");
  });

  it("비관리자는 프로젝트를 만들 수 없다", () => {
    const d = db();
    expect(() =>
      d.createProject({ actorId: "kim-riwon", via: "web" }, { name: "신규 프로젝트" }),
    ).toThrowError(/관리자만/);
  });

  it("관리자는 클라이언트에 묶인 프로젝트를 만들고 ChangeLog(entityType=project)가 남는다", () => {
    const d = db();
    const project = d.createProject(
      { actorId: "hwang-sunghyeon", via: "cli" },
      { name: "겨울 캠페인", clientId: "client-epic", ownerId: "kim-riwon" },
    );
    expect(project.clientId).toBe("client-epic");
    expect(project.ownerId).toBe("kim-riwon");
    expect(project.milestoneIds).toEqual([]);
    const clog = d.changeLogs.at(-1)!;
    expect(clog.entityType).toBe("project");
    expect(clog.via).toBe("cli");
  });

  it("존재하지 않는 클라이언트로는 프로젝트를 만들 수 없다", () => {
    const d = db();
    expect(() =>
      d.createProject({ actorId: "hwang-sunghyeon", via: "web" }, { name: "x", clientId: "client-none" }),
    ).toThrowError(/클라이언트 없음/);
  });

  it("clientId 없는 내부 잡무 프로젝트도 허용된다", () => {
    const d = db();
    const project = d.createProject({ actorId: "hwang-sunghyeon", via: "web" }, { name: "내부 잡무" });
    expect(project.clientId).toBeUndefined();
    expect(d.clientOf(project)).toBeUndefined();
  });

  it("프로젝트 담당자(비관리자)는 자기 프로젝트를 수정할 수 있다", () => {
    const d = db();
    // prj-cs의 owner는 이예진(member)
    const updated = d.updateProject(
      { actorId: "lee-yejin", via: "web" },
      { projectId: "prj-cs", name: "CS 운영 v2" },
    );
    expect(updated.name).toBe("CS 운영 v2");
    expect(d.changeLogs.at(-1)!.entityType).toBe("project");
  });

  it("담당자가 아닌 비관리자는 남의 프로젝트를 수정할 수 없다", () => {
    const d = db();
    expect(() =>
      d.updateProject({ actorId: "kim-riwon", via: "web" }, { projectId: "prj-cs", name: "무단 변경" }),
    ).toThrowError(/담당자만/);
  });

  it("clientId=null로 클라이언트 연결을 해제하면 내부 잡무가 된다", () => {
    const d = db();
    const updated = d.updateProject(
      { actorId: "hwang-sunghyeon", via: "web" },
      { projectId: "prj-summer", clientId: null },
    );
    expect(updated.clientId).toBeUndefined();
    expect(d.clientOf(updated)).toBeUndefined();
  });

  it("존재하지 않는 클라이언트로는 재배정할 수 없다", () => {
    const d = db();
    expect(() =>
      d.updateProject(
        { actorId: "hwang-sunghyeon", via: "web" },
        { projectId: "prj-summer", clientId: "client-none" },
      ),
    ).toThrowError(/클라이언트 없음/);
  });
});

describe("클라이언트 필터 조회 (tasksForClient)", () => {
  it("clientId 미지정이면 전체 작업을 그대로 돌려준다", () => {
    const d = db();
    expect(d.tasksForClient(undefined).length).toBe(d.tasks.length);
  });

  it("특정 클라이언트는 그 소속 프로젝트 작업만 반환(무소속 제외)", () => {
    const d = db();
    const client = d.clients[0];
    const clientProjectIds = new Set(
      d.projects.filter((p) => p.clientId === client.id).map((p) => p.id),
    );
    const filtered = d.tasksForClient(client.id);
    // 반환 작업은 전부 그 클라이언트 소속 프로젝트에 속한다
    expect(filtered.every((t) => t.projectId !== undefined && clientProjectIds.has(t.projectId))).toBe(true);
    // 프로젝트 없는 작업(무소속)은 특정 클라이언트 필터에서 빠진다
    expect(filtered.some((t) => t.projectId === undefined)).toBe(false);
    // 전체보다 작거나 같다(필터가 실제로 줄인다)
    expect(filtered.length).toBeLessThanOrEqual(d.tasks.length);
  });

  it("아무 프로젝트도 없는 클라이언트는 빈 배열", () => {
    const d = db();
    const empty = d.createClient({ actorId: "hwang-sunghyeon", via: "web" }, { name: "빈 거래처" });
    expect(d.tasksForClient(empty.id)).toHaveLength(0);
  });
});
