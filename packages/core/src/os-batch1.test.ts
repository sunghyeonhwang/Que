import { describe, expect, it } from "vitest";
import { MockQueDb, createMockDb } from "./data/mock-db";
import { QueRuleError, keyResultProgress, retroSummaryForWeek , changeRequestSlaState } from "./rules";

// 에이전시 OKR 3종 세트(OS-1 상태형 KR · OS-2a 실패 분류 · OS-2b 외부 변경 접수) 도메인 규칙.
// 규칙 출처: que+/company-os-plan.md 부록 A/B/C + 운영 정책 확정 절.

const NOW = new Date("2026-07-02T09:00:00+09:00");

const HWANG = "hwang-sunghyeon"; // 대표(admin) — prj-summer owner
const ADMIN = "oh-seunghoon"; // admin — prj-payment owner
const MEMBER = "park-seunghwan"; // member — 프로젝트 미소유
const YEJIN = "lee-yejin"; // member — prj-cs owner / obj 소유자로도 씀

/** 고정 시각 clock로 db 생성 — 시드·this.now()를 모두 NOW로 맞춘다(집계·SLA 검증 결정성). */
function fixedDb(): MockQueDb {
  return new MockQueDb(NOW, () => NOW);
}

// ─────────────────────────────────────────────────────────────────────────────
// OS-1 상태형 KR (부록 A)
// ─────────────────────────────────────────────────────────────────────────────

