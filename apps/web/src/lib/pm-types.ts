// 뷰모델에서 공유하는 멤버 표시 타입. 아바타 스택·담당자 칩이 소비한다.
// (구 pm-data.ts에서 이관 — 홈/작업목록/프로젝트 뷰가 함께 쓴다.)

export interface ListViewMember {
  id: string;
  name: string;
  avatarColor: string;
}
