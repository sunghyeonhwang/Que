"use server";

import { getCurrentUser } from "@/lib/current-user";
import { searchWorkspace, type SearchGroup } from "@/lib/search-data";

/** 상단바 전역 검색 — 현재 사용자 권한으로 조회. */
export async function searchAction(query: string): Promise<SearchGroup[]> {
  const user = await getCurrentUser();
  return searchWorkspace(query, user);
}
