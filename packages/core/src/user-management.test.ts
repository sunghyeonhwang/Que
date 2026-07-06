import { describe, expect, it } from "vitest";
import { canManageUsers, createUserInputSchema } from "./index";

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
});
