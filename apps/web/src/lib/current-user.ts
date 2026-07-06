import { redirect } from "next/navigation";
import type { User } from "@que/core";
import { auth } from "@/auth";
import { getDb } from "@/lib/db";

/** 실 로그인: Auth.js 세션에서 사용자를 읽는다. 세션이 없으면 로그인 화면으로 보낸다.
 *  이 함수를 부르는 모든 (app) 페이지·레이아웃이 자동으로 인증 게이트를 통과한다.
 *
 *  명단은 정적 로스터가 아니라 DB(db.users)에서 조회한다 — 직원 관리(추가/비활성)가 반영되도록.
 *  비활성(active === false) 계정은 세션이 남아 있어도 접근을 차단한다(로그인 화면으로). */
export async function getCurrentUser(): Promise<User> {
  const session = await auth();
  const id = session?.user?.id;
  if (!id) redirect("/login");

  const db = await getDb();
  const base = db.users.find((u) => u.id === id);
  // DB에 없거나(삭제된 적은 없지만 방어) 비활성이면 접근 차단 — 재로그인/로그인 거부로 유도.
  if (!base || base.active === false) redirect("/login");
  // avatarColor·rank·department·active는 DB(db.users)에서, name·role은 세션 값을 우선한다.
  return {
    ...base,
    name: session.user.name ?? base.name,
    role: session.user.role ?? base.role,
  };
}
