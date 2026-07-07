import { describe, expect, it } from "vitest";
import {
  buildDeadlineIntents,
  buildStatusChangeIntents,
  dedupKeyFor,
  messageFor,
  type NotificationContext,
} from "./notifications";
import type { Task, TaskStatus } from "./domain";

// "보내지 않는 알림" 규칙이 실제로 intent 0건인지, dedupKey 유일성, issue/hold가 intent를
// 생성하는지 — Slack 발송의 게이트가 core에서 강제됨을 검증한다(웹/MCP/CLI 공유).

const NOW = new Date("2026-07-07T09:00:00+09:00");

const ctx: NotificationContext = {
  now: NOW,
  nameOf: (id) => ({ "u-1": "박승환", "u-2": "이예진", "u-3": "김리원" })[id] ?? id,
};

function makeTask(overrides: Partial<Task> = {}): Task {
  return {
    id: "task-1",
    title: "랜딩 페이지 QA",
    ownerId: "u-1",
    assigneeId: "u-1",
    status: "in_progress",
    priority: "normal",
    source: "manual",
    visibility: "team",
    lastChangedAt: "2026-07-07T00:00:00.000Z",
    ...overrides,
  };
}

describe("buildStatusChangeIntents — issue/on_hold만 통과", () => {
  it("issue 전환은 intent 1건(red, 담당·사유·도움요청 이름 포함)", () => {
    const task = makeTask({ status: "issue" });
    const intents = buildStatusChangeIntents(ctx, task, "in_progress", "issue", {
      reason: "디자인 확인 대기",
      helpUserIds: ["u-2", "u-3"],
    });
    expect(intents).toHaveLength(1);
    const [intent] = intents;
    expect(intent.kind).toBe("issue");
    expect(intent.payload.tone).toBe("red");
    expect(intent.payload.title).toBe("문제 발생");
    expect(intent.payload.text).toContain("담당 박승환");
    expect(intent.payload.text).toContain("사유 디자인 확인 대기");
    expect(intent.payload.text).toContain("도움요청 이예진, 김리원");
  });

  it("on_hold 전환은 intent 1건(amber)", () => {
    const task = makeTask({ status: "on_hold" });
    const intents = buildStatusChangeIntents(ctx, task, "in_progress", "on_hold", {
      reason: "예산 승인 대기",
    });
    expect(intents).toHaveLength(1);
    expect(intents[0].kind).toBe("on_hold");
    expect(intents[0].payload.tone).toBe("amber");
  });

  it("done/cancelled/merged 전환은 intent 0건", () => {
    for (const to of ["done", "cancelled", "merged"] as TaskStatus[]) {
      const intents = buildStatusChangeIntents(ctx, makeTask({ status: to }), "in_progress", to);
      expect(intents, `${to}는 알림 대상이 아니다`).toHaveLength(0);
    }
  });

  it("같은 상태 재진입(from===to)은 intent 0건", () => {
    const intents = buildStatusChangeIntents(ctx, makeTask({ status: "issue" }), "issue", "issue", {
      reason: "여전히 막힘",
    });
    expect(intents).toHaveLength(0);
  });
});

describe("dedupKeyFor — 이벤트 유일키", () => {
  it("같은 전이(같은 marker)는 같은 키 → 중복 발송 차단", () => {
    const task = makeTask({ status: "issue" });
    const a = buildStatusChangeIntents(ctx, task, "in_progress", "issue", { reason: "x" })[0];
    const b = buildStatusChangeIntents(ctx, task, "in_progress", "issue", { reason: "x" })[0];
    expect(dedupKeyFor(a)).toBe(dedupKeyFor(b));
  });

  it("서로 다른 작업/종류/버킷은 다른 키", () => {
    const issue = buildStatusChangeIntents(ctx, makeTask({ status: "issue" }), "in_progress", "issue", {
      reason: "x",
    })[0];
    const hold = buildStatusChangeIntents(
      ctx,
      makeTask({ id: "task-2", status: "on_hold" }),
      "in_progress",
      "on_hold",
      { reason: "y" },
    )[0];
    const keys = new Set([dedupKeyFor(issue), dedupKeyFor(hold)]);
    expect(keys.size).toBe(2);
    expect(dedupKeyFor(issue)).toBe(`issue:task-1:${issue.marker}`);
  });
});

describe("buildDeadlineIntents — 열린 상태 + 임박만", () => {
  const thresholdH = 24;

  it("임박(24h 이내) 열린 작업은 intent 1건, dedup은 마감일 버킷", () => {
    const task = makeTask({ status: "in_progress", endAt: "2026-07-07T18:00:00+09:00" });
    const intents = buildDeadlineIntents(ctx, [task], thresholdH);
    expect(intents).toHaveLength(1);
    expect(intents[0].kind).toBe("deadline");
    expect(intents[0].payload.tone).toBe("amber");
    expect(dedupKeyFor(intents[0])).toBe("deadline:task-1:2026-07-07");
  });

  it("overdue(마감 이미 지남)는 intent 0건", () => {
    const task = makeTask({ status: "in_progress", endAt: "2026-07-07T08:00:00+09:00" });
    expect(buildDeadlineIntents(ctx, [task], thresholdH)).toHaveLength(0);
  });

  it("완료/취소/병합 작업은 intent 0건(임박이어도)", () => {
    for (const status of ["done", "cancelled", "merged"] as TaskStatus[]) {
      const task = makeTask({ status, endAt: "2026-07-07T18:00:00+09:00" });
      expect(buildDeadlineIntents(ctx, [task], thresholdH), status).toHaveLength(0);
    }
  });

  it("임계(24h) 밖 마감은 intent 0건", () => {
    const task = makeTask({ status: "in_progress", endAt: "2026-07-09T18:00:00+09:00" });
    expect(buildDeadlineIntents(ctx, [task], thresholdH)).toHaveLength(0);
  });
});

describe("messageFor", () => {
  it("제목·본문·톤·딥링크를 Slack 메시지로 변환", () => {
    const msg = messageFor({
      payload: { title: "문제 발생", text: "작업 · 담당 박승환", deeplinkPath: "/now", tone: "red" },
    });
    expect(msg.text).toContain("*문제 발생*");
    expect(msg.text).toContain("작업 · 담당 박승환");
    expect(msg.deeplinkPath).toBe("/now");
    expect(msg.tone).toBe("red");
  });
});
