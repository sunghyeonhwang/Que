import { describe, expect, it } from "vitest";
import { MockQueDb, createMockDb } from "./data/mock-db";
import { QueRuleError } from "./rules";
import { keyResultProgress } from "./rules";

// OKR(분기 목표 + 월 핵심결과) 도메인 규칙을 core 계층에서 검증한다.
// 규칙 출처: 데일리 스탠드업/OKR 기획 §2(데이터 모델)·§6(권한)·§8-3(task_auto=Task 개수 기준).

const NOW = new Date("2026-07-02T09:00:00+09:00");
const PERIOD = "2026-Q3"; // 시드가 now 기준으로 만드는 분기 키
const MONTH = "2026-07";

const ADMIN = "oh-seunghoon"; // role: admin
const MEMBER = "park-seunghwan"; // role: member
const YEJIN = "lee-yejin"; // role: member — 시드 kr-cs-faq 소유자

describe("Objective — 생성/수정은 admin만(기획 §6)", () => {
  it("member는 Objective를 만들 수 없다(NOT_AUTHORIZED)", () => {
    const db = createMockDb(NOW);
    expect(() =>
      db.createObjective(
        { actorId: MEMBER, via: "web" },
        { title: "테스트 목표", period: PERIOD, ownerId: MEMBER },
      ),
    ).toThrow(QueRuleError);
  });

  it("admin은 Objective를 만든다 + ChangeLog(create) 기록", () => {
    const db = createMockDb(NOW);
    const before = db.changeLogs.length;
    const obj = db.createObjective(
      { actorId: ADMIN, via: "mcp" },
      { title: "4분기 대비 기반 다지기", period: PERIOD, ownerId: ADMIN },
    );
    expect(obj.status).toBe("active"); // 기본 active
    expect(obj.period).toBe(PERIOD);
    const log = db.changeLogs[db.changeLogs.length - 1];
    expect(db.changeLogs.length).toBe(before + 1);
    expect(log.entityType).toBe("objective");
    expect(log.changeType).toBe("create");
    expect(log.via).toBe("mcp");
  });

  it("잘못된 분기 형식(2026-Q3 아님)은 거부한다(INVALID_INPUT)", () => {
    const db = createMockDb(NOW);
    expect(() =>
      db.createObjective(
        { actorId: ADMIN, via: "web" },
        { title: "형식 오류", period: "2026-3", ownerId: ADMIN },
      ),
    ).toThrow(QueRuleError);
  });
});

describe("KeyResult — 생성 권한·manual 목표치 필수(기획 §2·§6)", () => {
  it("admin 아닌 Objective 소유자는 KR를 만들 수 있다", () => {
    const db = createMockDb(NOW);
    // admin이 member(yejin) 소유의 Objective를 만든다.
    const obj = db.createObjective(
      { actorId: ADMIN, via: "web" },
      { title: "예진 목표", period: PERIOD, ownerId: YEJIN },
    );
    // 소유자 yejin(member)이 그 목표에 KR를 만든다 — 허용.
    const kr = db.createKeyResult(
      { actorId: YEJIN, via: "web" },
      { objectiveId: obj.id, title: "FAQ 20건", ownerId: YEJIN, month: MONTH, metricType: "manual", targetValue: 20 },
    );
    expect(kr.objectiveId).toBe(obj.id);
    expect(kr.targetValue).toBe(20);
    expect(kr.currentValue).toBe(0); // manual 기본 0
  });

  it("Objective 소유자도 admin도 아니면 KR 생성 거부(NOT_AUTHORIZED)", () => {
    const db = createMockDb(NOW);
    // obj-summer 소유자는 hwang(admin), member는 소유자 아님.
    expect(() =>
      db.createKeyResult(
        { actorId: MEMBER, via: "web" },
        { objectiveId: "obj-summer", title: "무단 KR", ownerId: MEMBER, month: MONTH, metricType: "manual", targetValue: 10 },
      ),
    ).toThrow(QueRuleError);
  });

  it("manual KR은 targetValue가 없으면 거부한다(INVALID_INPUT)", () => {
    const db = createMockDb(NOW);
    expect(() =>
      db.createKeyResult(
        { actorId: ADMIN, via: "web" },
        { objectiveId: "obj-summer", title: "목표치 없음", ownerId: ADMIN, month: MONTH, metricType: "manual" },
      ),
    ).toThrow(QueRuleError);
  });

  it("task_auto KR은 targetValue 없이 만들 수 있다", () => {
    const db = createMockDb(NOW);
    const kr = db.createKeyResult(
      { actorId: ADMIN, via: "web" },
      { objectiveId: "obj-summer", title: "자동 집계 KR", ownerId: ADMIN, month: MONTH, metricType: "task_auto" },
    );
    expect(kr.metricType).toBe("task_auto");
    expect(kr.targetValue).toBeUndefined();
  });
});

