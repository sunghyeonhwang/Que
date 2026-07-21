import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { createMockDb } from "./data/mock-db";
import {
  QueRuleError,
  canMoveCalendarEvent,
  canViewMeetingNote,
  canViewPrivateEventDetail,
  isQueRuleError,
  latestStatusLog,
} from "./rules";
import { USERS } from "./mock/users";
import {
  MockGoogleCalendarProvider,
  calendarEventSchema,
  changeViaSchema,
  extractMeetingDateTime,
  type ExternalCalendarEvent,
  type StatusLog,
} from "./index";

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
    // 레거시 단일 helpUserId 입력도 다중 배열로 정규화되고, 레거시 컬럼(첫 번째)도 유지된다.
    expect(slog.helpUserId).toBe("kim-riwon");
    expect(slog.helpUserIds).toEqual(["kim-riwon"]);

    const clog = d.changeLogs.at(-1)!;
    expect(clog.via).toBe("mcp");
    expect(clog.changeType).toBe("status_change");
  });

  it("via='mobile'(DayBlocks 앱)도 허용되고 ChangeLog에 그대로 기록된다", () => {
    const d = db();
    d.changeTaskStatus(
      { actorId: "hwang-sunghyeon", via: "mobile" },
      {
        taskId: "task-landing-copy",
        to: "on_hold",
        detail: { reason: "폰에서 보류", helpUserId: "kim-riwon" },
      },
    );
    const clog = d.changeLogs.at(-1)!;
    expect(clog.via).toBe("mobile");
    expect(changeViaSchema.parse("mobile")).toBe("mobile");
  });

  it("도움 필요한 사람을 여러 명 지정하면 StatusLog에 배열로 저장된다(단일 컬럼=첫 번째)", () => {
    const d = db();
    d.changeTaskStatus(
      { actorId: "hwang-sunghyeon", via: "web" },
      {
        taskId: "task-landing-copy",
        to: "issue",
        detail: { reason: "API·디자인 동시 블로킹", helpUserIds: ["kim-riwon", "song-suyong"] },
      },
    );
    const slog = d.statusLogs.at(-1)!;
    expect(slog.helpUserIds).toEqual(["kim-riwon", "song-suyong"]);
    expect(slog.helpUserId).toBe("kim-riwon");
  });

  it("타인 작업은 팀원이 수정할 수 없다", () => {
    const d = db();
    // task-landing-copy는 황성현(admin) 소유. 팀원 이혜진이 수정 시도.
    expect(() =>
      d.changeTaskStatus(
        { actorId: "lee-hyejin", via: "web" },
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

describe("Que 캘린더 일정 생성 (createCalendarEvent)", () => {
  const START = "2026-07-10T01:00:00.000Z";
  const END = "2026-07-10T02:00:00.000Z";

  it("source는 que, ownerId는 actor로 서버가 고정한다 (외부/타인 위조 차단)", () => {
    const d = db();
    const event = d.createCalendarEvent(
      { actorId: "lee-yejin", via: "web" },
      { title: "주간 회의", startAt: START, endAt: END },
    );
    expect(event.source).toBe("que");
    expect(event.ownerId).toBe("lee-yejin");
    expect(event.visibility).toBe("team"); // 기본
    expect(d.calendarEvents.some((e) => e.id === event.id)).toBe(true);
  });

  it("시작이 종료보다 늦으면 거부한다", () => {
    const d = db();
    expect(() =>
      d.createCalendarEvent(
        { actorId: "lee-yejin", via: "web" },
        { title: "역전 일정", startAt: END, endAt: START },
      ),
    ).toThrowError(QueRuleError);
  });

  it("유령 참석자는 통째로 거부한다", () => {
    const d = db();
    expect(() =>
      d.createCalendarEvent(
        { actorId: "lee-yejin", via: "web" },
        { title: "회의", startAt: START, endAt: END, attendeeIds: ["lee-yejin", "ghost-user"] },
      ),
    ).toThrowError(/사용자 없음/);
    // 부분 반영 없음
    expect(d.calendarEvents.some((e) => e.title === "회의")).toBe(false);
  });

  it("비공개(private) 일정을 만들 수 있고 ChangeLog가 via와 함께 남는다", () => {
    const d = db();
    const event = d.createCalendarEvent(
      { actorId: "park-seunghwan", via: "cli" },
      { title: "개인 자리비움", startAt: START, endAt: END, visibility: "private" },
    );
    expect(event.visibility).toBe("private");
    const clog = d.changeLogs.at(-1)!;
    expect(clog.entityType).toBe("calendar_event");
    expect(clog.changeType).toBe("create");
    expect(clog.via).toBe("cli");
    expect(clog.entityId).toBe(event.id);
  });

  it("생성된 일정은 calendarEventSchema를 만족한다 (참석자 중복 제거 포함)", () => {
    const d = db();
    const event = d.createCalendarEvent(
      { actorId: "hwang-sunghyeon", via: "web" },
      {
        title: "  전사 미팅  ",
        startAt: START,
        endAt: END,
        attendeeIds: ["lee-yejin", "lee-yejin", "kim-riwon"],
      },
    );
    expect(event.title).toBe("전사 미팅"); // trim
    expect(event.attendeeIds).toEqual(["lee-yejin", "kim-riwon"]); // 중복 제거
    expect(() => calendarEventSchema.parse(event)).not.toThrow();
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

  it("생성된 Task는 마감(dueAt) 기준 시간 블록을 가져 캘린더 시간 그리드에 노출된다", () => {
    // 회귀: startAt이 undefined면 calendar-data의 `t.startAt && overlaps(...)` 필터에
    // 걸려 어떤 캘린더 뷰에도 그려지지 않았다.
    const d = db();
    const source = d.actionItems.find((a) => a.id === "act-error-doc")!;
    const task = d.confirmActionItem({ actorId: "hwang-sunghyeon", via: "web" }, "act-error-doc");
    expect(task.startAt).toBeTruthy();
    expect(task.endAt).toBe(source.dueAt);
    // 종료(마감)는 시작 이후여야 하고, 같은 날에 놓여 마감일 캘린더에 뜬다.
    expect(Date.parse(task.startAt!)).toBeLessThan(Date.parse(task.endAt!));
    expect(new Date(task.startAt!).toDateString()).toBe(new Date(task.endAt!).toDateString());
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
    // act-error-doc: 담당 박승환, 업로더 오승훈. 무관한 이혜진이 시도.
    expect(() =>
      d.setActionItemStatus(
        { actorId: "lee-hyejin", via: "web" },
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

describe("Action 후보 제목 수정 (updateActionItem title)", () => {
  it("제목을 수정하면 반영되고 ChangeLog reason에 남는다", () => {
    const d = db();
    const updated = d.updateActionItem(
      { actorId: "hwang-sunghyeon", via: "web" },
      { actionItemId: "act-error-doc", title: "  결제 오류 재현 시나리오 재작성  " },
    );
    expect(updated.title).toBe("결제 오류 재현 시나리오 재작성"); // trim 적용
    const clog = d.changeLogs.at(-1)!;
    expect(clog.entityId).toBe("act-error-doc");
    expect(clog.changeType).toBe("update");
    expect(clog.reason).toContain("제목 수정");
  });

  it("빈 제목(공백만)은 거부된다", () => {
    const d = db();
    expect(() =>
      d.updateActionItem(
        { actorId: "hwang-sunghyeon", via: "web" },
        { actionItemId: "act-error-doc", title: "   " },
      ),
    ).toThrowError(/비울 수 없다/);
  });

  it("이미 처리된(created) Action의 제목은 수정할 수 없다", () => {
    const d = db();
    // act-error-doc는 담당·마감이 갖춰진 candidate — 먼저 Task로 확정해 created로 만든다.
    d.confirmActionItem({ actorId: "hwang-sunghyeon", via: "web" }, "act-error-doc");
    expect(() =>
      d.updateActionItem(
        { actorId: "hwang-sunghyeon", via: "web" },
        { actionItemId: "act-error-doc", title: "확정 후 제목 변경 시도" },
      ),
    ).toThrowError(/이미 처리된/);
  });
});

describe("Action 후보 나누기 (splitActionItem)", () => {
  it("N건으로 분할하며 원문·담당·프로젝트를 상속하고 원본은 ignored가 된다", () => {
    const d = db();
    const before = d.tasks.length;
    // act-error-doc: candidate, 담당 park-seunghwan, prj-payment, note-payment-qa.
    const created = d.splitActionItem(
      { actorId: "hwang-sunghyeon", via: "web" },
      {
        actionItemId: "act-error-doc",
        parts: [
          { title: "7/16 뉴스레터 발송", dueAt: "2026-07-16T17:00:00+09:00" },
          { title: "7/20 문자 발송" },
        ],
      },
    );
    expect(created).toHaveLength(2);
    // 상속: 회의록·원문·담당·프로젝트.
    expect(created.every((c) => c.meetingNoteId === "note-payment-qa")).toBe(true);
    expect(created.every((c) => c.sourceText === "오류 재현 시나리오를 문서화한다.")).toBe(true);
    expect(created.every((c) => c.assigneeId === "park-seunghwan")).toBe(true);
    expect(created.every((c) => c.projectId === "prj-payment")).toBe(true);
    // 상태·신뢰도: 담당+마감→candidate 0.9, 담당만→needs_review 0.8.
    expect(created[0].status).toBe("candidate");
    expect(created[0].confidence).toBe(0.9);
    expect(created[0].dueAt).toBe("2026-07-16T17:00:00+09:00");
    expect(created[1].status).toBe("needs_review");
    expect(created[1].confidence).toBe(0.8);
    expect(created[1].dueAt).toBeUndefined();
    // 원본은 ignored + 분할 로그. Task 자동 생성 없음.
    expect(d.actionItems.find((a) => a.id === "act-error-doc")!.status).toBe("ignored");
    const clog = d.changeLogs.at(-1)!;
    expect(clog.entityId).toBe("act-error-doc");
    expect(clog.reason).toMatch(/2건으로 분할/);
    expect(d.tasks.length).toBe(before);
  });

  it("담당자 없는 원본을 나누면 마감이 있어도 needs_review(0.6)로 남는다", () => {
    const d = db();
    // act-refund-copy: needs_review, 담당 없음.
    const created = d.splitActionItem(
      { actorId: "hwang-sunghyeon", via: "web" },
      {
        actionItemId: "act-refund-copy",
        parts: [
          { title: "환불 정책 초안", dueAt: "2026-07-18T17:00:00+09:00" },
          { title: "환불 FAQ 반영" },
        ],
      },
    );
    expect(created[0].assigneeId).toBeUndefined();
    expect(created[0].status).toBe("needs_review");
    expect(created[0].confidence).toBe(0.6); // 마감만
    expect(created[1].confidence).toBe(0.5); // 담당·마감 모두 없음
  });

  it("2건 미만이면 거부된다", () => {
    const d = db();
    expect(() =>
      d.splitActionItem(
        { actorId: "hwang-sunghyeon", via: "web" },
        { actionItemId: "act-error-doc", parts: [{ title: "하나만" }] },
      ),
    ).toThrowError(/2건 이상/);
  });

  it("이미 처리된(created) Action은 나눌 수 없다", () => {
    const d = db();
    d.confirmActionItem({ actorId: "hwang-sunghyeon", via: "web" }, "act-error-doc");
    expect(() =>
      d.splitActionItem(
        { actorId: "hwang-sunghyeon", via: "web" },
        { actionItemId: "act-error-doc", parts: [{ title: "a" }, { title: "b" }] },
      ),
    ).toThrowError(/이미 처리된/);
  });

  it("빈 제목·잘못된 날짜가 있으면 전량 거부(부분 생성 없음)", () => {
    const d = db();
    const countBefore = d.actionItems.length;
    // 빈 제목
    expect(() =>
      d.splitActionItem(
        { actorId: "hwang-sunghyeon", via: "web" },
        { actionItemId: "act-error-doc", parts: [{ title: "정상" }, { title: "   " }] },
      ),
    ).toThrowError(/비울 수 없다/);
    // 잘못된 날짜(월 13)
    expect(() =>
      d.splitActionItem(
        { actorId: "hwang-sunghyeon", via: "web" },
        {
          actionItemId: "act-error-doc",
          parts: [
            { title: "a", dueAt: "2026-13-01T17:00:00+09:00" },
            { title: "b" },
          ],
        },
      ),
    ).toThrowError(QueRuleError);
    // 어느 경우에도 신규 항목이 생기지 않았고 원본도 그대로 candidate.
    expect(d.actionItems.length).toBe(countBefore);
    expect(d.actionItems.find((a) => a.id === "act-error-doc")!.status).toBe("candidate");
  });
});

describe("회의록 제목 수정 (updateMeetingNoteTitle)", () => {
  it("업로더가 제목을 수정하면 반영되고 ChangeLog reason에 남는다", () => {
    const d = db();
    // note-payment-qa 업로더 = oh-seunghoon.
    const updated = d.updateMeetingNoteTitle(
      { actorId: "oh-seunghoon", via: "web" },
      { meetingNoteId: "note-payment-qa", title: "  결제 QA 회의 (수정)  " },
    );
    expect(updated.title).toBe("결제 QA 회의 (수정)"); // trim
    const clog = d.changeLogs.at(-1)!;
    expect(clog.entityType).toBe("meeting_note");
    expect(clog.entityId).toBe("note-payment-qa");
    expect(clog.reason).toContain("제목 수정");
  });

  it("빈 제목(공백만)은 거부된다", () => {
    const d = db();
    expect(() =>
      d.updateMeetingNoteTitle(
        { actorId: "oh-seunghoon", via: "web" },
        { meetingNoteId: "note-payment-qa", title: "   " },
      ),
    ).toThrowError(/회의명은 필수다/);
  });

  it("업로더도 관리자도 아니면 거부된다", () => {
    const d = db();
    // lee-hyejin(사원)은 note-payment-qa의 업로더(oh)도 관리자도 아니다.
    expect(() =>
      d.updateMeetingNoteTitle(
        { actorId: "lee-hyejin", via: "web" },
        { meetingNoteId: "note-payment-qa", title: "무단 변경" },
      ),
    ).toThrowError(/업로더 또는 관리자/);
  });
});

describe("반복 템플릿 제목 수정 (updateRecurringTemplate)", () => {
  it("만든 사람이 제목을 수정하면 반영되고 ChangeLog reason에 남는다", () => {
    const d = db();
    // tmpl-weekly-standup 생성자 = hwang-sunghyeon.
    const updated = d.updateRecurringTemplate(
      { actorId: "hwang-sunghyeon", via: "web" },
      { templateId: "tmpl-weekly-standup", title: "  주간 스탠드업 (개편)  " },
    );
    expect(updated.title).toBe("주간 스탠드업 (개편)"); // trim
    const clog = d.changeLogs.at(-1)!;
    expect(clog.entityType).toBe("recurring_template");
    expect(clog.entityId).toBe("tmpl-weekly-standup");
    expect(clog.reason).toContain("제목 수정");
  });

  it("빈 제목(공백만)은 거부된다", () => {
    const d = db();
    expect(() =>
      d.updateRecurringTemplate(
        { actorId: "hwang-sunghyeon", via: "web" },
        { templateId: "tmpl-weekly-standup", title: "   " },
      ),
    ).toThrowError(/제목은 필수다/);
  });

  it("만든 사람도 관리자도 아니면 거부된다", () => {
    const d = db();
    // lee-hyejin(사원)은 생성자(hwang)도 관리자도 아니다.
    expect(() =>
      d.updateRecurringTemplate(
        { actorId: "lee-hyejin", via: "web" },
        { templateId: "tmpl-weekly-standup", title: "무단 변경" },
      ),
    ).toThrowError(QueRuleError);
  });
});

describe("결제 요청 등록", () => {
  it("필수값과 금액을 검증하고 대기 상태로 생성한다", () => {
    const d = db();
    const payment = d.createPaymentRequest(
      { actorId: "kim-riwon", via: "web" },
      {
        title: "CS 교육 자료 구매",
        recipientName: "교보문고",
        bankName: "국민은행",
        accountNumber: "123-45-678901",
        amount: 33000,
        category: "교육",
      },
    );
    expect(payment.status).toBe("waiting");
    expect(payment.requesterId).toBe("kim-riwon");
    expect(payment.recipientName).toBe("교보문고");
    expect(d.changeLogs.at(-1)!.entityType).toBe("payment_request");

    // 수신자명 길이 상한(100자) 초과는 거부한다
    expect(() =>
      d.createPaymentRequest(
        { actorId: "kim-riwon", via: "web" },
        {
          title: "t",
          recipientName: "가".repeat(101),
          bankName: "국민",
          accountNumber: "1",
          amount: 1000,
          category: "기타",
        },
      ),
    ).toThrowError(/상한 초과/);

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

  it("예상 소요시간을 추출하고 제목에서 제거한다 (시간·짜리·소수·분·반나절·종일)", async () => {
    const { parseTaskInput } = await import("./parse-task");
    const { USERS } = await import("./mock/users");
    const P = (text: string) => parseTaskInput({ text, users: USERS, now: NOW });

    // "N시간" — 값 추출 + 제목에서 제거
    const twoHours = P("2시간 상세페이지 QA");
    expect(twoHours.estimatedHours).toBe(2);
    expect(twoHours.title).toBe("상세페이지 QA");

    // "N시간짜리"
    const jjari = P("2시간짜리 디자인 작업");
    expect(jjari.estimatedHours).toBe(2);
    expect(jjari.title).toBe("디자인 작업");

    // 소수 "1.5시간"
    expect(P("1.5시간 코드 리뷰").estimatedHours).toBe(1.5);

    // "30분" = 0.5
    const halfHour = P("30분 배너 검토");
    expect(halfHour.estimatedHours).toBe(0.5);
    expect(halfHour.title).toBe("배너 검토");

    // "반나절" = 4, "하루종일" = 8, "한 시간" = 1
    expect(P("반나절 기획서 정리").estimatedHours).toBe(4);
    expect(P("하루종일 리팩터링").estimatedHours).toBe(8);
    expect(P("한 시간 회의 준비").estimatedHours).toBe(1);
  });

  it("시점 표현('N시간 후/뒤')은 소요로 뽑지 않는다 (오추출 방어)", async () => {
    const { parseTaskInput } = await import("./parse-task");
    const { USERS } = await import("./mock/users");
    const P = (text: string) => parseTaskInput({ text, users: USERS, now: NOW });

    // "2시간 후" — 시점이므로 estimatedHours 미추출. "2시간 후에"를 통째로 제거해
    // "2시"가 시각(startAt)으로도 오인되지 않는다.
    const after = P("2시간 후에 회의");
    expect(after.estimatedHours).toBeUndefined();
    expect(after.title).toBe("회의");
    expect(after.startAt).toBeUndefined();

    // "3시간 뒤" 도 미추출
    expect(P("3시간 뒤 배포 점검").estimatedHours).toBeUndefined();
  });

  it("마감시각(17시)은 소요와 혼동하지 않는다 (시각 파싱과 충돌 없음)", async () => {
    const { parseTaskInput } = await import("./parse-task");
    const { USERS } = await import("./mock/users");
    // "17시"는 마감시각 → 시각으로 파싱되고 estimatedHours는 없어야 한다
    const draft = parseTaskInput({ text: "17시 보고서 검토", users: USERS, now: NOW });
    expect(draft.estimatedHours).toBeUndefined();
    expect(new Date(draft.startAt!).getHours()).toBe(17);

    // "3시 30분"의 30분은 시각의 분이지 소요가 아니다
    const withMinute = parseTaskInput({ text: "오후 3시 30분 배너 검토", users: USERS, now: NOW });
    expect(withMinute.estimatedHours).toBeUndefined();
    expect(new Date(withMinute.startAt!).getHours()).toBe(15);
    expect(new Date(withMinute.startAt!).getMinutes()).toBe(30);
  });

  it("날짜 범위 'A부터 B까지'·'A~B'는 시작일 09:00 ~ 종료일 17:00으로 잡는다", async () => {
    const { parseTaskInput } = await import("./parse-task");
    const P = (text: string) => parseTaskInput({ text, users: USERS, now: NOW });

    // "부터 … 까지" — 두 날짜 모두 인식 → 범위. 제목은 두 날짜·연결어 제거 후 본문만 남는다.
    const range = P("7월 2일부터 7월 5일까지 상세페이지 QA");
    const rs = new Date(range.startAt!);
    const re = new Date(range.endAt!);
    expect(rs.getDate()).toBe(2);
    expect(rs.getHours()).toBe(9);
    expect(re.getDate()).toBe(5);
    expect(re.getHours()).toBe(17);
    expect(range.title).toBe("상세페이지 QA");
    // 범위는 시각을 09:00~17:00으로 확정하므로 "시간 없음" 질문을 남기지 않는다.
    expect(range.questions.some((q) => q.includes("시간이 없"))).toBe(false);

    // "A~B" 물결표 형태도 동일하게 범위로 본다(종료일 우측의 제목 본문은 보존).
    const tilde = P("7월 2일~7월 5일 배너 검토");
    expect(new Date(tilde.startAt!).getDate()).toBe(2);
    expect(new Date(tilde.endAt!).getDate()).toBe(5);
    expect(new Date(tilde.endAt!).getHours()).toBe(17);
    expect(tilde.title).toBe("배너 검토");
  });

  it("한쪽 날짜만 인식되면 범위를 포기하고 단일 날짜(마감 +1시간)로 폴백한다", async () => {
    const { parseTaskInput } = await import("./parse-task");
    // "까지" 없이 "부터"만 — 범위 아님. 단일 "7월 2일"만 잡히고 endAt은 start+1h(범위 17:00 아님).
    const draft = parseTaskInput({ text: "7월 2일부터 회의 준비", users: USERS, now: NOW });
    const s = new Date(draft.startAt!);
    const e = new Date(draft.endAt!);
    expect(s.getDate()).toBe(2);
    expect(s.getHours()).toBe(9);
    expect(e.getHours()).toBe(10); // 단일: 기본 1시간(범위였다면 17:00)
  });

  it("범위 표현이 없는 단일 입력은 기존 동작을 그대로 유지한다 (무회귀)", async () => {
    const { parseTaskInput } = await import("./parse-task");
    const draft = parseTaskInput({ text: "내일 오후 3시에 상세페이지 QA", users: USERS, now: NOW });
    const s = new Date(draft.startAt!);
    expect(s.getDate()).toBe(3); // 7/2 기준 내일
    expect(s.getHours()).toBe(15);
    expect(new Date(draft.endAt!).getHours()).toBe(16); // 단일: +1시간
    expect(draft.title).toBe("상세페이지 QA");
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

  it("priority를 전달하면 그 값으로, 없으면 normal로 생성된다", () => {
    const d = db();
    const high = d.createTask(
      { actorId: "lee-yejin", via: "web" },
      { title: "긴급 작업", priority: "high", source: "manual" },
    );
    expect(high.priority).toBe("high");
    const dflt = d.createTask(
      { actorId: "lee-yejin", via: "web" },
      { title: "보통 작업", source: "manual" },
    );
    expect(dflt.priority).toBe("normal");
  });

  it("잘못된 priority는 거부된다", () => {
    const d = db();
    expect(() =>
      d.createTask(
        { actorId: "lee-yejin", via: "web" },
        // @ts-expect-error 런타임 검증 확인 — 직렬화 경로의 잘못된 값
        { title: "t", priority: "urgent", source: "manual" },
      ),
    ).toThrowError(/우선순위/);
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

describe("작업 상세 편집 (updateTaskDetails)", () => {
  it("본인 작업의 제목·설명·우선순위를 부분 업데이트하고 바뀐 항목만 ChangeLog에 남긴다", () => {
    const d = db();
    // task-banner-design: owner=김리원, assignee=김리원
    const before = d.requireTask("task-banner-design");
    const prevDesc = before.description;
    const updated = d.updateTaskDetails(
      { actorId: "kim-riwon", via: "web" },
      { taskId: "task-banner-design", title: "배너 리디자인", priority: "high" },
    );
    expect(updated.title).toBe("배너 리디자인");
    expect(updated.priority).toBe("high");
    expect(updated.description).toBe(prevDesc); // 안 넘긴 필드는 그대로
    expect(updated.lastChangedBy).toBe("kim-riwon");
    const clog = d.changeLogs.at(-1)!;
    expect(clog.entityType).toBe("task");
    expect(clog.changeType).toBe("update");
    expect(clog.via).toBe("web");
    expect(clog.afterValue).toContain("제목: 배너 리디자인");
    expect(clog.afterValue).toContain("우선순위: high");
    // 설명은 안 바꿨으니 로그에 포함되지 않는다
    expect(clog.afterValue).not.toContain("설명:");
  });

  it("바뀐 값이 없으면 ChangeLog를 남기지 않는다(no-op)", () => {
    const d = db();
    const task = d.requireTask("task-banner-design");
    const logCount = d.changeLogs.length;
    d.updateTaskDetails(
      { actorId: "kim-riwon", via: "web" },
      { taskId: "task-banner-design", title: task.title, priority: task.priority },
    );
    expect(d.changeLogs.length).toBe(logCount);
  });

  it("본인 작업이 아니면(비관리자) 거부된다 — 편집은 댓글/요청만 가능", () => {
    const d = db();
    // task-landing-copy: owner/assignee=황성현, project=prj-summer(owner 황성현). 김리원은 무관 member.
    expect(() =>
      d.updateTaskDetails(
        { actorId: "kim-riwon", via: "web" },
        { taskId: "task-landing-copy", title: "무단 변경" },
      ),
    ).toThrowError(/수정할 수 없다/);
  });

  it("빈 제목·2000자 초과 설명·잘못된 우선순위는 거부된다", () => {
    const d = db();
    expect(() =>
      d.updateTaskDetails(
        { actorId: "kim-riwon", via: "web" },
        { taskId: "task-banner-design", title: "   " },
      ),
    ).toThrowError(/작업명은 필수/);
    expect(() =>
      d.updateTaskDetails(
        { actorId: "kim-riwon", via: "web" },
        { taskId: "task-banner-design", description: "가".repeat(2001) },
      ),
    ).toThrowError(/2000자/);
    expect(() =>
      d.updateTaskDetails(
        { actorId: "kim-riwon", via: "web" },
        // @ts-expect-error 직렬화 경로의 잘못된 값
        { taskId: "task-banner-design", priority: "urgent" },
      ),
    ).toThrowError(/우선순위/);
  });

  it("endAt=null로 마감을 해제할 수 있다", () => {
    const d = db();
    // task-landing-copy는 endAt이 있고 owner=황성현(admin)이 편집
    const updated = d.updateTaskDetails(
      { actorId: "hwang-sunghyeon", via: "web" },
      { taskId: "task-landing-copy", endAt: null },
    );
    expect(updated.endAt).toBeUndefined();
  });

  it("관리자는 남의 작업도 편집할 수 있다", () => {
    const d = db();
    const updated = d.updateTaskDetails(
      { actorId: "hwang-sunghyeon", via: "cli" },
      { taskId: "task-banner-design", description: "관리자 메모" },
    );
    expect(updated.description).toBe("관리자 메모");
    expect(d.changeLogs.at(-1)!.via).toBe("cli");
  });

  it("시작 시각을 변경하면 ChangeLog에 남고, 시작>마감이면 거부된다", () => {
    const d = db();
    // task-banner-design: 시작 10시·마감 13시. 시작을 12시로 당기면 통과.
    const before = d.requireTask("task-banner-design");
    const newStart = new Date(before.endAt!);
    newStart.setHours(newStart.getHours() - 1); // 12시
    const updated = d.updateTaskDetails(
      { actorId: "kim-riwon", via: "web" },
      { taskId: "task-banner-design", startAt: newStart.toISOString() },
    );
    expect(updated.startAt).toBe(newStart.toISOString());
    expect(d.changeLogs.at(-1)!.afterValue).toContain("시작:");
    // 마감(13시)보다 늦은 시작은 거부.
    const afterEnd = new Date(before.endAt!);
    afterEnd.setHours(afterEnd.getHours() + 1);
    expect(() =>
      d.updateTaskDetails(
        { actorId: "kim-riwon", via: "web" },
        { taskId: "task-banner-design", startAt: afterEnd.toISOString() },
      ),
    ).toThrowError(/시작 시각보다 빠를 수 없다/);
  });

  it("프로젝트를 변경·해제할 수 있고, 없는 프로젝트는 거부된다", () => {
    const d = db();
    const moved = d.updateTaskDetails(
      { actorId: "kim-riwon", via: "web" },
      { taskId: "task-banner-design", projectId: "prj-payment" },
    );
    expect(moved.projectId).toBe("prj-payment");
    expect(d.changeLogs.at(-1)!.afterValue).toContain("프로젝트:");
    // null로 프로젝트 해제
    const cleared = d.updateTaskDetails(
      { actorId: "kim-riwon", via: "web" },
      { taskId: "task-banner-design", projectId: null },
    );
    expect(cleared.projectId).toBeUndefined();
    // 유령 프로젝트는 거부
    expect(() =>
      d.updateTaskDetails(
        { actorId: "kim-riwon", via: "web" },
        { taskId: "task-banner-design", projectId: "prj-ghost" },
      ),
    ).toThrowError(/프로젝트 없음/);
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
        { actorId: "lee-hyejin", via: "web" },
        { paymentId: "pay-courier", to: "done" },
      ),
    ).toThrowError(/관리자/);
  });
});

describe("결제 요청 내역 수정", () => {
  it("등록자는 대기 상태 요청의 금액·제목을 수정하고 ChangeLog(update)가 남는다", () => {
    const d = db();
    // pay-stock-photo: 등록자 kim-riwon, waiting, 금액 264000
    const updated = d.updatePaymentRequest(
      { actorId: "kim-riwon", via: "web" },
      { paymentId: "pay-stock-photo", amount: 300000, title: "스톡 이미지 연간 구독(갱신)" },
    );
    expect(updated.amount).toBe(300000);
    expect(updated.title).toBe("스톡 이미지 연간 구독(갱신)");
    expect(updated.lastChangedBy).toBe("kim-riwon");
    const clog = d.changeLogs.at(-1)!;
    expect(clog.entityType).toBe("payment_request");
    expect(clog.changeType).toBe("update");
    expect(clog.via).toBe("web");
    // 금액은 before→after 콤마 표기로 감사 가치를 남긴다
    expect(clog.reason).toContain("264,000→300,000");
    expect(clog.reason).toContain("제목");
  });

  it("완료·취소된 요청은 수정할 수 없다(감사 기록 보호)", () => {
    const d = db();
    // pay-fonts: done, pay-cancel-sample: cancelled
    expect(() =>
      d.updatePaymentRequest(
        { actorId: "hwang-sunghyeon", via: "web" },
        { paymentId: "pay-fonts", amount: 1000 },
      ),
    ).toThrowError(/수정할 수 없다/);
    expect(() =>
      d.updatePaymentRequest(
        { actorId: "kim-riwon", via: "web" },
        { paymentId: "pay-cancel-sample", amount: 1000 },
      ),
    ).toThrowError(/수정할 수 없다/);
  });

  it("등록자도 관리자도 아니면 거부한다", () => {
    const d = db();
    // pay-stock-photo 등록자는 kim-riwon. lee-hyejin은 사원.
    expect(() =>
      d.updatePaymentRequest(
        { actorId: "lee-hyejin", via: "web" },
        { paymentId: "pay-stock-photo", amount: 1 },
      ),
    ).toThrowError(/등록자 또는 관리자/);
  });

  it("관리자는 타인 등록 요청도 수정할 수 있다", () => {
    const d = db();
    const updated = d.updatePaymentRequest(
      { actorId: "hwang-sunghyeon", via: "web" },
      { paymentId: "pay-stock-photo", category: "라이선스" },
    );
    expect(updated.category).toBe("라이선스");
    expect(updated.lastChangedBy).toBe("hwang-sunghyeon");
  });

  it("변경 필드가 하나도 없으면 거부한다", () => {
    const d = db();
    expect(() =>
      d.updatePaymentRequest({ actorId: "kim-riwon", via: "web" }, { paymentId: "pay-stock-photo" }),
    ).toThrowError(/최소 1개/);
  });

  it("옵셔널 필드는 빈 문자열로 제거된다(수신자명·마감일)", () => {
    const d = db();
    const before = d.paymentRequests.find((p) => p.id === "pay-stock-photo")!;
    expect(before.recipientName).toBeTruthy();
    expect(before.dueAt).toBeTruthy();
    const updated = d.updatePaymentRequest(
      { actorId: "kim-riwon", via: "web" },
      { paymentId: "pay-stock-photo", recipientName: "", dueAt: "" },
    );
    expect(updated.recipientName).toBeUndefined();
    expect(updated.dueAt).toBeUndefined();
  });

  it("ChangeLog에 계좌·은행 원본 값을 남기지 않는다", () => {
    const d = db();
    d.updatePaymentRequest(
      { actorId: "kim-riwon", via: "web" },
      { paymentId: "pay-stock-photo", bankName: "카카오뱅크", accountNumber: "3333-99-8888888" },
    );
    const clog = d.changeLogs.at(-1)!;
    expect(clog.reason).toContain("입금 정보 변경");
    // 민감정보 원본은 절대 로그에 남지 않아야 한다
    expect(clog.reason).not.toContain("카카오뱅크");
    expect(clog.reason).not.toContain("3333-99-8888888");
    expect(clog.reason).not.toContain("신한은행"); // before 계좌/은행도 금지
    expect(clog.reason).not.toContain("110-123-456789");
  });

  it("길이 상한·금액 범위는 create와 동일하게 강제한다", () => {
    const d = db();
    expect(() =>
      d.updatePaymentRequest(
        { actorId: "kim-riwon", via: "web" },
        { paymentId: "pay-stock-photo", amount: -1 },
      ),
    ).toThrowError(/0보다 크고/);
    expect(() =>
      d.updatePaymentRequest(
        { actorId: "kim-riwon", via: "web" },
        { paymentId: "pay-stock-photo", title: " " },
      ),
    ).toThrowError(/필수다/);
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

  it("추출 제목에서 마크다운 잔재(체크박스·볼드·밑줄)를 벗긴다 — 알림·목록 노출 방지", () => {
    const d = db();
    const note = d.createMeetingNote(
      { actorId: "oh-seunghoon", via: "web" },
      {
        title: "정리 회의",
        meetingAt: NOW.toISOString(),
        attendeeIds: [],
        fileName: "정리.md",
        markdownBody: [
          "- [ ] **의자 및 좌석 배치**: 조달 방안 검토",
          "- [ ] __발표자 안내__ 메일 발송",
        ].join("\n"),
      },
    );
    const items = d.extractActionItems({ actorId: "oh-seunghoon", via: "web" }, note.id);
    expect(items[0].title).toBe("의자 및 좌석 배치: 조달 방안 검토");
    expect(items[1].title).toBe("발표자 안내 메일 발송");
    // 원문(sourceText)은 마커 포함 그대로 보존된다
    expect(items[0].sourceText).toContain("**의자");
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
      d.extractActionItems({ actorId: "lee-hyejin", via: "web" }, note.id),
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

describe("Action 추출 — 확정 요약 폼(체크박스·담당·마감) 실물 회귀", () => {
  // 실물 샘플(2026-07-14 확정 폼): 섹션 요약 불릿 + '### 작업 항목' 체크박스 + 말미 'AI 제안 요약' 불릿.
  const SAMPLE = readFileSync(
    fileURLToPath(new URL("./__fixtures__/meeting-note-sample-epic-0714.md", import.meta.url)),
    "utf8",
  );

  function extractFromSample() {
    const d = db();
    const note = d.createMeetingNote(
      { actorId: "oh-seunghoon", via: "web" },
      {
        title: "07-14 주간 회의",
        meetingAt: NOW.toISOString(),
        attendeeIds: [],
        fileName: "meeting-note-sample-epic-0714.md",
        markdownBody: SAMPLE,
      },
    );
    return d.extractActionItems({ actorId: "oh-seunghoon", via: "web" }, note.id);
  }

  it("체크박스 라인만 추출하고 요약·AI 제안 불릿은 제외한다(59건)", () => {
    const items = extractFromSample();
    // 샘플의 '- [ ]' 체크박스는 정확히 59개. 섹션 요약 불릿·'AI 제안 요약' 11개 등 일반 불릿은 전부 제외.
    expect(items).toHaveLength(59);
    // 요약/AI 제안 불릿 특유의 문장이 후보 제목에 섞이지 않았는지(노이즈 차단 검증).
    expect(items.some((i) => i.title.includes("백업 스폰서"))).toBe(false); // AI 제안 요약 불릿
    expect(items.some((i) => i.title.includes("메타 픽셀 연동은 완료"))).toBe(false); // 섹션 요약 불릿
  });

  it("마감일을 단일/범위 끝/복수 마지막/월넘김으로 파싱한다(45건, 17:00 KST)", () => {
    const items = extractFromSample();
    const withDue = items.filter((i) => i.dueAt);
    expect(withDue).toHaveLength(45);
    // 모든 dueAt는 업무시간(17:00 +09:00) 기본 관례.
    expect(withDue.every((i) => i.dueAt!.endsWith("T17:00:00+09:00"))).toBe(true);
    const dueDay = (title: string) =>
      items.find((i) => i.title.startsWith(title))?.dueAt?.slice(0, 10);
    // 범위 '2026-07-31~08-02' → 끝(월 넘김 보정).
    expect(dueDay("브랜딩 디자인 최종 컨펌")).toBe("2026-08-02");
    // 범위 '2026-07-15~19' → 끝(일 축약 보정).
    expect(dueDay("시트 옆 오프라인 디자인")).toBe("2026-07-19");
    // 복수 '2026-07-26, 2026-07-30' → 마지막.
    expect(dueDay("대표 대시보드 개선")).toBe("2026-07-30");
    // '2026-07-15 오후' → 수식어 무시, 날짜만.
    expect(dueDay("발표자 리마인더 메일")).toBe("2026-07-15");
  });

  it("익명·호칭·부분이름은 미배정 — 오매칭보다 미배정이 안전(샘플 담당 매칭 0건)", () => {
    const items = extractFromSample();
    // 샘플 담당자는 전부 'Speaker N'·'[Insert Name]'·호칭('실장님')·비팀원('박정현 차장님')·부분이름('승환씨').
    // 팀원 전체이름이 담긴 꼬리가 하나도 없어 매칭 0건이 정상(안전 매칭).
    expect(items.filter((i) => i.assigneeId)).toHaveLength(0);
    // 담당·마감 모두 없으니 candidate 승격 0건 — 전부 확인 필요.
    expect(items.filter((i) => i.status === "candidate")).toHaveLength(0);
    expect(items.every((i) => i.status === "needs_review")).toBe(true);
    // 마감만 있는 항목의 신뢰도는 0.6, 둘 다 없으면 0.5.
    const dued = items.find((i) => i.dueAt);
    expect(dued?.confidence).toBe(0.6);
    const bare = items.find((i) => !i.dueAt && !i.assigneeId);
    expect(bare?.confidence).toBe(0.5);
  });

  it("담당·마감이 모두 있으면 candidate로 승격하고 신뢰도 0.9 — Task 자동 생성은 없다", () => {
    const d = db();
    // 팀원 전체이름(황성현) + 단일 마감이 담긴 체크박스 1줄.
    const note = d.createMeetingNote(
      { actorId: "oh-seunghoon", via: "web" },
      {
        title: "확정 폼 단건",
        meetingAt: NOW.toISOString(),
        attendeeIds: [],
        fileName: "one.md",
        markdownBody: "### 작업 항목\n- [ ] 랜딩 카피 최종 검토 — 황성현 2026-07-17",
      },
    );
    const before = d.tasks.length;
    const [item] = d.extractActionItems({ actorId: "oh-seunghoon", via: "web" }, note.id);
    expect(item.assigneeId).toBe("hwang-sunghyeon");
    expect(item.dueAt).toBe("2026-07-17T17:00:00+09:00");
    expect(item.status).toBe("candidate");
    expect(item.confidence).toBe(0.9);
    expect(item.title).toBe("랜딩 카피 최종 검토"); // 꼬리(담당·날짜) 제거
    expect(item.sourceText).toContain("황성현 2026-07-17"); // 원문 보존
    expect(d.tasks.length).toBe(before); // 자동 Task 생성 금지(도메인 규칙)
  });

  it("복수 담당은 첫 언급 팀원만 assigneeId, 나머지는 sourceText에 남는다", () => {
    const d = db();
    const note = d.createMeetingNote(
      { actorId: "oh-seunghoon", via: "web" },
      {
        title: "복수 담당",
        meetingAt: NOW.toISOString(),
        attendeeIds: [],
        fileName: "multi.md",
        markdownBody: "### 작업 항목\n- [ ] 부스 세팅 점검 — 이예진, 김리원 2026-07-20",
      },
    );
    const [item] = d.extractActionItems({ actorId: "oh-seunghoon", via: "web" }, note.id);
    expect(item.assigneeId).toBe("lee-yejin"); // 꼬리에서 먼저 언급된 이예진
    expect(item.sourceText).toContain("김리원"); // 둘째 담당은 원문 보존
  });

  it("체크박스가 전혀 없는 문서는 기존 전체-불릿 동작(하위호환)", () => {
    const d = db();
    const note = d.createMeetingNote(
      { actorId: "oh-seunghoon", via: "web" },
      {
        title: "구형 회의록",
        meetingAt: NOW.toISOString(),
        attendeeIds: [],
        fileName: "legacy.md",
        markdownBody: ["## 할 일", "- 배너 문구 검토", "- 예산안 정리 (담당: 황성현)"].join("\n"),
      },
    );
    const items = d.extractActionItems({ actorId: "oh-seunghoon", via: "web" }, note.id);
    expect(items).toHaveLength(2); // 체크박스 없음 → 모든 불릿 후보
    expect(items[1].assigneeId).toBe("hwang-sunghyeon"); // 레거시 '담당: 이름' 유지
    expect(items[1].title).toBe("예산안 정리");
  });

  it("달력에 없는 날짜(2월 31일)는 조용히 무시한다 — V8 롤오버/Postgres 거부 비대칭 차단", () => {
    const d = db();
    const note = d.createMeetingNote(
      { actorId: "oh-seunghoon", via: "web" },
      {
        title: "달력 오류",
        meetingAt: NOW.toISOString(),
        attendeeIds: [],
        fileName: "bad-date.md",
        markdownBody: "### 작업 항목\n- [ ] 정산 마감 — 황성현 2026-02-31",
      },
    );
    const [item] = d.extractActionItems({ actorId: "oh-seunghoon", via: "web" }, note.id);
    // V8 Date.parse는 2026-02-31을 3월 3일로 롤오버해 통과시키지만, 라운드트립 검증이 걸러낸다.
    expect(item.dueAt).toBeUndefined();
    expect(item.assigneeId).toBe("hwang-sunghyeon"); // 담당 매칭은 유지
    expect(item.status).toBe("needs_review"); // 마감 없음 → 승격 안 됨
  });
});

describe("비공개 일정 열람 권한 (canViewPrivateEventDetail)", () => {
  // 시드 role이 바뀌어도(관리자 승격 등) 깨지지 않게 배열 위치가 아니라 role로 고른다.
  const admin = USERS.find((u) => u.role === "admin")!;
  const members = USERS.filter((u) => u.role === "member");
  const [member1, member2] = members;
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
  // 배열 위치가 아니라 role로 골라 시드 승격/강등에 견디게 한다.
  const admin = USERS.find((u) => u.role === "admin")!;
  const members = USERS.filter((u) => u.role === "member");
  const [uploader, outsider, allowed] = members;

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
        { actorId: "lee-hyejin", via: "web" },
        { actionItemId: "act-refund-copy", assigneeId: "lee-hyejin" },
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
        { actorId: "lee-hyejin", via: "web" },
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
        { actorId: "lee-hyejin", via: "web" },
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

describe("마일스톤 중요 표시(critical)", () => {
  it("생성 시 critical을 켤 수 있고, 수정으로 켜고 끌 수 있다", () => {
    const d = db();
    const m = d.createMilestone(
      { actorId: "hwang-sunghyeon", via: "web" },
      { projectId: "prj-payment", title: "최종 런칭", dueAt: "2026-08-30T09:00:00.000Z", critical: true },
    );
    expect(m.critical).toBe(true);
    const off = d.updateMilestone(
      { actorId: "hwang-sunghyeon", via: "web" },
      { milestoneId: m.id, critical: false },
    );
    expect(off.critical).toBeUndefined(); // false는 저장하지 않는다(미표시=undefined)
    const on = d.updateMilestone(
      { actorId: "hwang-sunghyeon", via: "web" },
      { milestoneId: m.id, critical: true },
    );
    expect(on.critical).toBe(true);
  });

  it("[우회 공격] critical에 boolean 외 값을 주입하면 수정이 거부된다", () => {
    const d = db();
    expect(() =>
      d.updateMilestone(
        { actorId: "hwang-sunghyeon", via: "web" },
        { milestoneId: "ms-payment-qa", critical: "true" as never },
      ),
    ).toThrowError(/참\/거짓/);
  });
});

describe("마일스톤 안건 결정 기록", () => {
  it("keep은 데이터를 바꾸지 않지만 결정 기록과 ChangeLog를 남긴다", () => {
    const d = db();
    const before = d.milestones.find((m) => m.id === "ms-payment-qa")!;
    const dueBefore = before.dueAt;
    const riskBefore = before.riskStatus;
    const changedAtBefore = before.lastChangedAt;
    const m = d.recordMilestoneDecision(
      { actorId: "hwang-sunghyeon", via: "web" },
      { milestoneId: "ms-payment-qa", decision: "keep" },
    );
    expect(m.dueAt).toBe(dueBefore);
    expect(m.riskStatus).toBe(riskBefore);
    expect(m.lastChangedAt).toBe(changedAtBefore); // keep은 '오늘 late 전환' 트리거를 켜지 않는다
    expect(m.lastDecision).toBe("keep");
    expect(m.lastDecisionAt).toBeTruthy();
    const clog = d.changeLogs.at(-1)!;
    expect(clog.entityType).toBe("milestone");
    expect(clog.afterValue).toContain("결정: 기한 유지");
  });

  it("defer는 새 마감일이 필수이고 dueAt이 바뀐다", () => {
    const d = db();
    expect(() =>
      d.recordMilestoneDecision(
        { actorId: "hwang-sunghyeon", via: "web" },
        { milestoneId: "ms-payment-qa", decision: "defer" },
      ),
    ).toThrowError(/새 마감일/);
    const m = d.recordMilestoneDecision(
      { actorId: "hwang-sunghyeon", via: "web" },
      { milestoneId: "ms-payment-qa", decision: "defer", newDueAt: "2026-07-20T09:00:00.000Z" },
    );
    expect(m.dueAt).toBe("2026-07-20T09:00:00.000Z");
    expect(m.lastDecision).toBe("defer");
  });

  it("hold는 사유가 필수이고 riskStatus가 at_risk로 오른다", () => {
    const d = db();
    expect(() =>
      d.recordMilestoneDecision(
        { actorId: "hwang-sunghyeon", via: "web" },
        { milestoneId: "ms-payment-qa", decision: "hold" },
      ),
    ).toThrowError(/사유/);
    const m = d.recordMilestoneDecision(
      { actorId: "hwang-sunghyeon", via: "web" },
      { milestoneId: "ms-payment-qa", decision: "hold", reason: "외주 지연" },
    );
    expect(m.riskStatus).toBe("at_risk");
    expect(d.changeLogs.at(-1)!.afterValue).toContain("사유: 외주 지연");
  });

  it("무관한 팀원은 결정을 기록할 수 없다", () => {
    const d = db();
    expect(() =>
      d.recordMilestoneDecision(
        { actorId: "lee-hyejin", via: "web" },
        { milestoneId: "ms-payment-qa", decision: "keep" },
      ),
    ).toThrowError(/프로젝트 담당자 또는 관리자만/);
  });
});

describe("마일스톤 완료 처리 (setMilestoneAchieved)", () => {
  it("프로젝트 담당자는 완료 처리할 수 있고 achievedAt·ChangeLog가 남는다", () => {
    const d = db();
    // ms-payment-qa는 prj-payment(담당 오승훈) 소속
    const m = d.setMilestoneAchieved(
      { actorId: "oh-seunghoon", via: "web" },
      { milestoneId: "ms-payment-qa", achieved: true },
    );
    expect(m.achievedAt).toBeTruthy();
    expect(m.lastChangedBy).toBe("oh-seunghoon");
    const clog = d.changeLogs.at(-1)!;
    expect(clog.entityType).toBe("milestone");
    expect(clog.changeType).toBe("update");
    expect(clog.afterValue).toBe("완료 처리");
  });

  it("무관한 팀원은 완료 처리할 수 없다", () => {
    const d = db();
    expect(() =>
      d.setMilestoneAchieved(
        { actorId: "lee-hyejin", via: "web" },
        { milestoneId: "ms-payment-qa", achieved: true },
      ),
    ).toThrowError(/프로젝트 담당자 또는 관리자만/);
  });

  it("완료를 해제하면 achievedAt이 사라지고 해제 로그가 남는다", () => {
    const d = db();
    d.setMilestoneAchieved(
      { actorId: "hwang-sunghyeon", via: "web" },
      { milestoneId: "ms-payment-qa", achieved: true },
    );
    const off = d.setMilestoneAchieved(
      { actorId: "hwang-sunghyeon", via: "web" },
      { milestoneId: "ms-payment-qa", achieved: false },
    );
    expect(off.achievedAt).toBeUndefined();
    expect(d.changeLogs.at(-1)!.afterValue).toBe("완료 해제");
  });

  it("같은 값 재설정은 no-op이다(ChangeLog 소음 방지)", () => {
    const d = db();
    d.setMilestoneAchieved(
      { actorId: "hwang-sunghyeon", via: "web" },
      { milestoneId: "ms-payment-qa", achieved: true },
    );
    const logCountAfterAchieve = d.changeLogs.length;
    // 이미 완료된 마일스톤을 다시 완료 처리 — 아무 변화 없음.
    d.setMilestoneAchieved(
      { actorId: "hwang-sunghyeon", via: "web" },
      { milestoneId: "ms-payment-qa", achieved: true },
    );
    expect(d.changeLogs.length).toBe(logCountAfterAchieve);
  });

  it("[우회 공격] achieved에 boolean 외 값을 주입하면 거부된다", () => {
    const d = db();
    expect(() =>
      d.setMilestoneAchieved(
        { actorId: "hwang-sunghyeon", via: "web" },
        { milestoneId: "ms-payment-qa", achieved: "true" as never },
      ),
    ).toThrowError(/참\/거짓/);
  });
});

describe("마일스톤 삭제", () => {
  it("무관한 팀원은 마일스톤을 삭제할 수 없다", () => {
    const d = db();
    // ms-summer-report는 prj-summer(담당 황성현) 소속, lee-hyejin은 아무 프로젝트도 소유하지 않음
    expect(() =>
      d.deleteMilestone(
        { actorId: "lee-hyejin", via: "web" },
        { milestoneId: "ms-summer-report" },
      ),
    ).toThrowError(/프로젝트 담당자 또는 관리자만/);
  });

  it("프로젝트 담당자는 자기 마일스톤을 삭제할 수 있고 ChangeLog가 남는다", () => {
    const d = db();
    // lee-yejin(멤버)은 prj-cs 담당 — 이력 없는 새 마일스톤을 만들어 삭제한다.
    const created = d.createMilestone(
      { actorId: "lee-yejin", via: "web" },
      { projectId: "prj-cs", title: "임시 마일스톤", dueAt: "2026-08-01T09:00:00.000Z" },
    );
    d.deleteMilestone({ actorId: "lee-yejin", via: "web" }, { milestoneId: created.id });
    expect(d.milestones.find((m) => m.id === created.id)).toBeUndefined();
    const clog = d.changeLogs.at(-1)!;
    expect(clog.entityType).toBe("milestone");
    expect(clog.changeType).toBe("delete");
    expect(clog.entityId).toBe(created.id);
  });

  it("회고 기록이 있는 마일스톤은 삭제할 수 없다 — 관리자여도 거부", () => {
    const d = db();
    // ms-payment-qa에는 retro-payment-qa 회고가 있다. oh-seunghoon은 admin·담당이지만 이력 보존이 우선.
    expect(() =>
      d.deleteMilestone(
        { actorId: "oh-seunghoon", via: "web" },
        { milestoneId: "ms-payment-qa" },
      ),
    ).toThrowError(/회고 기록/);
    expect(d.milestones.find((m) => m.id === "ms-payment-qa")).toBeDefined();
  });

  it("변경 접수 이력이 있는 마일스톤은 삭제할 수 없다", () => {
    const d = db();
    // ms-summer-open은 chgreq-summer-scope 변경 접수가 참조한다.
    expect(() =>
      d.deleteMilestone(
        { actorId: "hwang-sunghyeon", via: "web" },
        { milestoneId: "ms-summer-open" },
      ),
    ).toThrowError(/변경 접수 이력/);
  });

  it("관리자는 이력 없는 마일스톤을 삭제하고 프로젝트 milestoneIds가 정리된다", () => {
    const d = db();
    d.deleteMilestone(
      { actorId: "hwang-sunghyeon", via: "web" },
      { milestoneId: "ms-summer-report" },
    );
    expect(d.milestones.find((m) => m.id === "ms-summer-report")).toBeUndefined();
    const project = d.projects.find((p) => p.id === "prj-summer")!;
    expect(project.milestoneIds).not.toContain("ms-summer-report");
  });
});

describe("마일스톤 프로젝트 변경", () => {
  it("관리자는 다른 프로젝트로 옮길 수 있고 ChangeLog에 프로젝트 변경이 남는다", () => {
    const d = db();
    const updated = d.updateMilestone(
      { actorId: "hwang-sunghyeon", via: "web" },
      { milestoneId: "ms-summer-report", projectId: "prj-payment" },
    );
    expect(updated.projectId).toBe("prj-payment");
    // 파생 milestoneIds가 원/대상 프로젝트에서 정리된다.
    expect(d.projects.find((p) => p.id === "prj-summer")!.milestoneIds).not.toContain(
      "ms-summer-report",
    );
    expect(d.projects.find((p) => p.id === "prj-payment")!.milestoneIds).toContain(
      "ms-summer-report",
    );
    const clog = d.changeLogs.find(
      (c) => c.entityId === "ms-summer-report" && c.afterValue?.includes("프로젝트 변경"),
    );
    expect(clog).toBeDefined();
  });

  it("담당자는 자기가 관리하지 않는 프로젝트로는 옮길 수 없다", () => {
    const d = db();
    // lee-yejin은 prj-cs만 담당 — prj-summer(담당 황성현)로는 밀어넣을 수 없다.
    const created = d.createMilestone(
      { actorId: "lee-yejin", via: "web" },
      { projectId: "prj-cs", title: "이관 시도", dueAt: "2026-08-01T09:00:00.000Z" },
    );
    expect(() =>
      d.updateMilestone(
        { actorId: "lee-yejin", via: "web" },
        { milestoneId: created.id, projectId: "prj-summer" },
      ),
    ).toThrowError(/옮길 프로젝트의 담당자 또는 관리자만/);
  });

  it("존재하지 않는 프로젝트로는 옮길 수 없다", () => {
    const d = db();
    expect(() =>
      d.updateMilestone(
        { actorId: "hwang-sunghyeon", via: "web" },
        { milestoneId: "ms-summer-report", projectId: "prj-nope" },
      ),
    ).toThrowError(/프로젝트 없음/);
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
        { actorId: "lee-hyejin", via: "web" },
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
      paymentCategorySchema,
      paymentRequestSchema,
      meetingNoteSchema,
      milestoneSchema,
      projectSchema,
      recurringTemplateSchema,
    } = await import("./domain");

    for (const t of d.tasks) taskSchema.parse(t);
    for (const e of d.calendarEvents) calendarEventSchema.parse(e);
    for (const a of d.actionItems) actionItemSchema.parse(a);
    for (const c of d.paymentCategories) paymentCategorySchema.parse(c);
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
      d.setRecurringTemplateActive({ actorId: "lee-hyejin", via: "web" }, tmpl.id, false),
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

describe("프로젝트 표시 순서 변경 (reorderProjects)", () => {
  // client-mendix 그룹에 2건 더 추가해 3건 그룹(prj-summer·A·B)을 만든다.
  function withGroup() {
    const d = db();
    const a = d.createProject(
      { actorId: "hwang-sunghyeon", via: "web" },
      { name: "A", clientId: "client-mendix" },
    );
    const b = d.createProject(
      { actorId: "hwang-sunghyeon", via: "web" },
      { name: "B", clientId: "client-mendix" },
    );
    return { d, a, b };
  }

  it("같은 클라이언트 그룹 안에서 orderedIds대로 sortOrder를 0..n-1로 재설정하고 ChangeLog를 남긴다", () => {
    const { d, a, b } = withGroup();
    const next = [b.id, a.id, "prj-summer"];
    const result = d.reorderProjects(
      { actorId: "hwang-sunghyeon", via: "web" },
      { clientId: "client-mendix", orderedIds: next },
    );
    expect(result.map((p) => p.id)).toEqual(next);
    next.forEach((id, i) => {
      expect(d.projects.find((p) => p.id === id)!.sortOrder).toBe(i);
    });
    const clog = d.changeLogs.at(-1)!;
    expect(clog.entityType).toBe("project");
    expect(clog.changeType).toBe("update");
    expect(clog.reason).toBe("표시 순서 변경");
  });

  it("다른 그룹(다른 클라이언트)의 프로젝트를 섞으면 거부한다", () => {
    const { d } = withGroup();
    // prj-payment는 client-epic 소속 — client-mendix 정렬에 섞을 수 없다.
    expect(() =>
      d.reorderProjects(
        { actorId: "hwang-sunghyeon", via: "web" },
        { clientId: "client-mendix", orderedIds: ["prj-summer", "prj-payment"] },
      ),
    ).toThrowError(/다른 그룹/);
  });

  it("관리자도 담당자도 아니면 순서를 바꿀 수 없다", () => {
    const { d } = withGroup();
    // prj-summer 담당은 hwang(관리자). kim-riwon은 관리자도 담당자도 아니다.
    expect(() =>
      d.reorderProjects(
        { actorId: "kim-riwon", via: "web" },
        { clientId: "client-mendix", orderedIds: ["prj-summer"] },
      ),
    ).toThrowError(/관리자 또는 프로젝트 담당자/);
  });

  it("중복 id는 거부한다", () => {
    const { d } = withGroup();
    expect(() =>
      d.reorderProjects(
        { actorId: "hwang-sunghyeon", via: "web" },
        { clientId: "client-mendix", orderedIds: ["prj-summer", "prj-summer"] },
      ),
    ).toThrowError(/중복/);
  });
});

describe("간트 작업 세로 순서 변경 (reorderProjectTasks)", () => {
  // prj-summer(담당 hwang=admin, client-mendix) 소속 태스크들. prj-payment 소속은 task-payment-qa.
  const summerA = "task-landing-copy";
  const summerB = "task-ad-review";
  const summerC = "task-detail-qa";

  it("전달 순서대로 sortOrder를 (index+1)*10으로 채우고 ChangeLog 1건(entityType project)을 남긴다", () => {
    const d = db();
    const before = d.changeLogs.length;
    const next = [summerC, summerA, summerB];
    const result = d.reorderProjectTasks(
      { actorId: "hwang-sunghyeon", via: "web" },
      { projectId: "prj-summer", orderedTaskIds: next },
    );
    expect(result.map((t) => t.id)).toEqual(next);
    expect(d.tasks.find((t) => t.id === summerC)!.sortOrder).toBe(10);
    expect(d.tasks.find((t) => t.id === summerA)!.sortOrder).toBe(20);
    expect(d.tasks.find((t) => t.id === summerB)!.sortOrder).toBe(30);
    // ChangeLog 1건만 — 태스크별 lastChangedBy/At은 갱신하지 않는다(표시 속성 소음 방지).
    expect(d.changeLogs.length).toBe(before + 1);
    const clog = d.changeLogs.at(-1)!;
    expect(clog.entityType).toBe("project");
    expect(clog.entityId).toBe("prj-summer");
    expect(clog.changeType).toBe("update");
    expect(clog.afterValue).toBe("작업 표시 순서 변경");
    expect(d.tasks.find((t) => t.id === summerC)!.lastChangedBy).toBeUndefined();
  });

  it("전달에 빠진 같은 프로젝트 태스크는 건드리지 않는다(부분 재정렬)", () => {
    const d = db();
    const untouched = d.tasks.find((t) => t.id === "task-final-review")!.sortOrder;
    d.reorderProjectTasks(
      { actorId: "hwang-sunghyeon", via: "web" },
      { projectId: "prj-summer", orderedTaskIds: [summerA, summerB] },
    );
    expect(d.tasks.find((t) => t.id === "task-final-review")!.sortOrder).toBe(untouched);
  });

  it("관리자도 담당자도 아니면 순서를 바꿀 수 없다", () => {
    const d = db();
    // prj-summer 담당은 hwang(관리자). kim-riwon은 관리자도 담당자도 아니다(태스크 배정 여부와 무관).
    expect(() =>
      d.reorderProjectTasks(
        { actorId: "kim-riwon", via: "web" },
        { projectId: "prj-summer", orderedTaskIds: [summerA] },
      ),
    ).toThrowError(/관리자 또는 프로젝트 담당자/);
  });

  it("다른 프로젝트의 작업을 섞으면 거부한다", () => {
    const d = db();
    // task-payment-qa는 prj-payment 소속 — prj-summer 정렬에 섞을 수 없다.
    expect(() =>
      d.reorderProjectTasks(
        { actorId: "hwang-sunghyeon", via: "web" },
        { projectId: "prj-summer", orderedTaskIds: [summerA, "task-payment-qa"] },
      ),
    ).toThrowError(/속하지 않은/);
  });

  it("중복 id는 거부한다", () => {
    const d = db();
    expect(() =>
      d.reorderProjectTasks(
        { actorId: "hwang-sunghyeon", via: "web" },
        { projectId: "prj-summer", orderedTaskIds: [summerA, summerA] },
      ),
    ).toThrowError(/중복/);
  });

  it("없는 프로젝트는 거부한다", () => {
    const d = db();
    expect(() =>
      d.reorderProjectTasks(
        { actorId: "hwang-sunghyeon", via: "web" },
        { projectId: "prj-nope", orderedTaskIds: [summerA] },
      ),
    ).toThrowError(/프로젝트 없음/);
  });
});

describe("결제 분류(카테고리) — 관리자만 생성·수정·순서변경", () => {
  it("비관리자는 결제 분류를 만들 수 없다(아무것도 추가되지 않음)", () => {
    const d = db();
    expect(() =>
      d.createPaymentCategory({ actorId: "kim-riwon", via: "web" }, { name: "회식비" }),
    ).toThrowError(/관리자만/);
    expect(d.paymentCategories.some((c) => c.name === "회식비")).toBe(false);
  });

  it("관리자는 분류를 만들고 ChangeLog(entityType=payment_category, via)가 남는다", () => {
    const d = db();
    const cat = d.createPaymentCategory({ actorId: "hwang-sunghyeon", via: "mcp" }, { name: "회식비" });
    expect(cat.status).toBe("active");
    // 새 분류는 표시 순서 맨 끝(max+1)에 붙는다
    const maxBefore = Math.max(...d.paymentCategories.filter((c) => c.id !== cat.id).map((c) => c.sortOrder));
    expect(cat.sortOrder).toBe(maxBefore + 1);
    const clog = d.changeLogs.at(-1)!;
    expect(clog.entityType).toBe("payment_category");
    expect(clog.changeType).toBe("create");
    expect(clog.via).toBe("mcp");
  });

  it("이름이 비었거나 50자를 넘으면 거부된다", () => {
    const d = db();
    expect(() =>
      d.createPaymentCategory({ actorId: "hwang-sunghyeon", via: "web" }, { name: "   " }),
    ).toThrowError(QueRuleError);
    expect(() =>
      d.createPaymentCategory({ actorId: "hwang-sunghyeon", via: "web" }, { name: "가".repeat(51) }),
    ).toThrowError(/50자/);
  });

  it("잘못된 status는 거부된다 (신뢰 못 할 인자 런타임 검증)", () => {
    const d = db();
    expect(() =>
      d.createPaymentCategory(
        { actorId: "hwang-sunghyeon", via: "web" },
        { name: "정상", status: "garbage" as never },
      ),
    ).toThrowError(QueRuleError);
  });

  it("비관리자는 분류를 수정할 수 없다", () => {
    const d = db();
    expect(() =>
      d.updatePaymentCategory(
        { actorId: "kim-riwon", via: "web" },
        { categoryId: "paycat-subscription", status: "archived" },
      ),
    ).toThrowError(/관리자만/);
    expect(d.paymentCategoryById("paycat-subscription")!.status).toBe("active");
  });

  it("관리자는 분류를 보관 처리하고 이름을 바꿀 수 있다", () => {
    const d = db();
    const updated = d.updatePaymentCategory(
      { actorId: "hwang-sunghyeon", via: "web" },
      { categoryId: "paycat-subscription", name: "정기구독", status: "archived" },
    );
    expect(updated.name).toBe("정기구독");
    expect(updated.status).toBe("archived");
    expect(d.changeLogs.at(-1)!.entityType).toBe("payment_category");
  });

  it("payment.category 문자열은 분류 수정과 무관하게 유지된다(하위호환)", () => {
    const d = db();
    const before = d.paymentRequests.find((p) => p.category === "구독")!.category;
    d.updatePaymentCategory(
      { actorId: "hwang-sunghyeon", via: "web" },
      { categoryId: "paycat-subscription", name: "정기구독" },
    );
    expect(d.paymentRequests.find((p) => p.id === "pay-stock-photo")!.category).toBe(before);
  });

  it("순서변경: orderedIds대로 sortOrder를 0..n-1로 재설정하고 ChangeLog(via)를 남긴다", () => {
    const d = db();
    const reversed = [...d.paymentCategories]
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((c) => c.id)
      .reverse();
    const result = d.reorderPaymentCategories({ actorId: "hwang-sunghyeon", via: "cli" }, { orderedIds: reversed });
    reversed.forEach((id, i) => {
      expect(d.paymentCategoryById(id)!.sortOrder).toBe(i);
      expect(result[i].id).toBe(id);
    });
    const clog = d.changeLogs.at(-1)!;
    expect(clog.entityType).toBe("payment_category");
    expect(clog.via).toBe("cli");
  });

  it("순서변경: 비관리자·미존재 id·중복은 거부하고 원본 순서를 보존한다", () => {
    const d = db();
    const snapshot = d.paymentCategories.map((c) => ({ id: c.id, sortOrder: c.sortOrder }));
    expect(() =>
      d.reorderPaymentCategories({ actorId: "kim-riwon", via: "web" }, { orderedIds: ["paycat-subscription"] }),
    ).toThrowError(/관리자만/);
    expect(() =>
      d.reorderPaymentCategories({ actorId: "hwang-sunghyeon", via: "web" }, { orderedIds: ["paycat-none"] }),
    ).toThrowError(/결제 분류 없음/);
    expect(() =>
      d.reorderPaymentCategories(
        { actorId: "hwang-sunghyeon", via: "web" },
        { orderedIds: ["paycat-subscription", "paycat-subscription"] },
      ),
    ).toThrowError(/중복/);
    for (const s of snapshot) expect(d.paymentCategoryById(s.id)!.sortOrder).toBe(s.sortOrder);
  });
});

describe("프로젝트 — 생성은 관리자, 수정은 관리자 또는 담당자", () => {
  it("clientOf는 프로젝트의 상위 클라이언트를 되돌린다", () => {
    const d = db();
    const summer = d.projects.find((p) => p.id === "prj-summer")!;
    expect(d.clientOf(summer)?.id).toBe("client-mendix");
  });

  it("비관리자도 프로젝트를 만들 수 있다 (2026-07-12 전원 허용 — 생성자 기본 담당)", () => {
    const d = db();
    const project = d.createProject({ actorId: "kim-riwon", via: "web" }, { name: "신규 프로젝트" });
    expect(project.ownerId).toBe("kim-riwon");
  });

  it("비관리자는 남의 프로젝트를 수정할 수 없다 (편집 권한은 유지)", () => {
    const d = db();
    const admin = d.users.find((u) => u.role === "admin")!;
    const project = d.createProject(
      { actorId: admin.id, via: "web" },
      { name: "관리자 프로젝트", ownerId: admin.id },
    );
    expect(() =>
      d.updateProject(
        { actorId: "kim-riwon", via: "web" },
        { projectId: project.id, name: "탈취 시도" },
      ),
    ).toThrowError(/NOT_AUTHORIZED|담당자|관리자/);
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

  it("description을 저장·수정하고 null로 제거할 수 있다", () => {
    const d = db();
    const created = d.createProject(
      { actorId: "hwang-sunghyeon", via: "web" },
      { name: "설명 프로젝트", description: "  프로젝트 개요  " },
    );
    expect(created.description).toBe("프로젝트 개요"); // trim
    const updated = d.updateProject(
      { actorId: "hwang-sunghyeon", via: "web" },
      { projectId: created.id, description: "새 개요" },
    );
    expect(updated.description).toBe("새 개요");
    const cleared = d.updateProject(
      { actorId: "hwang-sunghyeon", via: "web" },
      { projectId: created.id, description: null },
    );
    expect(cleared.description).toBeUndefined();
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

describe("비활성(deactivate) 사용자에게는 작업을 배정할 수 없다 — MCP/CLI/API 방어선", () => {
  it("createTask: 비활성 사용자를 담당자로 지정하면 ASSIGNEE_INACTIVE로 거부", () => {
    const d = db();
    // 담당자를 비활성으로 만든다(deactivateUser의 결과를 in-memory로 재현).
    // ⚠️ USERS 객체는 인스턴스 간 공유 참조라 직접 mutate하면 다른 테스트를 오염시킨다 → 클론으로 교체.
    d.users = d.users.map((u) => (u.id === "lee-yejin" ? { ...u, active: false } : u));
    try {
      d.createTask(
        { actorId: "hwang-sunghyeon", via: "mcp" },
        { title: "비활성에게 배정 시도", assigneeId: "lee-yejin", source: "manual" },
      );
      throw new Error("거부되지 않았다");
    } catch (error) {
      expect(isQueRuleError(error)).toBe(true);
      expect((error as QueRuleError).code).toBe("ASSIGNEE_INACTIVE");
    }
    // 작업이 실제로 생성되지 않았다.
    expect(d.tasks.some((t) => t.title === "비활성에게 배정 시도")).toBe(false);
  });

  it("reassignTask: 비활성 사용자로 재배정하면 ASSIGNEE_INACTIVE로 거부", () => {
    const d = db();
    // 공유 참조 mutate 금지 — 클론으로 교체(위 참조).
    d.users = d.users.map((u) => (u.id === "song-suyong" ? { ...u, active: false } : u));
    try {
      d.reassignTask(
        { actorId: "hwang-sunghyeon", via: "cli" },
        { taskId: "task-landing-copy", assigneeId: "song-suyong" },
      );
      throw new Error("거부되지 않았다");
    } catch (error) {
      expect(isQueRuleError(error)).toBe(true);
      expect((error as QueRuleError).code).toBe("ASSIGNEE_INACTIVE");
    }
    // 담당자는 그대로다.
    expect(d.tasks.find((t) => t.id === "task-landing-copy")!.assigneeId).toBe("hwang-sunghyeon");
  });
});

describe("작업 담당자 변경 (reassignTask)", () => {
  it("권한 없는 팀원은 담당자를 바꿀 수 없다", () => {
    const d = db();
    // task-landing-copy는 황성현 소유. 팀원 이혜진이 재배정 시도.
    expect(() =>
      d.reassignTask({ actorId: "lee-hyejin", via: "web" }, {
        taskId: "task-landing-copy",
        assigneeId: "lee-yejin",
      }),
    ).toThrowError(/수정할 수 없다/);
  });

  it("현재 담당자와 동일하면 no-op으로 거부된다", () => {
    const d = db();
    expect(() =>
      d.reassignTask({ actorId: "hwang-sunghyeon", via: "web" }, {
        taskId: "task-landing-copy",
        assigneeId: "hwang-sunghyeon",
      }),
    ).toThrowError(/이미 이 담당자/);
  });

  it("존재하지 않는 사용자로는 재배정할 수 없다", () => {
    const d = db();
    expect(() =>
      d.reassignTask({ actorId: "hwang-sunghyeon", via: "web" }, {
        taskId: "task-landing-copy",
        assigneeId: "ghost",
      }),
    ).toThrowError(QueRuleError);
  });

  it("담당자를 바꾸면 미응답 체크인이 새 담당자로 이관되고 ChangeLog가 남는다", () => {
    const d = db();
    // task-detail-qa: 담당 황성현, 미응답 체크인 chk-detail-qa(담당 황성현)
    const task = d.reassignTask({ actorId: "hwang-sunghyeon", via: "mcp" }, {
      taskId: "task-detail-qa",
      assigneeId: "song-suyong",
    });
    expect(task.assigneeId).toBe("song-suyong");
    // 미응답 체크인이 새 담당자로 이관된다
    const chk = d.checkIns.find((c) => c.id === "chk-detail-qa")!;
    expect(chk.assigneeId).toBe("song-suyong");
    // ChangeLog: 담당 이전이 via와 함께 기록된다
    const clog = d.changeLogs.at(-1)!;
    expect(clog.entityType).toBe("task");
    expect(clog.changeType).toBe("update");
    expect(clog.via).toBe("mcp");
    expect(clog.beforeValue).toContain("담당");
    expect(clog.afterValue).toContain("송수용");
  });

  it("응답 완료된 체크인은 이관하지 않는다 (이력 보존)", () => {
    const d = db();
    // chk-stock-check는 이미 응답됨(담당 송수용). task-stock-check를 관리자가 재배정.
    d.reassignTask({ actorId: "hwang-sunghyeon", via: "web" }, {
      taskId: "task-stock-check",
      assigneeId: "lee-yejin",
    });
    const chk = d.checkIns.find((c) => c.id === "chk-stock-check")!;
    expect(chk.assigneeId).toBe("song-suyong"); // 그대로
  });
});

describe("작업 취소 soft delete (cancelTask)", () => {
  it("권한 없는 팀원은 취소할 수 없다", () => {
    const d = db();
    expect(() =>
      d.cancelTask({ actorId: "lee-hyejin", via: "web" }, { taskId: "task-landing-copy" }),
    ).toThrowError(/수정할 수 없다/);
  });

  it("이미 취소된 작업은 no-op으로 거부된다", () => {
    const d = db();
    // task-old-copy는 시드에서 이미 cancelled.
    expect(() =>
      d.cancelTask({ actorId: "hwang-sunghyeon", via: "web" }, { taskId: "task-old-copy" }),
    ).toThrowError(/이미 취소/);
  });

  it("취소하면 status=cancelled, 이전 status 반환, StatusLog·ChangeLog 기록", () => {
    const d = db();
    const before = d.tasks.find((t) => t.id === "task-landing-copy")!.status; // in_progress
    const { task, previousStatus } = d.cancelTask(
      { actorId: "hwang-sunghyeon", via: "cli" },
      { taskId: "task-landing-copy", reason: "요구사항 철회" },
    );
    expect(task.status).toBe("cancelled");
    expect(previousStatus).toBe(before);
    // StatusLog(다른 상태 변경과 동일)
    const slog = d.statusLogs.filter((l) => l.taskId === "task-landing-copy").at(-1)!;
    expect(slog.toStatus).toBe("cancelled");
    expect(slog.reason).toBe("요구사항 철회");
    // ChangeLog via 기록
    const clog = d.changeLogs.at(-1)!;
    expect(clog.changeType).toBe("status_change");
    expect(clog.afterValue).toBe("cancelled");
    expect(clog.via).toBe("cli");
  });

  it("취소는 되돌릴 수 있다 (cancelled → 다른 상태 복구)", () => {
    const d = db();
    const { previousStatus } = d.cancelTask(
      { actorId: "hwang-sunghyeon", via: "web" },
      { taskId: "task-landing-copy" },
    );
    const restored = d.changeTaskStatus(
      { actorId: "hwang-sunghyeon", via: "web" },
      { taskId: "task-landing-copy", to: previousStatus },
    );
    expect(restored.status).toBe(previousStatus);
  });

  it("issue 작업을 취소하면 detail을 반환하고, 그 detail로 issue 복구가 성공한다", () => {
    const d = db();
    // 먼저 task-detail-qa를 issue로 만들며 detail을 남긴다.
    d.changeTaskStatus(
      { actorId: "hwang-sunghyeon", via: "web" },
      {
        taskId: "task-detail-qa",
        to: "issue",
        detail: { reason: "디자인 확정 지연", nextAction: "PM 확인 요청" },
      },
    );
    // 취소하면 취소 직전 issue detail이 스냅샷으로 반환된다.
    const { previousStatus, previousStatusDetail } = d.cancelTask(
      { actorId: "hwang-sunghyeon", via: "web" },
      { taskId: "task-detail-qa" },
    );
    expect(previousStatus).toBe("issue");
    expect(previousStatusDetail?.reason).toBe("디자인 확정 지연");
    expect(previousStatusDetail?.nextAction).toBe("PM 확인 요청");
    // 그 detail을 실어 issue로 복구하면 STATUS_DETAIL_REQUIRED로 거부되지 않는다.
    const restored = d.changeTaskStatus(
      { actorId: "hwang-sunghyeon", via: "web" },
      { taskId: "task-detail-qa", to: previousStatus, detail: previousStatusDetail },
    );
    expect(restored.status).toBe("issue");
  });
});

describe("체크인 스누즈 (answerCheckIn snoozeUntil)", () => {
  // answerCheckIn의 now 소스는 실제 시계(this.clock 기본값)라 실 현재 시각 기준으로 만든다.
  const iso = (msFromNow: number) => new Date(Date.now() + msFromNow).toISOString();

  it("나중에 + 미래 스누즈는 저장되고 followUp이 남는다", () => {
    const d = db();
    const snoozeUntil = iso(60 * 60 * 1000); // +1h — Date.now()를 한 번만 평가해 밀리초 경계 flaky 제거
    const chk = d.answerCheckIn({ actorId: "hwang-sunghyeon", via: "web" }, {
      checkInId: "chk-detail-qa",
      response: "later",
      snoozeUntil,
    });
    expect(chk.response).toBe("later");
    expect(chk.followUpRequired).toBe(true);
    expect(chk.snoozeUntil).toBe(snoozeUntil);
  });

  it("과거 스누즈는 거부된다", () => {
    const d = db();
    expect(() =>
      d.answerCheckIn({ actorId: "hwang-sunghyeon", via: "web" }, {
        checkInId: "chk-detail-qa",
        response: "later",
        snoozeUntil: iso(-60 * 60 * 1000), // -1h
      }),
    ).toThrowError(/미래/);
  });

  it("48시간을 넘는 스누즈는 거부된다", () => {
    const d = db();
    expect(() =>
      d.answerCheckIn({ actorId: "hwang-sunghyeon", via: "web" }, {
        checkInId: "chk-detail-qa",
        response: "later",
        snoozeUntil: iso(49 * 60 * 60 * 1000), // +49h
      }),
    ).toThrowError(/48시간/);
  });

  it("나중에가 아닌 응답의 snoozeUntil은 무시된다", () => {
    const d = db();
    const chk = d.answerCheckIn({ actorId: "hwang-sunghyeon", via: "web" }, {
      checkInId: "chk-detail-qa",
      response: "working",
      snoozeUntil: iso(60 * 60 * 1000),
    });
    expect(chk.snoozeUntil).toBeUndefined();
  });

  it("definitive 응답으로 재응답하면 스누즈가 정리된다", () => {
    const d = db();
    d.answerCheckIn({ actorId: "hwang-sunghyeon", via: "web" }, {
      checkInId: "chk-detail-qa",
      response: "later",
      snoozeUntil: iso(60 * 60 * 1000),
    });
    const chk = d.answerCheckIn({ actorId: "hwang-sunghyeon", via: "web" }, {
      checkInId: "chk-detail-qa",
      response: "done",
    });
    expect(chk.snoozeUntil).toBeUndefined();
  });
});

describe("회의록 md에서 회의 일시 추출 (extractMeetingDateTime)", () => {
  const NOW_2026 = new Date("2026-07-06T09:00:00+09:00");

  it("ISO 날짜와 24시간 시각을 뽑는다", () => {
    const md = "# 주간 회의\n\n## 일시\n2026-07-06 14:00\n\n## 할 일\n- ...";
    const got = extractMeetingDateTime(md, NOW_2026);
    expect(got).toEqual({ dateTime: "2026-07-06T14:00", hasTime: true });
  });

  it("한국어 날짜와 오후 시각(반)을 뽑는다", () => {
    const md = "회의 일시: 2026년 7월 6일 오후 2시 반";
    const got = extractMeetingDateTime(md, NOW_2026);
    expect(got).toEqual({ dateTime: "2026-07-06T14:30", hasTime: true });
  });

  it("연도 없는 날짜는 now 연도를 쓰고 시각 없으면 10:00 기본(hasTime=false)", () => {
    const md = "## 회의록\n7월 6일 킥오프";
    const got = extractMeetingDateTime(md, NOW_2026);
    expect(got).toEqual({ dateTime: "2026-07-06T10:00", hasTime: false });
  });

  it("라벨 줄(일시)의 날짜를 본문 다른 날짜보다 우선한다", () => {
    const md = "만료: 2025-01-01\n일시: 2026-07-06 09:30\n메모: 2024-12-31";
    const got = extractMeetingDateTime(md, NOW_2026);
    expect(got).toEqual({ dateTime: "2026-07-06T09:30", hasTime: true });
  });

  it("날짜가 없으면 undefined(폼 기본값 유지)", () => {
    expect(extractMeetingDateTime("# 제목만 있는 회의록\n\n- 할 일", NOW_2026)).toBeUndefined();
  });
});

describe("회의록 다중 프로젝트 (createMeetingNote projectIds)", () => {
  it("여러 프로젝트를 배열로 저장하고 대표값(projectId)은 첫 항목으로 맞춘다", () => {
    const d = db();
    const note = d.createMeetingNote(
      { actorId: "hwang-sunghyeon", via: "web" },
      {
        title: "주간 전체 회의",
        projectIds: ["prj-summer", "prj-payment"],
        meetingAt: NOW.toISOString(),
        attendeeIds: [],
        fileName: "주간.md",
        markdownBody: "# 주간",
      },
    );
    expect(note.projectIds).toEqual(["prj-summer", "prj-payment"]);
    expect(note.projectId).toBe("prj-summer");
  });

  it("단일 projectId만 오면 projectIds에도 반영된다(하위호환)", () => {
    const d = db();
    const note = d.createMeetingNote(
      { actorId: "hwang-sunghyeon", via: "web" },
      {
        title: "결제 회의",
        projectId: "prj-payment",
        meetingAt: NOW.toISOString(),
        attendeeIds: [],
        fileName: "결제.md",
        markdownBody: "# 결제",
      },
    );
    expect(note.projectId).toBe("prj-payment");
    expect(note.projectIds).toEqual(["prj-payment"]);
  });

  it("존재하지 않는 프로젝트는 거부한다", () => {
    const d = db();
    expect(() =>
      d.createMeetingNote(
        { actorId: "hwang-sunghyeon", via: "web" },
        {
          title: "회의",
          projectIds: ["prj-summer", "prj-ghost"],
          meetingAt: NOW.toISOString(),
          attendeeIds: [],
          fileName: "x.md",
          markdownBody: "# x",
        },
      ),
    ).toThrowError(/프로젝트 없음/);
  });
});

describe("Action 확정 override (담당자·프로젝트·날짜·시간)", () => {
  it("마감일 없는 후보도 confirm 시 dueAt override로 확정되고 시간 블록을 반영한다", () => {
    const d = db();
    // act-banner-copy: needs_review, 담당자(리원) 있음, dueAt 없음 → 그냥 confirm은 거부
    expect(() =>
      d.confirmActionItem({ actorId: "kim-riwon", via: "web" }, "act-banner-copy"),
    ).toThrowError(/담당자 또는 마감일/);

    const task = d.confirmActionItem({ actorId: "kim-riwon", via: "web" }, "act-banner-copy", {
      dueAt: "2026-07-10T18:00:00+09:00",
      startAt: "2026-07-10T15:00:00+09:00",
      endAt: "2026-07-10T18:00:00+09:00",
    });
    expect(task.assigneeId).toBe("kim-riwon");
    expect(new Date(task.startAt!).toISOString()).toBe("2026-07-10T06:00:00.000Z");
    expect(new Date(task.endAt!).toISOString()).toBe("2026-07-10T09:00:00.000Z");
    const item = d.actionItems.find((a) => a.id === "act-banner-copy")!;
    expect(item.status).toBe("created");
  });

  it("confirm override로 담당자·프로젝트를 함께 지정할 수 있다", () => {
    const d = db();
    // act-refund-copy: needs_review, dueAt 있음, 담당자 없음
    const task = d.confirmActionItem({ actorId: "hwang-sunghyeon", via: "web" }, "act-refund-copy", {
      assigneeId: "oh-seunghoon",
      projectId: "prj-cs",
    });
    expect(task.assigneeId).toBe("oh-seunghoon");
    expect(task.projectId).toBe("prj-cs");
  });

  it("override의 유령 프로젝트는 거부한다", () => {
    const d = db();
    expect(() =>
      d.confirmActionItem({ actorId: "hwang-sunghyeon", via: "web" }, "act-refund-copy", {
        assigneeId: "oh-seunghoon",
        projectId: "prj-ghost",
      }),
    ).toThrowError(/프로젝트 없음/);
  });
});

describe("수정사항(이슈/피드백) 트래커 — 팀 공용, 누구나 작성·상태 변경", () => {
  it("누구나(비관리자도) 수정사항을 등록하고 기본 상태는 미해결이다", () => {
    const d = db();
    const note = d.createRevisionNote(
      { actorId: "kim-riwon", via: "web" },
      { menu: "일정", location: "주간 뷰 헤더", description: "날짜 이동 시 오늘 표시가 사라진다" },
    );
    expect(note.status).toBe("unresolved");
    expect(note.authorId).toBe("kim-riwon");
    expect(note.updatedAt).toBeUndefined();
    expect(d.revisionNotes.some((n) => n.id === note.id)).toBe(true);
  });

  it("업무 데이터가 아니라 ChangeLog는 남기지 않는다", () => {
    const d = db();
    const before = d.changeLogs.length;
    d.createRevisionNote(
      { actorId: "hwang-sunghyeon", via: "mcp" },
      { menu: "결제요청", description: "금액 입력 커서 튕김" },
    );
    expect(d.changeLogs.length).toBe(before);
  });

  it("오류사항(description)이 비었거나 상한을 넘으면 거부한다", () => {
    const d = db();
    expect(() =>
      d.createRevisionNote({ actorId: "kim-riwon", via: "web" }, { menu: "일정", description: "   " }),
    ).toThrowError(QueRuleError);
    expect(() =>
      d.createRevisionNote(
        { actorId: "kim-riwon", via: "web" },
        { menu: "일정", description: "가".repeat(2001) },
      ),
    ).toThrowError(/2000자/);
    expect(() =>
      d.createRevisionNote(
        { actorId: "kim-riwon", via: "web" },
        { menu: "가".repeat(101), description: "정상 내용" },
      ),
    ).toThrowError(/100자/);
  });

  it("작성자가 아닌 다른 팀원도 상태를 바꿀 수 있다(팀 공용) — updatedAt/updatedBy 추적", () => {
    const d = db();
    const note = d.createRevisionNote(
      { actorId: "oh-seunghoon", via: "web" },
      { menu: "팀 현황", description: "리포트 합계가 맞지 않는다" },
    );
    const updated = d.updateRevisionNoteStatus(
      { actorId: "kim-riwon", via: "web" },
      { id: note.id, status: "resolved" },
    );
    expect(updated.status).toBe("resolved");
    expect(updated.updatedBy).toBe("kim-riwon");
    expect(updated.updatedAt).toBeDefined();
  });

  it("없는 수정사항이나 잘못된 상태는 거부한다", () => {
    const d = db();
    expect(() =>
      d.updateRevisionNoteStatus({ actorId: "kim-riwon", via: "web" }, { id: "rev-ghost", status: "hold" }),
    ).toThrowError(/수정사항 없음/);
    const note = d.createRevisionNote(
      { actorId: "kim-riwon", via: "web" },
      { menu: "일정", description: "정상 내용" },
    );
    expect(() =>
      d.updateRevisionNoteStatus(
        { actorId: "kim-riwon", via: "web" },
        { id: note.id, status: "garbage" as never },
      ),
    ).toThrowError(QueRuleError);
  });
});

describe("setTaskPredecessors — 선행 작업(의존성, E-9) 규칙", () => {
  // 시드: prj-summer에 task-landing-copy(황성현)·task-ad-review(오승훈)·task-detail-qa(황성현)·
  // task-banner-design(김리원). task-weekly-report는 프로젝트 없음. task-payment-qa는 prj-payment.
  const ADMIN = { actorId: "hwang-sunghyeon", via: "web" as const };

  it("정상 연결: 전체 교체 시맨틱 + ChangeLog(via) 기록", () => {
    const d = db();
    const task = d.setTaskPredecessors(ADMIN, {
      taskId: "task-detail-qa",
      predecessorIds: ["task-landing-copy", "task-ad-review"],
    });
    expect(task.predecessorIds).toEqual(["task-landing-copy", "task-ad-review"]);
    const log = d.changeLogs.at(-1)!;
    expect(log.entityId).toBe("task-detail-qa");
    expect(log.via).toBe("web");
    expect(log.afterValue).toContain("선행 작업:");
    // 빈 배열 = 전부 해제(필드 제거)
    const cleared = d.setTaskPredecessors(ADMIN, { taskId: "task-detail-qa", predecessorIds: [] });
    expect(cleared.predecessorIds).toBeUndefined();
  });

  it("자기 자신을 선행으로 연결할 수 없다", () => {
    expect(() =>
      db().setTaskPredecessors(ADMIN, {
        taskId: "task-detail-qa",
        predecessorIds: ["task-detail-qa"],
      }),
    ).toThrowError(/자기 자신/);
  });

  it("다른 프로젝트 작업은 선행으로 연결할 수 없다", () => {
    expect(() =>
      db().setTaskPredecessors(ADMIN, {
        taskId: "task-detail-qa",
        predecessorIds: ["task-payment-qa"], // prj-payment 소속
      }),
    ).toThrowError(/같은 프로젝트/);
  });

  it("프로젝트 없는 작업에는 선행을 연결할 수 없다", () => {
    expect(() =>
      db().setTaskPredecessors(ADMIN, {
        taskId: "task-weekly-report", // projectId 없음
        predecessorIds: ["task-landing-copy"],
      }),
    ).toThrowError(/프로젝트에 속한 작업만/);
  });

  it("직접 순환(A→B, B→A)을 거부한다", () => {
    const d = db();
    d.setTaskPredecessors(ADMIN, {
      taskId: "task-detail-qa",
      predecessorIds: ["task-landing-copy"],
    });
    expect(() =>
      d.setTaskPredecessors(ADMIN, {
        taskId: "task-landing-copy",
        predecessorIds: ["task-detail-qa"],
      }),
    ).toThrowError(/순환/);
  });

  it("간접 순환(A→B→C, C→A)도 거부한다", () => {
    const d = db();
    d.setTaskPredecessors(ADMIN, {
      taskId: "task-ad-review",
      predecessorIds: ["task-landing-copy"], // B→A
    });
    d.setTaskPredecessors(ADMIN, {
      taskId: "task-detail-qa",
      predecessorIds: ["task-ad-review"], // C→B
    });
    expect(() =>
      d.setTaskPredecessors(ADMIN, {
        taskId: "task-landing-copy",
        predecessorIds: ["task-detail-qa"], // A→C = 순환
      }),
    ).toThrowError(/순환/);
  });

  it("취소된 작업은 선행으로 연결할 수 없다", () => {
    const d = db();
    d.cancelTask(ADMIN, { taskId: "task-landing-copy" });
    expect(() =>
      d.setTaskPredecessors(ADMIN, {
        taskId: "task-detail-qa",
        predecessorIds: ["task-landing-copy"],
      }),
    ).toThrowError(/취소·병합/);
  });

  it("권한: 무관한 팀원은 타인 작업의 선행을 바꿀 수 없다(canEditTask 재사용)", () => {
    expect(() =>
      db().setTaskPredecessors(
        { actorId: "lee-hyejin", via: "web" }, // member, 담당·소유·프로젝트 오너 아님
        { taskId: "task-detail-qa", predecessorIds: ["task-landing-copy"] },
      ),
    ).toThrowError(QueRuleError);
  });

  it("중복 id는 제거되고 무변경 재호출은 로그를 남기지 않는다", () => {
    const d = db();
    d.setTaskPredecessors(ADMIN, {
      taskId: "task-detail-qa",
      predecessorIds: ["task-landing-copy", "task-landing-copy"],
    });
    expect(d.tasks.find((t) => t.id === "task-detail-qa")!.predecessorIds).toEqual([
      "task-landing-copy",
    ]);
    const logCount = d.changeLogs.length;
    d.setTaskPredecessors(ADMIN, {
      taskId: "task-detail-qa",
      predecessorIds: ["task-landing-copy"],
    });
    expect(d.changeLogs.length).toBe(logCount); // 무변경 — 로그 없음
  });
});

describe("선행 링크 수명주기(E-9) — 취소·병합·프로젝트 이동 시 자동 정리(데드락 방지)", () => {
  const ADMIN = { actorId: "hwang-sunghyeon", via: "web" as const };

  it("선행 작업을 취소하면 후행의 링크가 자동으로 풀리고, 이후 선행 편집이 막히지 않는다", () => {
    const d = db();
    d.setTaskPredecessors(ADMIN, {
      taskId: "task-detail-qa",
      predecessorIds: ["task-landing-copy"],
    });
    d.cancelTask(ADMIN, { taskId: "task-landing-copy" });
    const after = d.tasks.find((t) => t.id === "task-detail-qa")!;
    expect(after.predecessorIds).toBeUndefined(); // 링크 자동 해제
    // 정리 ChangeLog가 후행에 남는다
    expect(
      d.changeLogs.some(
        (l) => l.entityId === "task-detail-qa" && (l.afterValue ?? "").includes("해제"),
      ),
    ).toBe(true);
    // 데드락 없음 — 새 선행을 바로 연결할 수 있다
    const next = d.setTaskPredecessors(ADMIN, {
      taskId: "task-detail-qa",
      predecessorIds: ["task-ad-review"],
    });
    expect(next.predecessorIds).toEqual(["task-ad-review"]);
  });

  it("프로젝트를 옮기면 자기 선행과 자기를 선행으로 가진 링크가 모두 풀린다", () => {
    const d = db();
    d.setTaskPredecessors(ADMIN, {
      taskId: "task-detail-qa",
      predecessorIds: ["task-landing-copy"], // detail-qa ← landing-copy
    });
    d.setTaskPredecessors(ADMIN, {
      taskId: "task-ad-review",
      predecessorIds: ["task-detail-qa"], // ad-review ← detail-qa
    });
    // detail-qa를 다른 프로젝트로 이동 → 양방향 링크 정리
    d.updateTaskDetails(ADMIN, { taskId: "task-detail-qa", projectId: "prj-payment" });
    expect(d.tasks.find((t) => t.id === "task-detail-qa")!.predecessorIds).toBeUndefined();
    expect(d.tasks.find((t) => t.id === "task-ad-review")!.predecessorIds).toBeUndefined();
  });

  it("grandfather: 잔재(취소된 선행)가 남아 있어도 기존 연결의 유지·해제는 가능하다", () => {
    const d = db();
    // 비정상 잔재를 강제 주입(정리 훅을 우회한 과거 데이터 시뮬레이션)
    const task = d.tasks.find((t) => t.id === "task-detail-qa")!;
    d.cancelTask(ADMIN, { taskId: "task-landing-copy" });
    task.predecessorIds = ["task-landing-copy"]; // 취소된 작업이 선행으로 잔존
    // 유지한 채 다른 선행 추가 — 신규분만 검증하므로 통과해야 한다
    const kept = d.setTaskPredecessors(ADMIN, {
      taskId: "task-detail-qa",
      predecessorIds: ["task-landing-copy", "task-ad-review"],
    });
    expect(kept.predecessorIds).toEqual(["task-landing-copy", "task-ad-review"]);
    // 전체 해제도 가능
    const cleared = d.setTaskPredecessors(ADMIN, { taskId: "task-detail-qa", predecessorIds: [] });
    expect(cleared.predecessorIds).toBeUndefined();
  });
});
