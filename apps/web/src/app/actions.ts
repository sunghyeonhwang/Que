"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { findUser } from "@que/core";
import { USER_COOKIE } from "@/lib/current-user";

/** mock 로그인 사용자 전환. 존재하지 않는 id는 무시한다. */
export async function switchUser(userId: string) {
  if (!findUser(userId)) return;
  const store = await cookies();
  store.set(USER_COOKIE, userId, { path: "/", maxAge: 60 * 60 * 24 * 365 });
  revalidatePath("/", "layout");
}