describe("KR 진척 입력 — 소유자 본인 또는 admin만(기획 §6)", () => {
  it("소유자도 admin도 아니면 진척 입력 거부(NOT_AUTHORIZED)", () => {
    const db = createMockDb(NOW);
    // kr-cs-faq 소유자는 yejin. member(park)는 남의 KR 진척을 못 바꾼다.
    expect(() =>
      db.updateKeyResultProgress({ actorId: MEMBER, via: "web" }, { keyResultId: "kr-cs-faq", currentValue: 20 }),
    ).toThrow(QueRuleError);
  });

  it("소유자 본인은 진척을 입력한다 + ChangeLog(update) 기록", () => {
    const db = createMockDb(NOW);
    const before = db.changeLogs.length;
    const kr = db.updateKeyResultProgress(
      { actorId: YEJIN, via: "cli" },
      { keyResultId: "kr-cs-faq", currentValue: 20 },
    );
    expect(kr.currentValue).toBe(20);
    const log = db.changeLogs[db.changeLogs.length - 1];
    expect(db.changeLogs.length).toBe(before + 1);
    expect(log.entityType).toBe("key_result");
    expect(log.via).toBe("cli");
  });

  it("admin은 남의 KR 진척도 입력할 수 있다", () => {
    const db = createMockDb(NOW);
    const kr = db.updateKeyResultProgress(
      { actorId: ADMIN, via: "web" },
      { keyResultId: "kr-cs-faq", currentValue: 30 },
    );
    expect(kr.currentValue).toBe(30);
  });

  it("task_auto KR에는 진척을 직접 입력할 수 없다(INVALID_INPUT)", () => {
    const db = createMockDb(NOW);
    // kr-summer-tasks 소유자는 hwang(admin)이지만 metricType=task_auto라 직접 입력 불가.
    expect(() =>
      db.updateKeyResultProgress({ actorId: "hwang-sunghyeon", via: "web" }, { keyResultId: "kr-summer-tasks", currentValue: 5 }),
    ).toThrow(QueRuleError);
  });
});

describe("keyResultProgress — 하이브리드 진척 계산(기획 §2·§8-3)", () => {
  it("manual: round(current/target*100), 상한 100", () => {
    const db = createMockDb(NOW);
    const kr = db.keyResults.find((k) => k.id === "kr-payment-cases")!; // target 90, current 40
    expect(keyResultProgress(kr, db.tasks)).toBe(44); // round(44.44)

    // 목표를 초과 입력해도 100으로 상한.
    db.updateKeyResultProgress({ actorId: ADMIN, via: "web" }, { keyResultId: "kr-payment-cases", currentValue: 120 });
    const capped = db.keyResults.find((k) => k.id === "kr-payment-cases")!;
    expect(keyResultProgress(capped, db.tasks)).toBe(100);
  });

  it("task_auto: 연결 Task done 비율(취소·병합 제외)", () => {
    const db = createMockDb(NOW);
    const kr = db.keyResults.find((k) => k.id === "kr-summer-tasks")!;
    // 시드: task-landing-copy(in_progress) + task-detail-qa(scheduled) 연결 → done 0/2 = 0
    expect(keyResultProgress(kr, db.tasks)).toBe(0);

    // 하나를 완료로 바꾸면 1/2 = 50.
    const t = db.tasks.find((x) => x.id === "task-landing-copy")!;
    t.status = "done";
    expect(keyResultProgress(kr, db.tasks)).toBe(50);

    // 나머지를 취소하면 분모에서 빠져 1/1 = 100.
    const t2 = db.tasks.find((x) => x.id === "task-detail-qa")!;
    t2.status = "cancelled";
    expect(keyResultProgress(kr, db.tasks)).toBe(100);
  });

  it("task_auto: 연결 Task 0건이면 0", () => {
    const db = createMockDb(NOW);
    const kr = db.createKeyResult(
      { actorId: ADMIN, via: "web" },
      { objectiveId: "obj-summer", title: "미연결 KR", ownerId: ADMIN, month: MONTH, metricType: "task_auto" },
    );
    expect(keyResultProgress(kr, db.tasks)).toBe(0);
  });
});

describe("Task.keyResultId — 연결 + 실재 검증(기획 §2·§6)", () => {
  it("본인 작업에 실재 KR를 연결한다", () => {
    const db = createMockDb(NOW);
    // task-weekly-report 담당자=sungjin(본인). 연결 후 keyResultId 확인.
    const task = db.updateTaskDetails(
      { actorId: "hwang-sungjin", via: "web" },
      { taskId: "task-weekly-report", keyResultId: "kr-cs-faq" },
    );
    expect(task.keyResultId).toBe("kr-cs-faq");
    const log = db.changeLogs[db.changeLogs.length - 1];
    expect(log.entityType).toBe("task");
    expect(log.afterValue).toContain("KR:");
  });

  it("존재하지 않는 KR 연결은 거부한다(NOT_FOUND)", () => {
    const db = createMockDb(NOW);
    expect(() =>
      db.updateTaskDetails(
        { actorId: "hwang-sungjin", via: "web" },
        { taskId: "task-weekly-report", keyResultId: "kr-ghost" },
      ),
    ).toThrow(QueRuleError);
  });

  it("KR 연결 해제(null)는 검증 없이 통과한다", () => {
    const db = createMockDb(NOW);
    // task-landing-copy는 시드에서 kr-summer-tasks에 연결됨. 해제.
    const task = db.updateTaskDetails(
      { actorId: "hwang-sunghyeon", via: "web" },
      { taskId: "task-landing-copy", keyResultId: null },
    );
    expect(task.keyResultId).toBeUndefined();
  });
});

describe("조회 헬퍼", () => {
  it("objectivesByPeriod + keyResultsByObjective — 시드 데이터를 돌려준다", () => {
    const db = createMockDb(NOW);
    const objs = db.objectivesByPeriod(PERIOD);
    expect(objs.map((o) => o.id)).toContain("obj-summer");
    const krs = db.keyResultsByObjective("obj-summer");
    expect(krs.length).toBe(3); // kr-summer-tasks, kr-payment-cases, kr-cs-faq
  });

  it("updateObjective는 admin만(member 거부)", () => {
    const db = new MockQueDb(NOW);
    expect(() =>
      db.updateObjective({ actorId: MEMBER, via: "web" }, { objectiveId: "obj-summer", status: "done" }),
    ).toThrow(QueRuleError);
    const ok = db.updateObjective({ actorId: ADMIN, via: "web" }, { objectiveId: "obj-summer", status: "done" });
    expect(ok.status).toBe("done");
  });
});
