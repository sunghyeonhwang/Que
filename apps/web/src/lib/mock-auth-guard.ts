// mock 인증(쿠키 사용자 전환 + 결정적 PAT)은 로컬 개발 전용이다.
// production 빌드에서 실수로 공개 배포되는 것을 막기 위해,
// 명시적 옵트인(QUE_ALLOW_MOCK_AUTH=true) 없이는 인증 전체를 차단한다.
// 실 인증(Auth.js 등) 도입 전 데모 배포 시에만 Vercel Deployment Protection과
// 함께 옵트인을 켠다 (docs/deploy-vercel-supabase.md 참고).

export function isMockAuthAllowed(): boolean {
  return process.env.NODE_ENV !== "production" || process.env.QUE_ALLOW_MOCK_AUTH === "true";
}

export const MOCK_AUTH_BLOCKED_MESSAGE =
  "mock 인증은 배포 환경에서 비활성화되어 있다. 데모 목적이면 QUE_ALLOW_MOCK_AUTH=true를 명시적으로 설정하라 (반드시 Deployment Protection과 함께).";
