import type { DefaultSession } from "next-auth";
import type { UserRole } from "@que/core";

// 세션/JWT에 Que 도메인 필드(id, role)를 얹는다.
declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: UserRole;
    } & DefaultSession["user"];
  }
  interface User {
    role?: UserRole;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id?: string;
    role?: UserRole;
  }
}
