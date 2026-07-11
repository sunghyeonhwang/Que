import { describe, expect, it } from "vitest";
import { MockQueDb, createMockDb } from "./data/mock-db";
import { QueRuleError } from "./rules";
import { standupTeamSummarySchema } from "./domain";

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

describe("standupTeamSummary — AI 팀 요약(저장 관례의 의도적 예외)", () => {
  it("saveStandupTeamSummary + standupTeamSummaryByDate — 생성·조회, 스키마 정합", () => {
    const db = createMockDb(NOW);
    expect(db.standupTeamSummaryByDate(TODAY)).toBeUndefined(); // 시드엔 없다(크론 생성)

    const saved = db.saveStandupTeamSummary({
      date: TODAY,
      model: "pro",
      content: "[막힘 클러스터] 없음\n[어제→오늘 흐름] 순항\n[추천 액션] 1. ...",
      submittedUserIds: ["hwang-sunghyeon", "oh-seunghoon"],
    });
    expect(saved.date).toBe(TODAY);
    expect(saved.model).toBe("pro");
    expect(Number.isNaN(Date.parse(saved.generatedAt))).toBe(false); // 유효 ISO
    // 저장된 객체가 도메인 스키마를 만족한다(파생·필드 정합).
    expect(() => standupTeamSummarySchema.parse(saved)).not.toThrow();

    const fetched = db.standupTeamSummaryByDate(TODAY);
    expect(fetched?.id).toBe(saved.id);
    expect(fetched?.submittedUserIds).toEqual(["hwang-sunghyeon", "oh-seunghoon"]);
  });

  it("date 유니크 — 재생성은 같은 행 덮어쓰기(새 행 없이 content·generatedAt·regeneratedBy 갱신)", () => {
    let clock = new Date("2026-07-02T11:00:00+09:00");
    const db = new MockQueDb(NOW, () => clock);
    const before = db.standupTeamSummaries.length;

    const first = db.saveStandupTeamSummary({
      date: TODAY,
      model: "pro",
      content: "최초 요약",
      submittedUserIds: ["hwang-sunghyeon"],
    });
    const firstId = first.id;
    const firstGeneratedAt = first.generatedAt; // 덮어쓰기는 같은 객체를 mutate하므로 값을 미리 캡처

    clock = new Date("2026-07-02T11:30:00+09:00");
    const second = db.saveStandupTeamSummary({
      date: TODAY,
      model: "flash",
      content: "재생성 요약",
      submittedUserIds: ["hwang-sunghyeon", "oh-seunghoon"],
      regeneratedBy: "hwang-sunghyeon",
    });

    expect(db.standupTeamSummaries.length).toBe(before + 1); // 1건만(덮어쓰기)
    expect(second.id).toBe(firstId);
    expect(second.content).toBe("재생성 요약");
    expect(second.model).toBe("flash");
    expect(second.regeneratedBy).toBe("hwang-sunghyeon");
    expect(second.generatedAt).not.toBe(firstGeneratedAt); // 재생성 시각 갱신
  });

  it("스키마 — model은 flash|pro만 허용(그 외 거부), content 필수", () => {
    const base = {
      id: "stsum-1",
      date: TODAY,
      generatedAt: NOW.toISOString(),
      content: "요약",
      submittedUserIds: [],
    };
    expect(() => standupTeamSummarySchema.parse({ ...base, model: "pro" })).not.toThrow();
    expect(() => standupTeamSummarySchema.parse({ ...base, model: "gpt" })).toThrow();
    expect(() => standupTeamSummarySchema.parse({ ...base, model: "flash", content: "" })).toThrow();
  });
});
