// /projects 스코프 필터의 URL sentinel 상수 — 순수 모듈.
//
// 주의: 이 상수들은 반드시 "use client" 파일이 아닌 순수 모듈에 둔다.
// 서버 컴포넌트(page.tsx)가 "use client" 모듈에서 값을 import하면 Next.js RSC 규칙상
// 그 모듈의 모든 named export가 client reference(불투명 프록시)로 치환되어,
// 서버에서 `params.project === ALL_PROJECTS` 같은 문자열 비교가 항상 false가 된다.
// 서버/클라이언트 양쪽에서 같은 문자열 값을 공유하려면 지시어 없는 이 모듈을 쓴다.

/** 클라이언트 필터에서 "전체 클라이언트"를 나타내는 URL sentinel(?client=all). */
export const ALL_CLIENTS = "all";

/** 프로젝트 필터에서 "전체 프로젝트"를 나타내는 URL sentinel(?project=all). */
export const ALL_PROJECTS = "all";