describe("OS-1 상태형 KR", () => {
  /** ADMIN이 YEJIN 소유 Objective를 만들고, YEJIN이 그 밑에 state KR을 만든다(체크 2개). */
  function seedStateKr(db: MockQueDb, checks: { label: string; requiresAdminConfirm: boolean }[]) {
    const obj = db.createObjective(
      { actorId: ADMIN, via: "web" },
      { title: "상태형 목표", period: "2026-Q3", ownerId: YEJIN },
    );
    return db.createKeyResult(
      { actorId: YEJIN, via: "web" },
      {
        objectiveId: obj.id,
        title: "런칭 준비 상태",
        ownerId: YEJIN,
        month: "2026-07",
        metricType: "state",
        stateChecks: checks,
      },
    );
  }

  it("state 진척은 done 체크 비율로 계산된다", () => {
    const db = fixedDb();
    const kr = seedStateKr(db, [
      { label: "디자인 확정", requiresAdminConfirm: false },
      { label: "QA 통과", requiresAdminConfirm: false },
    ]);
    expect(keyResultProgress(kr, db.tasks)).toBe(0);
    db.toggleKeyResultCheck({ actorId: YEJIN, via: "web" }, { keyResultId: kr.id, checkId: kr.stateChecks![0].id, done: true });
    expect(keyResultProgress(kr, db.tasks)).toBe(50);
  });

  it("state KR은 체크 항목이 1개 이상 없으면 거부한다(INVALID_INPUT)", () => {
    const db = fixedDb();
    const obj = db.createObjective(
      { actorId: ADMIN, via: "web" },
      { title: "빈 상태형", period: "2026-Q3", ownerId: YEJIN },
    );
    expect(() =>
      db.createKeyResult(
        { actorId: YEJIN, via: "web" },
        { objectiveId: obj.id, title: "체크 없음", ownerId: YEJIN, month: "2026-07", metricType: "state" },
      ),
    ).toThrow(QueRuleError);
  });

  it("state 타입에 manual 필드(targetValue)를 넣으면 거부한다(배타)", () => {
    const db = fixedDb();
    const obj = db.createObjective(
      { actorId: ADMIN, via: "web" },
      { title: "배타 검증", period: "2026-Q3", ownerId: YEJIN },
    );
    expect(() =>
      db.createKeyResult(
        { actorId: YEJIN, via: "web" },
        {
          objectiveId: obj.id,
          title: "혼합",
          ownerId: YEJIN,
          month: "2026-07",
          metricType: "state",
          targetValue: 10,
          stateChecks: [{ label: "체크", requiresAdminConfirm: false }],
        },
      ),
    ).toThrow(QueRuleError);
  });

  it("requiresAdminConfirm 항목은 소유자(member)가 토글할 수 없고 admin만 가능하다", () => {
    const db = fixedDb();
    const kr = seedStateKr(db, [
      { label: "내부 준비", requiresAdminConfirm: false },
      { label: "클라이언트 최종 승인", requiresAdminConfirm: true },
    ]);
    const lockedId = kr.stateChecks!.find((c) => c.requiresAdminConfirm)!.id;
    // 소유자(member)는 잠금 항목을 토글할 수 없다.
    expect(() =>
      db.toggleKeyResultCheck({ actorId: YEJIN, via: "web" }, { keyResultId: kr.id, checkId: lockedId, done: true }),
    ).toThrow(QueRuleError);
    // admin은 가능하다 + confirmedBy·doneAt 기록.
    db.toggleKeyResultCheck({ actorId: ADMIN, via: "web" }, { keyResultId: kr.id, checkId: lockedId, done: true });
    const locked = kr.stateChecks!.find((c) => c.id === lockedId)!;
    expect(locked.done).toBe(true);
    expect(locked.confirmedBy).toBe(ADMIN);
    expect(locked.doneAt).toBeTruthy();
  });

  it("일반 항목은 KR 소유자가 토글하고 ChangeLog(update)에 라벨을 남긴다", () => {
    const db = fixedDb();
    const kr = seedStateKr(db, [{ label: "디자인 확정", requiresAdminConfirm: false }]);
    const before = db.changeLogs.length;
    db.toggleKeyResultCheck({ actorId: YEJIN, via: "mcp" }, { keyResultId: kr.id, checkId: kr.stateChecks![0].id, done: true });
    const log = db.changeLogs[db.changeLogs.length - 1];
    expect(db.changeLogs.length).toBe(before + 1);
    expect(log.entityType).toBe("key_result");
    expect(log.via).toBe("mcp");
    expect(log.afterValue).toContain("디자인 확정");
  });

  it("state가 아닌 KR에는 체크 토글을 할 수 없다(INVALID_INPUT)", () => {
    const db = fixedDb();
    // 시드 kr-cs-faq는 manual — 토글 거부.
    expect(() =>
      db.toggleKeyResultCheck({ actorId: YEJIN, via: "web" }, { keyResultId: "kr-cs-faq", checkId: "x", done: true }),
    ).toThrow(QueRuleError);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// OS-2a 실패 분류 (부록 B)
// ─────────────────────────────────────────────────────────────────────────────

describe("OS-2a 실패 분류(회고)", () => {
  it("회고는 담당·admin만 남길 수 있고 ChangeLog를 남기지 않는다", () => {
    const db = fixedDb();
    // member(park)는 prj-summer(owner=hwang admin) 마일스톤에 회고를 남길 수 없다.
    expect(() =>
      db.createMilestoneRetro(
        { actorId: MEMBER, via: "web" },
        { milestoneId: "ms-summer-open", cause: "internal", causeDetail: "qa_lack" },
      ),
    ).toThrow(QueRuleError);
    // yejin은 prj-cs owner라 ms-cs-faq에 회고를 남긴다.
    const changeLogBefore = db.changeLogs.length;
    const retro = db.createMilestoneRetro(
      { actorId: YEJIN, via: "web" },
      { milestoneId: "ms-cs-faq", cause: "internal", causeDetail: "communication", note: "핸드오프 지연" },
    );
    expect(retro.createdBy).toBe(YEJIN);
    expect(retro.managed).toBe(false);
    expect(db.changeLogs.length).toBe(changeLogBefore); // 회고=기록 그 자체(ChangeLog 없음)
    expect(db.retrosByMilestone("ms-cs-faq").some((r) => r.id === retro.id)).toBe(true);
  });

  it("잘못된 causeDetail enum은 거부한다(INVALID_INPUT)", () => {
    const db = fixedDb();
    expect(() =>
      db.createMilestoneRetro(
        { actorId: YEJIN, via: "web" },
        // @ts-expect-error 잘못된 enum 런타임 거부 검증
        { milestoneId: "ms-cs-faq", cause: "internal", causeDetail: "made_up" },
      ),
    ).toThrow(QueRuleError);
  });

  it("주간 집계는 내부·외부·관리됨을 센다", () => {
    const db = fixedDb();
    // 시드: retro-payment-qa(internal, unmanaged) + retro-cs-faq(external, managed) — 둘 다 지난 7일.
    const base = retroSummaryForWeek(db, NOW);
    expect(base).toEqual({ internal: 1, external: 1, managed: 1 });
    // 외부·managed 회고를 추가하면 external·managed가 증가한다.
    db.createMilestoneRetro(
      { actorId: HWANG, via: "web" },
      { milestoneId: "ms-summer-open", cause: "external", causeDetail: "budget_change", managed: true },
    );
    expect(retroSummaryForWeek(db, NOW)).toEqual({ internal: 1, external: 2, managed: 2 });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// OS-2b 외부 변경 접수 (부록 C)
// ─────────────────────────────────────────────────────────────────────────────

describe("OS-2b 외부 변경 접수", () => {
  /** yejin(prj-cs owner)이 ms-cs-faq에 변경을 접수한다. */
  function received(db: MockQueDb) {
    return db.createChangeRequest(
      { actorId: YEJIN, via: "web" },
      { projectId: "prj-cs", milestoneId: "ms-cs-faq", title: "일정 변경 요청" },
    );
  }

  it("접수는 프로젝트 담당·admin만 하고 impactDeadline은 접수+24h다", () => {
    const db = fixedDb();
    // member(park)는 prj-cs 담당이 아니다 → 거부.
    expect(() =>
      db.createChangeRequest(
        { actorId: MEMBER, via: "web" },
        { projectId: "prj-cs", title: "무단 접수" },
      ),
    ).toThrow(QueRuleError);
    const cr = received(db);
    expect(cr.stage).toBe("received");
    expect(Date.parse(cr.impactDeadline) - Date.parse(cr.receivedAt)).toBe(24 * 60 * 60 * 1000);
    expect(cr.stageLog).toHaveLength(1);
  });

  it("단계는 순서대로만 진행한다(건너뛰기 거부)", () => {
    const db = fixedDb();
    const cr = received(db);
    // received → renegotiated로 건너뛰기 거부.
    expect(() =>
      db.advanceChangeRequestStage({ actorId: YEJIN, via: "web" }, { changeRequestId: cr.id, toStage: "renegotiated" }),
    ).toThrow(QueRuleError);
    // 순서대로는 통과.
    db.advanceChangeRequestStage({ actorId: YEJIN, via: "web" }, { changeRequestId: cr.id, toStage: "impact_analyzed" });
    expect(db.changeRequests.find((c) => c.id === cr.id)!.stage).toBe("impact_analyzed");
  });

  it("승인 단계는 admin만 진행한다", () => {
    const db = fixedDb();
    const cr = received(db);
    db.advanceChangeRequestStage({ actorId: YEJIN, via: "web" }, { changeRequestId: cr.id, toStage: "impact_analyzed" });
    db.advanceChangeRequestStage({ actorId: YEJIN, via: "web" }, { changeRequestId: cr.id, toStage: "renegotiated" });
    // member owner(yejin)는 approved로 진행할 수 없다.
    expect(() =>
      db.advanceChangeRequestStage({ actorId: YEJIN, via: "web" }, { changeRequestId: cr.id, toStage: "approved" }),
    ).toThrow(QueRuleError);
    // admin은 가능.
    db.advanceChangeRequestStage({ actorId: ADMIN, via: "web" }, { changeRequestId: cr.id, toStage: "approved" });
    expect(db.changeRequests.find((c) => c.id === cr.id)!.stage).toBe("approved");
  });

  it("종결 시 external·managed 회고가 자동 생성된다(milestoneId 있을 때)", () => {
    const db = fixedDb();
    const cr = received(db);
    db.advanceChangeRequestStage({ actorId: YEJIN, via: "web" }, { changeRequestId: cr.id, toStage: "impact_analyzed" });
    db.advanceChangeRequestStage({ actorId: YEJIN, via: "web" }, { changeRequestId: cr.id, toStage: "renegotiated" });
    db.advanceChangeRequestStage({ actorId: ADMIN, via: "web" }, { changeRequestId: cr.id, toStage: "approved" });
    const retrosBefore = db.retrosByMilestone("ms-cs-faq").length;
    const closed = db.advanceChangeRequestStage({ actorId: ADMIN, via: "web" }, { changeRequestId: cr.id, toStage: "closed" });
    expect(closed.stage).toBe("closed");
    expect(closed.closedAt).toBeTruthy();
    const retros = db.retrosByMilestone("ms-cs-faq");
    expect(retros.length).toBe(retrosBefore + 1);
    const auto = retros[0];
    expect(auto.cause).toBe("external");
    expect(auto.managed).toBe(true);
    expect(auto.causeDetail).toBe("client_direction");
  });
});

describe("changeRequestSlaState (게이트 High-1 — 영향 분석 전만 발화)", () => {
  const base = { impactDeadline: "2026-07-12T10:00:00+09:00" } as const;
  it("received + 마감 초과 = esc", () => {
    expect(
      changeRequestSlaState({ ...base, stage: "received" }, new Date("2026-07-12T11:00:00+09:00")),
    ).toBe("esc");
  });
  it("received + 12h 이내 = remind", () => {
    expect(
      changeRequestSlaState({ ...base, stage: "received" }, new Date("2026-07-12T01:00:00+09:00")),
    ).toBe("remind");
  });
  it("영향 분석 완료(impact_analyzed) 이후엔 마감이 지나도 null — 허위 경보 금지", () => {
    for (const stage of ["impact_analyzed", "renegotiated", "approved", "closed"] as const) {
      expect(
        changeRequestSlaState({ ...base, stage }, new Date("2026-07-13T11:00:00+09:00")),
      ).toBeNull();
    }
  });
  it("received + 마감 12h 이상 전 = null", () => {
    expect(
      changeRequestSlaState({ ...base, stage: "received" }, new Date("2026-07-11T10:00:00+09:00")),
    ).toBeNull();
  });
});
