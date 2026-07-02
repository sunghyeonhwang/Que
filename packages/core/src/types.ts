// 데이터 모델 초안: data/docs/que-product-plan.md 참고.
// Phase 1에서는 mock 로그인에 필요한 User만 정의한다. 나머지 모델은 Phase 2에서 추가.

export type UserRole = "admin" | "member";

export interface User {
  id: string;
  name: string;
  role: UserRole;
  /** 캘린더/아바타에서 멤버 구분에 쓰는 색 (hex) */
  avatarColor: string;
}
