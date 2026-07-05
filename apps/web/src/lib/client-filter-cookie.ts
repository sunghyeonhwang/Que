/**
 * 클라이언트 전환 필터 쿠키 이름. 서버(client-filter.ts, next/headers)와
 * 클라이언트 컴포넌트(client-switcher.tsx, document.cookie)가 공유한다.
 * next/headers에 의존하지 않는 순수 상수만 두어 클라이언트 번들에 안전하게 포함되게 한다.
 */
export const CLIENT_FILTER_COOKIE = "que_client_filter";
