"use server";

import { signOut } from "@/auth";

/** 로그아웃. Auth.js 세션을 지우고 로그인 화면으로 보낸다. */
export async function logout() {
  await signOut({ redirectTo: "/login" });
}
