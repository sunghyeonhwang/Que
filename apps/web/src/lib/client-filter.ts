import { cookies } from "next/headers";
import { cache } from "react";
import { getDb } from "./db";
import { CLIENT_FILTER_COOKIE } from "./client-filter-cookie";

// 쿠키 이름은 next/headers에 의존하지 않는 별도 모듈에 둔다(클라이언트 스위처가 이 파일을
// import하면 서버 전용 next/headers가 클라 번들로 끌려와 빌드가 깨진다). 여기선 재노출만.
export { CLIENT_FILTER_COOKIE };

/**
 * 상단 클라이언트 스위처가 고른 필터를 읽어 검증한다.
 * - 값이 없거나 active 클라이언트가 아니면(삭제·보관됨) undefined = "전체 보기"로 폴백.
 * - cache()로 요청 내 여러 페이지/컴포넌트의 중복 호출을 합친다.
 */
export const getClientFilter = cache(async (): Promise<string | undefined> => {
  const cookieStore = await cookies();
  const raw = cookieStore.get(CLIENT_FILTER_COOKIE)?.value;
  if (!raw) return undefined;
  const db = await getDb();
  const client = db.clients.find((c) => c.id === raw && c.status === "active");
  return client ? client.id : undefined;
});

/**
 * 현재 활성 클라이언트 필터의 표시 이름. 필터가 없거나(전체) 유효하지 않으면 null.
 * 성과·홈 상단 "○○ 기준" 배지가 오독 방지용으로 쓴다. cache()로 getClientFilter와 중복 로드 안 함.
 */
export const getClientFilterName = cache(async (): Promise<string | null> => {
  const cookieStore = await cookies();
  const raw = cookieStore.get(CLIENT_FILTER_COOKIE)?.value;
  if (!raw) return null;
  const db = await getDb();
  const client = db.clients.find((c) => c.id === raw && c.status === "active");
  return client ? client.name : null;
});

/** 스위처 드롭다운용 active 클라이언트 목록(보관 제외). 빈 배열이면 스위처는 렌더하지 않는다. */
export const getClientOptions = cache(
  async (): Promise<{ id: string; name: string }[]> => {
    const db = await getDb();
    return db.clients
      .filter((c) => c.status === "active")
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((c) => ({ id: c.id, name: c.name }));
  },
);
