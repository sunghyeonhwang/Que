import type { Metadata } from "next";

// font.griff.co.kr — 한글 무료 폰트 페어링 공개 사이트 셸.
// - (app) 밖 독립 그룹. 앱 사이드바·상단바·인증과 무관한 풀폭 사이트.
// - view/gantt와 달리 공개·인덱스 허용(robots noindex 없음).
// - html/body는 루트 레이아웃이 제공하므로 여기서는 div 셸만 둔다.
//   테마(다크/라이트)는 Que 전역 theme 쿠키에 의존하지 않고 클라이언트가 자체 CSS 변수로 관리한다.
export const metadata: Metadata = {
  title: "폰트 페어링 — 한글 폰트 조합 미리보기",
  description:
    "눈누의 무료 한글 폰트를 무드별로 페어링해 브랜드·에디토리얼·UI 실사용 화면으로 미리 보는 타이포그래피 도구.",
};

export default function FontShellLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return <div className="flex min-h-dvh w-full flex-col">{children}</div>;
}
