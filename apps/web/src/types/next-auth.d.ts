import type { DefaultSession } from "next-auth";
import type { UserRole } from "@que/core";

// 세션/JWT에 Que 도메인 필드(id, role)를 얹는다.
declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: UserRole;
      /** 임시 비밀번호 상태 — 참이면 로그인 후 비밀번호 변경을 강제한다. */
      mustChangePassword?: boolean;
    } & DefaultSession["user"];
  }
  interface User {
    role?: UserRole;
    mustChangePassword?: boolean;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id?: string;
    role?: UserRole;
    mustChangePassword?: boolean;
  }
}
