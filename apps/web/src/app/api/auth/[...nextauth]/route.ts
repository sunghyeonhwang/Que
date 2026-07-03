import { handlers } from "@/auth";

// Auth.js 콜백/세션 엔드포인트. Credentials 로그인은 서버 액션(signIn)으로 처리하지만,
// signOut/세션 조회 등 내부 플로우가 이 라우트를 사용한다.
export const { GET, POST } = handlers;
