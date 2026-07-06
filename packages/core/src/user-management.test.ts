import { describe, expect, it } from "vitest";
import {
  canManageUsers,
  createUserInputSchema,
  updateUserProfileInputSchema,
} from "./index";

// 직원 관리(항목 19)의 도메인 규칙 — 권한 게이트와 생성 입력 검증.
// 실제 쓰기(createUser/deactivateUser)는 apps/web의 Supabase 전용 경로에서 수행하지만,
// 권한/입력 규칙은 core에서 강제하고 여기서 거부 동작을 잠근다.

describe("canManageUsers — 직원 관리는 관리자만", () => {
  it("admin은 허용", () => {
    expect(canManageUsers({ role: "admin" })).toBe(true);
  });
  it("member는 거부", () => {
    expect(canManageUsers({ role: "member" })).toBe(false);
  });
});

describe("createUserInputSchema — 신규 직원 입력 검증", () => {
  const valid = {
    name: "김신입",
    email: "SinIp@Griff.co.kr",
    role: "member" as const,
    rank: "사원",
  };

  it("정상 입력을 통과시키고 이메일을 소문자/trim 정규화한다", () => {
    const parsed = createUserInputSchema.parse({ ...valid, email: "  SinIp@Griff.co.kr " });
    expect(parsed.email).toBe("sinip@griff.co.kr");
    expect(parsed.role).toBe("member");
    expect(parsed.rank).toBe("사원");
  });

  it("이메일 형식이 아니면 거부", () => {
    expect(createUserInputSchema.safeParse({ ...valid, email: "not-an-email" }).success).toBe(false);
  });

  it("이름이 비면 거부", () => {
    expect(createUserInputSchema.safeParse({ ...valid, name: "   " }).success).toBe(false);
  });

  it("직급(rank)이 비면 거부", () => {
    expect(createUserInputSchema.safeParse({ ...valid, rank: "" }).success).toBe(false);
  });

  it("role은 admin/member 외 값을 거부", () => {
    expect(
      createUserInputSchema.safeParse({ ...valid, role: "owner" as unknown as "admin" }).success,
    ).toBe(false);
  });

  it("avatarColor는 #RRGGBB만 허용(선택 필드)", () => {
    expect(createUserInputSchema.safeParse({ ...valid, avatarColor: "red" }).success).toBe(false);
    expect(createUserInputSchema.safeParse({ ...valid, avatarColor: "#1a2b3c" }).success).toBe(true);
  });

  it("rank는 대표/관리/사원 외 값을 거부(grade 커플링 보호)", () => {
    expect(createUserInputSchema.safeParse({ ...valid, rank: "인턴" }).success).toBe(false);
    expect(createUserInputSchema.safeParse({ ...valid, rank: "관리" }).success).toBe(true);
  });
});

describe("updateUserProfileInputSchema — 프로필 편집 입력 검증", () => {
  it("email·rank·department 각각 단독 편집을 허용한다", () => {
    expect(updateUserProfileInputSchema.safeParse({ email: "new@griff.co.kr" }).success).toBe(true);
    expect(updateUserProfileInputSchema.safeParse({ rank: "관리" }).success).toBe(true);
    expect(updateUserProfileInputSchema.safeParse({ department: "개발" }).success).toBe(true);
  });

  it("빈 요청(0필드)은 거부한다 — 변경 항목 최소 1개 필요", () => {
    expect(updateUserProfileInputSchema.safeParse({}).success).toBe(false);
  });

  it("rank는 enum 외 값을 거부한다", () => {
    expect(updateUserProfileInputSchema.safeParse({ rank: "부장" }).success).toBe(false);
  });

  it("email 형식이 아니면 거부하고, 정상 email은 소문자/trim 정규화한다", () => {
    expect(updateUserProfileInputSchema.safeParse({ email: "not-an-email" }).success).toBe(false);
    const parsed = updateUserProfileInputSchema.parse({ email: "  New@Griff.co.kr " });
    expect(parsed.email).toBe("new@griff.co.kr");
  });

  it("department는 빈 문자열도 허용한다(부서 비우기)", () => {
    expect(updateUserProfileInputSchema.safeParse({ department: "" }).success).toBe(true);
  });

  it("name은 편집 대상이 아니다(무시되고 다른 필드로 통과 판정)", () => {
    // name만 준 경우 유효 필드가 없어 거부돼야 한다.
    expect(
      updateUserProfileInputSchema.safeParse({ name: "바꾼이름" } as { name: string }).success,
    ).toBe(false);
  });
});
