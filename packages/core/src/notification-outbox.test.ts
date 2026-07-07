import { describe, expect, it } from "vitest";
import { createMockDb } from "./data/mock-db";
import type { NotificationIntent } from "./notifications";

// 아웃박스 원장(enqueue dedup·held 보류·releaseHeldNotifications 드레인·mark 전이)을 검증한다.
// dispatch(web)가 이 원장 위에서 방해금지 hold와 재시도를 배선하므로, 원장 계약을 여기서 못박는다.

const NOW = new Date("2026-07-07T13:00:00+09:00");

function intent(over: Partial<NotificationIntent> = {}): NotificationIntent {
  return {
    kind: "issue",
    entityType: "task",
    entityId: "task-1",
    marker: "2026-07-07T04:00:00.000Z",
    payload: { title: "문제 발생", text: "x", deeplinkPath: "/now", tone: "red" },
    ...over,
  };
}

describe("enqueueNotifications — dedup DO NOTHING", () => {
  it("같은 dedup_key는 한 번만 적재된다", () => {
    const db = createMockDb(NOW);
    const first = db.enqueueNotifications([intent()]);
    const second = db.enqueueNotifications([intent()]); // 같은 kind:entityId:marker
    expect(first).toHaveLength(1);
    expect(second).toHaveLength(0); // 이미 있음 → 무시
    expect(db.notificationOutbox).toHaveLength(1);
  });

  it("holdUntil을 주면 held로, 없으면 pending으로 적재된다", () => {
    const db = createMockDb(NOW);
    db.enqueueNotifications([intent()]);
    db.enqueueNotifications([intent({ entityId: "task-2", marker: "m2" })], {
      holdUntil: "2026-07-08T08:00:00+09:00",
    });
    expect(db.pendingNotifications()).toHaveLength(1);
    expect(db.heldNotifications()).toHaveLength(1);
    expect(db.heldNotifications()[0].holdUntil).toBe("2026-07-08T08:00:00+09:00");
  });
});

describe("enqueueNotifications — recipient · personal_digest", () => {
  it("intent.recipient(Que userId)를 아웃박스 행에 적재한다", () => {
    const db = createMockDb(NOW);
    const [entry] = db.enqueueNotifications([
      intent({
        kind: "personal_digest",
        entityType: "user",
        entityId: "lee-yejin",
        marker: "2026-07-07",
        recipient: "lee-yejin",
        payload: { title: "브리핑", text: "y", deeplinkPath: "/today", tone: "blue" },
      }),
    ]);
    expect(entry.recipient).toBe("lee-yejin");
    expect(entry.kind).toBe("personal_digest");
  });

  it("recipient 없는 팀채널 계열은 recipient가 undefined다", () => {
    const db = createMockDb(NOW);
    const [entry] = db.enqueueNotifications([intent()]);
    expect(entry.recipient).toBeUndefined();
  });

  it("personal_digest dedup_key는 kind:userId:date 형태로 유저·날짜당 1건이다", () => {
    const db = createMockDb(NOW);
    const make = (userId: string, date: string) =>
      intent({
        kind: "personal_digest",
        entityType: "user",
        entityId: userId,
        marker: date,
        recipient: userId,
      });
    const first = db.enqueueNotifications([make("lee-yejin", "2026-07-07")]);
    const dup = db.enqueueNotifications([make("lee-yejin", "2026-07-07")]); // 같은 유저·날짜
    const other = db.enqueueNotifications([make("kim-riwon", "2026-07-07")]); // 다른 유저
    expect(first[0].dedupKey).toBe("personal_digest:lee-yejin:2026-07-07");
    expect(dup).toHaveLength(0);
    expect(other).toHaveLength(1);
  });
});

describe("releaseHeldNotifications — 방해금지 창 종료분만 pending으로", () => {
  it("hold_until이 지난 held만 풀고 holdUntil을 지운다", () => {
    const db = createMockDb(NOW);
    db.enqueueNotifications([intent({ entityId: "past", marker: "p" })], {
      holdUntil: "2026-07-07T08:00:00+09:00", // NOW 이전 → 해제 대상
    });
    db.enqueueNotifications([intent({ entityId: "future", marker: "f" })], {
      holdUntil: "2026-07-08T08:00:00+09:00", // NOW 이후 → 유지
    });
    const released = db.releaseHeldNotifications(NOW);
    expect(released).toHaveLength(1);
    expect(released[0].entityId).toBe("past");
    expect(released[0].status).toBe("pending");
    expect(released[0].holdUntil).toBeUndefined();
    expect(db.heldNotifications()).toHaveLength(1); // future는 그대로 held
    expect(db.pendingNotifications().map((e) => e.entityId)).toContain("past");
  });

  it("경계(hold_until === now)는 해제한다(<= 판정)", () => {
    const db = createMockDb(NOW);
    db.enqueueNotifications([intent({ entityId: "edge", marker: "e" })], {
      holdUntil: NOW.toISOString(),
    });
    expect(db.releaseHeldNotifications(NOW)).toHaveLength(1);
  });
});

describe("mark 전이 — sent/failed(attempts)/skipped", () => {
  it("markNotificationSent → status=sent, sentAt 기록", () => {
    const db = createMockDb(NOW);
    const [e] = db.enqueueNotifications([intent()]);
    const sent = db.markNotificationSent(e.id);
    expect(sent.status).toBe("sent");
    expect(sent.sentAt).toBeTruthy();
    expect(db.pendingNotifications()).toHaveLength(0);
  });

  it("markFailed는 attempts를 증가시킨다(재시도 원장)", () => {
    const db = createMockDb(NOW);
    const [e] = db.enqueueNotifications([intent()]);
    expect(db.markFailed(e.id).attempts).toBe(1);
    expect(db.markFailed(e.id).attempts).toBe(2);
    expect(db.notificationOutbox[0].status).toBe("failed");
  });

  it("markSkipped → status=skipped", () => {
    const db = createMockDb(NOW);
    const [e] = db.enqueueNotifications([intent()]);
    expect(db.markSkipped(e.id).status).toBe("skipped");
  });
});
