"use client";

import { createContext, useContext } from "react";

// 클라이언트 컴포넌트가 담당자/참석자 선택에 쓰는 "현재 재직자 명단"을 서버에서 한 번 받아
// context로 공유한다. 예전엔 각 폼이 정적 @que/core USERS를 import 했지만, 그러면 직원 추가/비활성이
// 반영되지 않는다. (app) 레이아웃이 db.users(비활성 제외)를 매핑해 이 Provider로 주입한다.
// 서버 컴포넌트는 이 훅을 쓰지 않고 db.users를 직접 본다.

export interface RosterUser {
  id: string;
  name: string;
  avatarColor: string;
  role: "admin" | "member";
}

const RosterContext = createContext<RosterUser[]>([]);

export function RosterProvider({
  roster,
  children,
}: {
  roster: RosterUser[];
  children: React.ReactNode;
}) {
  return <RosterContext.Provider value={roster}>{children}</RosterContext.Provider>;
}

/** 현재 재직자 명단(담당자/참석자 선택용). Provider 밖이면 빈 배열. */
export function useRoster(): RosterUser[] {
  return useContext(RosterContext);
}
