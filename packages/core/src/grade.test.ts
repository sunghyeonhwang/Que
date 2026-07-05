import { describe, expect, it } from "vitest";
import { gradeForUser, personScopeForGrade } from "./mock/users";
import { USERS } from "./mock/users";

// 직급(grade) 판정과 성과 사람-위젯 스코프 유도 규칙.
// USER_RANK가 유일한 소스이고, 스코프는 뷰어 id에서만 유도된다(URL 확대 불가의 데이터 계층 방어).

const CEO = "hwang-sunghyeon";
const MANAGER = "oh-seunghoon";
const STAFF = "hwang-sungjin";

describe("gradeForUser — USER_RANK를 ceo/manager/staff로 감싼다", () => {
  it("대표는 ceo", () => {
    expect(gradeForUser(CEO)).toBe("ceo");
  });
  it("관리는 manager", () => {
    expect(gradeForUser(MANAGER)).toBe("manager");
  });
  it("사원은 staff", () => {
    expect(gradeForUser(STAFF)).toBe("staff");
    expect(gradeForUser("lee-hyejin")).toBe("staff");
  });
  it("명단에 없는 id는 staff로 폴백", () => {
    expect(gradeForUser("unknown-person")).toBe("staff");
  });
});

describe("personScopeForGrade — 사람 위젯 스코프는 뷰어 grade에서만 유도", () => {
  it("대표는 전원(8)", () => {
    const scope = personScopeForGrade(CEO);
    expect(scope).toHaveLength(USERS.length);
    expect(scope).toEqual(expect.arrayContaining(USERS.map((u) => u.id)));
  });

  it("관리자는 대표를 제외한 전원(7) — 자신과 다른 관리자는 포함", () => {
    const scope = personScopeForGrade(MANAGER);
    expect(scope).toHaveLength(USERS.length - 1);
    expect(scope).not.toContain(CEO);
    expect(scope).toContain(MANAGER);
    expect(scope).toContain(STAFF);
  });

  it("사원은 본인 1명만", () => {
    expect(personScopeForGrade(STAFF)).toEqual([STAFF]);
  });

  it("사원 스코프는 URL로 넓힐 수 없다 — 항상 본인 id에서만 유도", () => {
    // 다른 사원의 id를 넘겨도 그 사원 본인만 반환된다(호출자가 남의 스코프를 요청해도 무의미).
    expect(personScopeForGrade("lee-yejin")).toEqual(["lee-yejin"]);
  });
});
