import { describe, expect, it } from "vitest";
import { MockQueDb, createMockDb } from "./data/mock-db";
import { QueRuleError } from "./rules";

// 데일리 스탠드업 체크인(submitStandupEntry)의 도메인 규칙을 core 계층에서 검증한다.
// 규칙 출처: 데일리 스탠드업 기획 §2(데이터 모델)·§6(권한 — 생성/수정 본인만).

const NOW = new Date("2026-07-02T09:00:00+09:00");
const TODAY = "2026-07-02"; // 시드가 오늘(KST) 기준으로 만드는 날짜 키
const EMPTY_SNAPSHOT = { yesterdayDone: [], yesterdayUnfinished: [], todayPlanned: [] };

describe("submitStandupEntry — 데일리 스탠드업 비동기 체크인", () => {
  it("userId는 입력이 아니라 actor(세션)에서 온다 — 대리 제출 불가(본인만)", () => {
    const db = createMockDb(NOW);
    const entry = db.submitStandupEntry(
      { actorId: "park-seunghwan", via: "web" },
      { date: TODAY, focus: "QA 잔여 케이스 정리", snapshotTaskIds: EMPTY_SNAPSHOT },
    );
    expect(entry.userId).toBe("park-seunghwan");
    expect(entry.date).toBe(TODAY);
  });

  it("(date, userId) 재제출은 덮어쓰기 — 새 행 없이 updatedAt만 갱신, 최초 submittedAt 유지", () => {
    let clock = new Date("2026-07-02T09:00:00+09:00");
    const db = new MockQueDb(NOW, () => clock);
    const before = db.standupEntries.length;

    const first = db.submitStandupEntry(
      { actorId: "park-seunghwan", via: "web" },
      { date: TODAY, focus: "첫 포커스", snapshotTaskIds: EMPTY_SNAPSHOT },
    );
    const firstSubmittedAt = first.submittedAt;

    clock = new Date("2026-07-02T09:05:00+09:00");
    const second = db.submitStandupEntry(
      { actorId: "park-seunghwan", via: "web" },
      { date: TODAY, focus: "수정된 포커스", note: "부연 추가", snapshotTaskIds: EMPTY_SNAPSHOT },
    );

    expect(db.standupEntries.length).toBe(before + 1); // 1건만 추가(덮어쓰기)
    expect(second.id).toBe(first.id);
    expect(second.focus).toBe("수정된 포커스");
    expect(second.note).toBe("부연 추가");
    expect(second.submittedAt).toBe(firstSubmittedAt); // 최초 제출 시각 유지
    expect(second.updatedAt).not.toBe(firstSubmittedAt); // 갱신 시각은 달라짐
  });

  it("focus가 비면 거부한다(INVALID_INPUT)", () => {
    const db = createMockDb(NOW);
    expect(() =>
      db.submitStandupEntry(
        { actorId: "park-seunghwan", via: "web" },
        { date: TODAY, focus: "   ", snapshotTaskIds: EMPTY_SNAPSHOT },
      ),
    ).toThrow(QueRuleError);
  });

  it("존재하지 않는 actor는 거부한다(NOT_FOUND)", () => {
    const db = createMockDb(NOW);
    expect(() =>
      db.submitStandupEntry(
        { actorId: "ghost-user", via: "web" },
        { date: TODAY, focus: "무단 침입", snapshotTaskIds: EMPTY_SNAPSHOT },
      ),
    ).toThrow(QueRuleError);
  });

  it("standupEntriesByDate — 시드 데모 체크인 2건(오늘)을 돌려준다", () => {
    const db = createMockDb(NOW);
    const entries = db.standupEntriesByDate(TODAY);
    expect(entries.length).toBe(2);
    expect(entries.map((e) => e.userId).sort()).toEqual(["hwang-sunghyeon", "oh-seunghoon"]);
  });
});
